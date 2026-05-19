import os
import json
import re
import time
import requests
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder="static", static_url_path="")

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# WooCommerce credentials for live bundle fetch
WC_KEY = os.environ.get("WC_KEY", "ck_61a9fb615cb3bfbeb02355ff606d29ef93163117")
WC_SECRET = os.environ.get("WC_SECRET", "cs_15eaf2ca6886d182b01477c497f9a30fd0508b69")
WC_BASE = "https://www.desertwillowbotanicals.com/wp-json/wc/v3"

# Known individual formula names (to filter them out of bundle results)
FORMULA_NAMES = {
    "al-r-g", "sinease", "respiratory", "immune boost", "inflammaid",
    "joint juice", "nervaid", "mentalert", "sleep/stress", "sleep stress",
    "digestaid", "detox", "hair of the dog"
}

_bundle_cache = {"data": None, "ts": 0}
BUNDLE_CACHE_TTL = 900  # refresh every 15 minutes

# ── Analytics counters (in-memory, cumulative since last restart) ──
_analytics = {
    "sessions": 0,
    "messages": 0,
    "product_clicks": 0,
    "subscribe_clicks": 0,
    "find_in_person_clicks": 0
}

# ── Daily log (in-memory, populated by monitoring agent each morning) ──
_daily_log = []  # list of {date, sessions, messages, product_clicks, subscribe_clicks, find_in_person_clicks}
DASHBOARD_TOKEN = os.environ.get("DASHBOARD_TOKEN", "dw-stats-2025")

# ── IP exclusion (comma-separated in EXCLUDED_IPS env var) ──
_excluded_ips = set(
    ip.strip() for ip in os.environ.get("EXCLUDED_IPS", "172.225.43.149").split(",") if ip.strip()
)

def _get_client_ip():
    """Get real client IP, respecting Render's proxy headers."""
    return (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.remote_addr
        or ""
    )

def _is_excluded():
    return _get_client_ip() in _excluded_ips

def fetch_live_bundles():
    """Fetch published bundle products from WooCommerce. Cache for 1 hour."""
    global _bundle_cache
    now = time.time()
    if _bundle_cache["data"] is not None and (now - _bundle_cache["ts"]) < BUNDLE_CACHE_TTL:
        return _bundle_cache["data"]

    try:
        resp = requests.get(
            f"{WC_BASE}/products",
            auth=(WC_KEY, WC_SECRET),
            params={"status": "publish", "per_page": 100},
            timeout=10
        )
        if resp.status_code != 200:
            return _bundle_cache["data"] or []

        products = resp.json()
        bundles = []
        for p in products:
            name_lower = p.get("name", "").lower()
            # Skip individual formulas
            if any(f in name_lower for f in FORMULA_NAMES):
                continue
            # Include anything with bundle-like keywords or that isn't a formula
            bundles.append({
                "name": p.get("name"),
                "price": p.get("price"),
                "regular_price": p.get("regular_price"),
                "description": re.sub(r"<[^>]+>", "", p.get("short_description") or p.get("description") or "").strip(),
                "url": p.get("permalink")
            })

        _bundle_cache = {"data": bundles, "ts": now}
        return bundles

    except Exception:
        return _bundle_cache["data"] or []

def build_bundle_text():
    bundles = fetch_live_bundles()
    if not bundles:
        return "No bundles or sale items are currently available."
    sale_items = [b for b in bundles if "sale" in b["name"].lower()]
    regular_bundles = [b for b in bundles if "sale" not in b["name"].lower()]
    lines = []
    if sale_items:
        lines.append("🔥 ACTIVE SALES (prioritize mentioning these when relevant):")
        for b in sale_items:
            price_info = f"${b['price']}"
            if b.get("regular_price") and b["regular_price"] != b["price"]:
                price_info = f"${b['price']} (was ${b['regular_price']})"
            desc = f" — {b['description']}" if b.get("description") else ""
            lines.append(f"- {b['name']}: {price_info}{desc}\n  Link: {b['url']}")
    if regular_bundles:
        lines.append("\nBundles currently live:")
        for b in regular_bundles:
            price_info = f"${b['price']}"
            if b.get("regular_price") and b["regular_price"] != b["price"]:
                price_info = f"${b['price']} (regular ${b['regular_price']})"
            desc = f" — {b['description']}" if b.get("description") else ""
            lines.append(f"- {b['name']}: {price_info}{desc}\n  Link: {b['url']}")
    return "\n".join(lines)

