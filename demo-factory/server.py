import os
import json
import threading
import uuid
import time
from flask import Flask, request, jsonify, send_from_directory
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from urllib.parse import urljoin, urlparse

app = Flask(__name__, static_folder="static")

# In-memory stores (persist until redeploy — fine for demo use)
jobs = {}
demos = {}

NOTIFY_EMAIL = os.environ.get("NOTIFY_EMAIL", "jake@j-squared.ca")
BOOKING_LINK = os.environ.get("BOOKING_LINK", "mailto:jake@j-squared.ca")
SERVICE_URL = os.environ.get("SERVICE_URL", "https://demo-factory.onrender.com")


def get_client():
    return OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def scrape_website(url):
    """Scrape homepage + one sub-page (services/about). Returns dict."""
    if not url.startswith("http"):
        url = "https://" + url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    result = {
        "url": url,
        "title": "",
        "description": "",
        "color": "",
        "logo_url": "",
        "content": "",
        "services_content": "",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
        soup = BeautifulSoup(resp.text, "html.parser")

        # Meta info
        title = soup.find("title")
        result["title"] = title.get_text(strip=True) if title else ""

        meta_desc = soup.find("meta", attrs={"name": "description"})
        result["description"] = (
            meta_desc.get("content", "") if meta_desc else ""
        )

        theme_color = soup.find("meta", attrs={"name": "theme-color"})
        result["color"] = (
            theme_color.get("content", "") if theme_color else ""
        )

        # Logo detection — priority order:
        # 1. <img> with "logo" in class/id/alt/src inside header elements
        # 2. og:image meta tag
        # 3. Any <img> with "logo" anywhere on page
        # 4. Site favicon as last resort
        logo_url = ""

        # Priority 1: look inside header/nav elements for logo images
        header_containers = soup.find_all(
            ["header", "nav", "div"],
            class_=lambda c: c and any(
                kw in " ".join(c).lower()
                for kw in ["header", "site-header", "navbar", "nav-wrap", "top-bar", "masthead", "branding"]
            )
        )
        for container in header_containers:
            for img in container.find_all("img"):
                src = img.get("src", "")
                alt = img.get("alt", "").lower()
                cls = " ".join(img.get("class", [])).lower()
                img_id = img.get("id", "").lower()
                if src and any(
                    "logo" in x for x in [src.lower(), alt, cls, img_id]
                ):
                    logo_url = src
                    break
            # Also grab first image in header even without "logo" keyword
            if not logo_url:
                first_img = container.find("img")
                if first_img and first_img.get("src"):
                    src = first_img.get("src", "")
                    # Skip tiny icons / tracking pixels
                    w = first_img.get("width", "999")
                    h = first_img.get("height", "999")
                    try:
                        if int(str(w)) > 40 and int(str(h)) > 20:
                            logo_url = src
                    except Exception:
                        logo_url = src
            if logo_url:
                break

        # Priority 2: og:image
        if not logo_url:
            og_image = soup.find("meta", attrs={"property": "og:image"})
            logo_url = og_image.get("content", "") if og_image else ""

        # Priority 3: any img with "logo" anywhere
        if not logo_url:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                alt = img.get("alt", "").lower()
                cls = " ".join(img.get("class", [])).lower()
                img_id = img.get("id", "").lower()
                if src and any(
                    "logo" in x for x in [src.lower(), alt, cls, img_id]
                ):
                    logo_url = src
                    break

        if logo_url and not logo_url.startswith("http"):
            logo_url = urljoin(url, logo_url)
        result["logo_url"] = logo_url

        # Extract hero/h1 text separately for accurate location detection
        hero_text = ""
        for tag in soup.find_all(["h1", "h2"]):
            t = tag.get_text(strip=True)
            if t:
                hero_text += t + "\n"
        result["hero_text"] = hero_text[:500]

        # Extract address hints using regex (city, province/state patterns)
        import re as _re
        raw_for_addr = soup.get_text(separator=" ", strip=True)
        addr_pattern = _re.compile(
            r'\b([A-Z][a-zA-Z\s]{2,20}),\s*'
            r'(AB|BC|ON|QC|SK|MB|NS|NB|PE|NL|NT|YT|NU|'
            r'Alberta|British Columbia|Ontario|Quebec|Saskatchewan|Manitoba|'
            r'Nova Scotia|New Brunswick|Newfoundland|'
            r'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|'
            r'MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|'
            r'SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Texas|California|Florida|New York)'
        )
        addr_matches = list(dict.fromkeys(
            f"{m.group(1).strip()}, {m.group(2)}"
            for m in addr_pattern.finditer(raw_for_addr)
        ))[:6]
        result["address_hints"] = addr_matches

        # Main text content
        for tag in soup(["script", "style", "nav", "footer", "head", "noscript"]):
            tag.decompose()
        content = soup.get_text(separator="\n", strip=True)
        result["content"] = content[:4000]

        # Find a services/about sub-page link
        sub_link = None
        keywords = ["service", "what-we-do", "about", "work", "solutions", "offering"]
        for a in soup.find_all("a", href=True):
            href = a.get("href", "").lower()
            text = a.get_text().lower()
            if any(kw in href or kw in text for kw in keywords):
                candidate = urljoin(url, a.get("href"))
                parsed = urlparse(candidate)
                base_parsed = urlparse(url)
                # Must be same domain and not same as homepage
                if parsed.netloc == base_parsed.netloc and candidate != url:
                    sub_link = candidate
                    break

        if sub_link:
            try:
                resp2 = requests.get(sub_link, headers=headers, timeout=8)
                soup2 = BeautifulSoup(resp2.text, "html.parser")
                for tag in soup2(["script", "style", "nav", "footer", "head"]):
                    tag.decompose()
                result["services_content"] = soup2.get_text(
                    separator="\n", strip=True
                )[:3000]
            except Exception:
                pass

    except Exception as e:
        result["error"] = str(e)

    return result


def generate_demo(job_id, url):
    """Background thread: scrape → GPT → store demo → notify."""
    try:
        jobs[job_id] = {"status": "scraping", "business_name": None}

        scraped = scrape_website(url)
        jobs[job_id]["status"] = "generating"

        client = get_client()

        addr_hints = scraped.get('address_hints', [])
        addr_line = ", ".join(addr_hints) if addr_hints else "none found"
        content_block = f"""Website URL: {scraped.get('url', '')}
Page title: {scraped.get('title', '')}
Meta description: {scraped.get('description', '')}
Hero / H1 headings (most prominent text — highest priority for location):
{scraped.get('hero_text', '')}
Physical address patterns found on page: {addr_line}
Homepage content:
{scraped.get('content', '')}

Services/About page content:
{scraped.get('services_content', '')}"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You analyze a contractor's website and return a JSON object to power a personalized AI assistant demo.

Return ONLY valid JSON with these exact fields:
{
  "business_name": "Full business name as it appears on their site",
  "trade": "Their trade/industry (e.g. HVAC, Plumbing, Electrical, Roofing, Landscaping, General Contractor, etc.)",
  "tagline": "Their tagline or a short phrase capturing what they do",
  "services": ["service 1", "service 2", "service 3"],
  "location": "Primary service city and Province/State. Use this priority order: (1) city in Hero/H1 headings, (2) physical address patterns provided, (3) page title or meta description. NEVER use cities only mentioned in 'areas we serve' lists, testimonials, or SEO keyword sections. If uncertain, leave blank rather than guess.",
  "phone": "Phone number if found, else empty string",
  "hours": "Business hours if found, else empty string",
  "email": "Contact email if found, else empty string",
  "primary_color": "#xxxxxx (use theme-color meta if clear; otherwise pick a strong professional color fitting their trade — never use #ffffff or #000000 alone)",
  "system_prompt": "A complete, detailed system prompt for an AI assistant for this business (see instructions below)"
}

System prompt instructions:
- Address the assistant in second person: 'You are an AI assistant for [business name]...'
- Include: business name, trade, all services, location, phone, hours
- Pre-qualify leads: ask about their needs, timeline, and service area before suggesting anything
- Handle spam/solicitation politely but firmly (say you'll pass their info to the team and end the conversation)
- For serious leads: encourage booking a call or requesting a quote
- Never make up prices — always direct to call/email for quotes
- Match the tone you sense from the site (professional, friendly, down-to-earth, etc.)
- Be genuinely helpful — not pushy
- Keep responses conversational and concise""",
                },
                {"role": "user", "content": content_block},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        data = json.loads(response.choices[0].message.content)

        # Build slug from business name
        business_name = data.get("business_name", "Business")
        slug_base = (
            business_name.lower()
            .replace("'", "")
            .replace('"', "")
            .replace("&", "and")
            .replace(" ", "-")
        )
        slug_base = "".join(
            c if c.isalnum() or c == "-" else "" for c in slug_base
        )[:28]
        slug = f"{slug_base}-{job_id[:6]}"

        # Store demo
        demos[slug] = {
            "business_name": business_name,
            "trade": data.get("trade", "Contractor"),
            "tagline": data.get("tagline", ""),
            "services": data.get("services", []),
            "location": data.get("location", ""),
            "phone": data.get("phone", ""),
            "hours": data.get("hours", ""),
            "email": data.get("email", ""),
            "primary_color": data.get("primary_color", "#1a73e8"),
            "logo_url": scraped.get("logo_url", ""),
            "system_prompt": data.get("system_prompt", ""),
            "website_url": url,
            "created_at": time.time(),
        }

        # Email notification via SendGrid
        try:
            sendgrid_key = os.environ.get("SENDGRID_API_KEY")
            if sendgrid_key:
                demo_url = f"{SERVICE_URL}/demo/{slug}"
                requests.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {sendgrid_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "personalizations": [
                            {"to": [{"email": NOTIFY_EMAIL}]}
                        ],
                        "from": {
                            "email": "demos@j-squared.ca",
                            "name": "J-Squared Demo Factory",
                        },
                        "subject": f"🤖 New demo generated: {business_name}",
                        "content": [
                            {
                                "type": "text/html",
                                "value": f"""<h2>New demo generated</h2>
<p><strong>Business:</strong> {business_name}</p>
<p><strong>Trade:</strong> {data.get('trade', 'N/A')}</p>
<p><strong>Location:</strong> {data.get('location', 'N/A')}</p>
<p><strong>Their website:</strong> <a href="{url}">{url}</a></p>
<p><strong>Demo link:</strong> <a href="{demo_url}">{demo_url}</a></p>
<p><strong>Phone:</strong> {data.get('phone', 'N/A')}</p>
<p style="color:#888;font-size:12px;margin-top:20px;">Generated {time.strftime('%Y-%m-%d %H:%M UTC')}</p>""",
                            }
                        ],
                    },
                    timeout=10,
                )
        except Exception:
            pass  # Notification failure shouldn't kill the demo

        jobs[job_id] = {
            "status": "done",
            "slug": slug,
            "business_name": business_name,
        }

    except Exception as e:
        jobs[job_id] = {"status": "error", "error": str(e)}


