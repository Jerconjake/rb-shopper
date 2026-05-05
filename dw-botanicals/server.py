import os
import json
import re
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder="dist", static_url_path="")

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

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

INTAKE FIRST — ALWAYS:
Before recommending anything, you must understand what they're dealing with. Ask:
1. What symptoms or concerns they have
2. How long it's been going on (if relevant)
3. Whether they've tried anything already (optional, only if useful)

Ask 1-2 questions at a time. Never jump to a product recommendation until you have enough to genuinely help.

If someone says "just tell me what to take" or "I don't know where to start" — gently hold: "I want to make sure I point you in the right direction — what's the main thing you're hoping to address?"

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
    return send_from_directory("dist", "index.html")

@app.route("/<path:path>")
def serve_static(path):
    try:
        return send_from_directory("dist", path)
    except:
        return send_from_directory("dist", "index.html")

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

    return jsonify({
        "reply": reply,
        "products": product_cards
    })

@app.route("/api/products", methods=["GET"])
def get_products():
    return jsonify(PRODUCTS)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