# Load product catalog
with open("products.json", "r") as f:
    PRODUCTS = json.load(f)

PRODUCTS_BY_ID = {p["id"]: p for p in PRODUCTS}

def build_catalog_text():
    lines = []
    for p in PRODUCTS:
        lines.append(f"""
PRODUCT: {p['name']} (id: {p['id']})
Price: {p['price']} | Subscription: {p['subscription_price'] or 'N/A'} every 2 months
Use type: {p['use_type']}
Symptoms/concerns: {', '.join(p['symptoms'])}
Ingredients: {', '.join(p['ingredients'])}
Summary: {p['summary']}
Dosing: {p['dosing']}
Pairs with: {', '.join(p['pairs_with'])}
Pairing reason: {p['pairing_reason']}
{('Subscription pitch: ' + p['subscription_pitch']) if p.get('subscription_pitch') else ''}
{('Caution: ' + p['caution']) if p.get('caution') else ''}
Product URL: {p['product_url']}
Subscription URL: {p['subscription_url'] or 'N/A'}
""")
    return "\n".join(lines)

SYSTEM_PROMPT = f"""You are Sage, a knowledgeable wellness advisor for Desert Willow Botanicals. Desert Willow has been making artisan herbal tinctures for over four decades — small-batch, pure, no fillers, vegan, gluten-free, purity-tested.

Your role is to help people find the right formula for what they're dealing with. You're like a knowledgeable friend who happens to know herbs deeply — calm, practical, and plain-spoken. Not clinical. Not woo-woo. Just genuinely helpful.

TONE AND VOICE:
- Calm, warm, and matter-of-fact — like talking to someone who really knows this stuff
- Plain language — explain the *why* simply ("it's getting down to the root of the problem, not just masking symptoms")
- Never filler phrases like "That's a great question!" or "Absolutely!" — just respond naturally
- Practical protocol advice when relevant (how to titrate doses, when to increase/decrease)
- Brief — don't overwhelm. One recommendation at a time unless they're clearly dealing with multiple issues.

INTAKE — KEEP IT SHORT:
Ask ONE question to understand what they're dealing with, then recommend. That's it.
- If they give you a symptom or concern, go straight to a recommendation. Don't ask how long or what they've tried unless it genuinely changes the answer.
- "How long" is only useful for acute vs. chronic distinction (affects subscription pitch). If it's obvious from context (e.g. "seasonal allergies") you already know — don't ask.
- "What have you tried" is only worth asking if your first recommendation didn't land.
- If someone says "just tell me what to take" — pick the most likely match and recommend it. Don't stall.

GENERAL QUESTIONS — answer these directly:
- Shipping: Ships to USA, Canada, US Minor Outlying Islands, and US Virgin Islands.
  - USA: $5 flat rate on all orders.
  - Canada (table rates by item count): 1–4 items = $14 | 5 items = $20 | 6–10 items = $50 | 11–20 items = $60
  - 5% off when ordering 6 or more bottles (excludes subscriptions).
  - For full details: https://www.desertwillowbotanicals.com
- How to take / dosing: Answer from the product's dosing info in the catalog below. Give the specific drops/amount and timing. If they ask about a product not in the catalog, direct them to the website.
- Ingredients: Answer from the ingredients list in the catalog.
- Subscriptions: Every 2 months, saves 10%, easy to cancel. Recommend for chronic/ongoing concerns.
- Can't answer something confidently: direct to https://www.desertwillowbotanicals.com/contact or suggest they call — Willow is known for getting back to people quickly.

BUNDLES & SALES — Desert Willow offers curated bundles and runs occasional sales. Only recommend items that are currently live below.
{build_bundle_text()}

IMPORTANT: If there are active sales listed above, proactively mention them when relevant. For example, if someone is interested in products included in a sale bundle, let them know about the deal. Don't force it into every conversation, but if the sale aligns with what they need, bring it up naturally — "There's actually a sale on right now that includes exactly what you need..."

Bundle shipping: US $5 flat, Canada $14 (bundles are 2–4 items, all fall in the 1–4 item tier).
If no bundles or sales are listed above, don't mention them at all — they're not currently available.

RECOMMENDATIONS:
- Recommend 1-2 products maximum at first. Be specific about why THIS product for THIS person.
- For chronic issues (ongoing sleep problems, chronic inflammation, year-round allergies, joint issues, nerve pain, regular brain fog): naturally mention the subscription advantage — "since this works best with consistent daily use, most people find the subscription easier — it saves 10% and means you won't run out."
- For acute/occasional issues (sinus flare-up, hangover, illness, one-time detox): don't push subscription unless they seem like a long-term user.
- After the primary recommendation, if relevant, mention one complementary product conversationally — not as a sales pitch, but as genuine advice ("A lot of people dealing with joint pain also find...")

PRODUCT KNOWLEDGE:
{build_catalog_text()}

UPSELL / CROSS-SELL LOGIC (OR rules — if they mention ANY of these products, suggest the paired one):
- Mentions Inflammaid OR Nervaid → suggest Joint Juice
- Mentions Detox OR Joint Juice OR Nervaid → suggest Inflammaid
- Mentions Immune Boost OR Al-R-G OR Respiratory → suggest Sinease
- Mentions Immune Boost OR Al-R-G OR Sinease → suggest Respiratory
- Mentions Sinease OR Respiratory → suggest Al-R-G
- Mentions Sleep/Stress → suggest Mentalert
- Mentions Hair of the Dog OR Detox OR Mentalert → suggest Sleep/Stress

Apply these naturally in conversation — "since you're dealing with X, many people also find Y really helpful alongside it."

MEDICAL DISCLAIMER — ALWAYS HANDLE GRACEFULLY:
- Never diagnose or claim to treat diseases
- When someone mentions they're on medications (especially blood thinners, sedatives, or immunosuppressants), always say "check with your doctor before adding anything new — some herbs can interact"
- Nervaid specifically: "if you're on sedatives or pain medications, worth checking with your doctor first"
- Weave disclaimers in naturally, not as legal boilerplate

PRODUCT CARDS:
When recommending a product, end your message with a JSON block in this exact format so the UI can render a product card:
```products
["product_id_1", "product_id_2"]
```
Use the product IDs exactly as listed (alrg, sinease, respiratory, immune_boost, inflammaid, joint_juice, nervaid, mentalert, sleep_stress, digestaid, detox, hair_of_the_dog).

HUMAN HANDOFF:
If someone wants to speak with a person, says they have a complex health situation, or has questions you can't confidently answer, say:
"Willow is fantastic at answering questions personally — you can reach Desert Willow Botanicals directly at their website: https://www.desertwillowbotanicals.com/contact or give them a call. They're known for getting back to people quickly."

IMPORTANT:
- You are Sage, not Willow. Willow is the founder of Desert Willow Botanicals.
- These statements have not been evaluated by the FDA. These products are not intended to diagnose, treat, cure, or prevent any disease.
- You are not a doctor. If someone has a serious medical condition, always recommend they consult their healthcare provider.
"""