# ── Routes ──────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/loading")
def loading():
    return send_from_directory("static", "loading.html")


@app.route("/demo/<slug>")
def demo_page(slug):
    return send_from_directory("static", "demo.html")


@app.route("/api/start", methods=["POST"])
def start():
    data = request.json or {}
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL required"}), 400

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "starting"}

    t = threading.Thread(target=generate_demo, args=(job_id, url))
    t.daemon = True
    t.start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def status(job_id):
    job = jobs.get(job_id, {"status": "not_found"})
    return jsonify(job)


@app.route("/api/demo/<slug>/config")
def demo_config(slug):
    demo = demos.get(slug)
    if not demo:
        return jsonify({"error": "Demo not found"}), 404
    return jsonify(
        {
            "business_name": demo["business_name"],
            "trade": demo["trade"],
            "tagline": demo["tagline"],
            "services": demo["services"],
            "location": demo["location"],
            "phone": demo["phone"],
            "hours": demo["hours"],
            "primary_color": demo["primary_color"],
            "logo_url": demo["logo_url"],
        }
    )


@app.route("/api/demo/<slug>/chat", methods=["POST"])
def demo_chat(slug):
    demo = demos.get(slug)
    if not demo:
        return jsonify({"error": "Demo not found"}), 404

    data = request.json or {}
    messages = data.get("messages", [])

    try:
        client = get_client()

        upsell_note = (
            "\n\nIMPORTANT — CTA RULE: After 4 or more exchanges, if the conversation is "
            "going well and the user seems engaged or satisfied, naturally weave in one "
            "brief mention that this AI assistant was built by J-Squared Digital, and "
            "that they build custom assistants like this for contractors. Keep it casual "
            "and non-salesy — one sentence max. Never repeat it. "
            f"Interested parties can reach out at: {BOOKING_LINK}"
        )

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": demo["system_prompt"] + upsell_note,
                }
            ]
            + messages,
            temperature=0.7,
            max_tokens=500,
        )

        return jsonify({"reply": response.choices[0].message.content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