@app.route("/")
def serve_index():
    return send_from_directory("static", "index.html")

@app.route("/dashboard")
def serve_dashboard():
    return send_from_directory("static", "dashboard.html")

@app.route("/<path:path>")
def serve_static(path):
    try:
        return send_from_directory("static", path)
    except:
        return send_from_directory("static", "index.html")

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])

    # Build OpenAI messages
    openai_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in messages:
        openai_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=openai_messages,
        temperature=0.7,
        max_tokens=800
    )

    reply = response.choices[0].message.content

    # Extract product IDs from ```products block if present
    product_ids = []
    match = re.search(r'```products\s*\n(\[.*?\])\s*\n```', reply, re.DOTALL)
    if match:
        try:
            product_ids = json.loads(match.group(1))
            # Remove the products block from the display text
            reply = re.sub(r'```products\s*\n\[.*?\]\s*\n```', '', reply, flags=re.DOTALL).strip()
        except:
            pass

    # Build product card data
    product_cards = []
    for pid in product_ids:
        p = PRODUCTS_BY_ID.get(pid)
        if p:
            product_cards.append({
                "id": p["id"],
                "name": p["name"],
                "tagline": p["tagline"],
                "price": p["price"],
                "subscription_price": p["subscription_price"],
                "product_url": p["product_url"],
                "subscription_url": p["subscription_url"],
                "image_url": p["image_url"],
                "chronic": p["chronic"]
            })

    # Count this as a message (skip excluded IPs)
    if not _is_excluded():
        _analytics["messages"] += 1

    return jsonify({
        "reply": reply,
        "products": product_cards
    })

@app.route("/track", methods=["POST"])
def track():
    """Receive a tracking event from the chat UI."""
    if _is_excluded():
        return jsonify({"ok": True, "excluded": True})
    data = request.json or {}
    event = data.get("event")
    if event in _analytics:
        _analytics[event] += 1
    return jsonify({"ok": True})

@app.route("/stats", methods=["GET"])
def stats():
    """Return current cumulative analytics counters."""
    return jsonify(_analytics)

@app.route("/log-daily", methods=["POST"])
def log_daily():
    """Receive a daily snapshot from the monitoring agent. Token protected."""
    token = request.headers.get("X-Token", "")
    if token != DASHBOARD_TOKEN:
        return jsonify({"error": "unauthorized"}), 401
    data = request.json or {}
    # Prepend (newest first), keep 90 days
    _daily_log.insert(0, data)
    if len(_daily_log) > 90:
        _daily_log.pop()
    return jsonify({"ok": True, "days_stored": len(_daily_log)})

@app.route("/dashboard-data", methods=["GET"])
def dashboard_data():
    """Return live stats + historical daily log for the Willow dashboard."""
    return jsonify({
        "live": _analytics,
        "history": _daily_log[:30]
    })

@app.route("/widget.js")
def serve_widget():
    return send_from_directory("static", "widget.js", mimetype="application/javascript")

@app.route("/api/products", methods=["GET"])
def get_products():
    return jsonify(PRODUCTS)

@app.route("/api/wc-data", methods=["GET"])
def wc_data():
    """Proxy endpoint — fetches paginated WooCommerce data from DWB.
    Usage: /api/wc-data?resource=orders|customers|products
    Bypasses SiteGround IP blocking since requests come from Render's trusted IP.
    """
    import base64 as b64
    resource = request.args.get("resource", "orders")
    if resource not in ("orders", "customers", "products"):
        return jsonify({"error": "invalid resource"}), 400

    creds = b64.b64encode(f"{WC_KEY}:{WC_SECRET}".encode()).decode()
    headers = {"Authorization": f"Basic {creds}"}

    all_items = []
    page = 1
    while True:
        params = {"per_page": 100, "page": page}
        if resource == "orders":
            params["orderby"] = "date"
            params["order"] = "asc"
        try:
            r = requests.get(f"{WC_BASE}/{resource}", headers=headers, params=params, timeout=30)
        except Exception as e:
            return jsonify({"error": str(e), "fetched": len(all_items)}), 502
        if r.status_code != 200:
            return jsonify({"error": f"WC returned {r.status_code}", "fetched": len(all_items)}), 502
        batch = r.json()
        if not batch:
            break
        all_items.extend(batch)
        if len(batch) < 100:
            break
        page += 1

    return jsonify({"items": all_items, "count": len(all_items)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"✅ Sage — Desert Willow Botanicals running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
