import os
import re
import json
import logging
import requests
from flask import Flask, request, jsonify
from openai import OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

GHL_TOKEN = os.environ.get("GHL_TOKEN", "pit-3b2b40f2-563c-41cc-b7fb-ede506e41ce3")
GHL_LOCATION_ID = os.environ.get("GHL_LOCATION_ID", "pmUzbbRzxGVF4bqXfdG5")
GHL_API_BASE = "https://services.leadconnectorhq.com"
THANK_YOU_URL = "https://premierdatingphotography.com/thank-you-for-contacting-pdp/"
BOOKING_URL = "https://premierdatingphotography.com/book-a-free-consultation/"

_openai_client = None

def get_client():
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _openai_client


SYSTEM_PROMPT = """You are the AI assistant for Premier Dating Photography — a professional dating profile photography and coaching service based in Austin, Texas.

YOUR ROLE: Pre-qualify visitors. Figure out what they want. If they're a good fit, collect their info. If not, handle them politely.

WHAT PDP OFFERS:
- Professional dating profile photoshoots (indoor/outdoor, wardrobe guidance, multiple looks)
- Dating coaching and profile optimization
- Headshots (professional and social)
- 5-step process: consultation → wardrobe planning → photoshoot → photo selection → profile optimization
- Money-back guarantee if not satisfied
- Booking page for free consultation: {booking_url}

PRICING:
- This is a professional, paid service. Packages start in the hundreds.
- Do NOT quote exact prices. If asked, say "packages vary — the free consultation covers pricing based on what you need."
- If someone asks "is this free?" or "does this cost money?" — yes, it's a paid professional service. The initial consultation is free.

QUALIFICATION RULES:

GOOD FIT (guide toward contact form):
- Wants better dating photos
- Wants help with dating profile / apps
- Wants professional photos for dating or social media
- Wants coaching on their dating approach
- Mentions specific apps (Hinge, Bumble, Tinder, etc.)
- Wants headshots
→ After 1-2 exchanges confirming their interest, say something like "Sounds like we can definitely help. Want me to connect you with the team?" and include the marker [SHOW_CONTACT_FORM] at the very end of your message (after your visible text).

NOT SURE / OFF TOPIC:
- Vague messages — ask a clarifying question to understand what they need
- Looking for a dating service / want to meet people — clarify that PDP does PHOTOGRAPHY and COACHING, not matchmaking. If they still seem confused, keep gently redirecting.
- Asking general questions about dating — you can chat briefly but steer toward "we help with the visual/profile side of dating"

BAD FIT (turn away politely):
- Clearly looking for escorts, hookups, or sexual services → "That's not what we do here. Premier Dating Photography helps people put their best foot forward with professional photos and coaching."
- Trolling or abusive → short, professional response. Don't engage.
- After 3+ exchanges of clearly off-topic conversation with no sign they want photography/coaching → "It doesn't sound like what we offer is quite what you're looking for. If you ever want to upgrade your dating photos, we're here!"

STYLE:
- Conversational but professional. Like a friendly receptionist.
- Short responses (1-3 sentences). Don't write essays.
- No filler affirmations ("Great question!", "Absolutely!", "That's wonderful!")
- No apologies or sympathy language
- Ask ONE question at a time

CONTACT FORM TRIGGER:
- When someone is clearly a good fit and ready, include [SHOW_CONTACT_FORM] at the END of your message (hidden from user, parsed by frontend).
- Only trigger this ONCE per conversation.
- Don't trigger it immediately — have at least one exchange first to confirm they're a real prospect.
- If someone says exactly what they want (e.g. "I need dating photos") you can trigger after your first response.
- NEVER trigger the form for someone who hasn't expressed interest in photography, coaching, or headshots.

BOOKING:
- If someone wants to skip the form and book directly, share this link: {booking_url}
- Frame it as: "You can book a free consultation directly here: {booking_url}"

Remember: Your job is to save the human team's time. Real prospects get through fast. Everyone else gets a polite, efficient conversation.""".format(
    booking_url=BOOKING_URL
)


# -------------------------------------------------
# Content moderation
# -------------------------------------------------
BLOCKLIST = [
    r"\bsex\b", r"\bnude\b", r"\bnaked\b", r"\bescort\b", r"\bhookup\b",
    r"\bprostitut", r"\bonly ?fans\b", r"\bsexual\b", r"\bporn\b",
    r"\bfetish\b", r"\bbdsm\b", r"\bpedophil",
]

def is_inappropriate(text: str) -> bool:
    t = text.lower()
    for pattern in BLOCKLIST:
        if re.search(pattern, t):
            return True
    return False


# -------------------------------------------------
# GHL contact creation
# -------------------------------------------------
def create_ghl_contact(data: dict) -> dict:
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()

    # Build notes from chat summary
    notes_parts = []
    if data.get("summary"):
        notes_parts.append(f"Chat summary: {data['summary']}")
    if data.get("message"):
        notes_parts.append(f"Additional message: {data['message']}")
    notes = "\n".join(notes_parts)

    tags = ["pdp-chat-lead"]

    payload = {
        "locationId": GHL_LOCATION_ID,
        "firstName": first_name,
        "lastName": last_name,
        "email": email,
        "phone": phone,
        "tags": tags,
        "source": "PDP AI Chat Qualifier",
    }

    headers = {
        "Authorization": f"Bearer {GHL_TOKEN}",
        "Content-Type": "application/json",
        "Version": "2021-07-28",
    }

    try:
        resp = requests.post(
            f"{GHL_API_BASE}/contacts/",
            json=payload,
            headers=headers,
            timeout=10,
        )
        if not resp.ok:
            logger.error(f"GHL contact creation failed: {resp.status_code} {resp.text}")
            return {"ok": False, "error": f"GHL {resp.status_code}: {resp.text}"}

        contact_id = resp.json().get("contact", {}).get("id")
        logger.info(f"GHL contact created: {contact_id}")

        if notes and contact_id:
            note_resp = requests.post(
                f"{GHL_API_BASE}/contacts/{contact_id}/notes",
                json={"body": notes, "userId": None},
                headers=headers,
                timeout=10,
            )
            if not note_resp.ok:
                logger.warning(f"GHL note failed: {note_resp.status_code} {note_resp.text}")

        return {"ok": True, "contact_id": contact_id}

    except Exception as e:
        logger.error(f"GHL request exception: {e}")
        return {"ok": False, "error": str(e)}


# -------------------------------------------------
# Routes
# -------------------------------------------------
@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json or {}
        messages = data.get("messages", [])

        if not messages:
            return jsonify({"error": "No messages provided"}), 400

        # Check latest user message for blocklist
        latest = messages[-1].get("content", "") if messages else ""
        if is_inappropriate(latest):
            return jsonify({
                "reply": "That's not what we do here. Premier Dating Photography helps people put their best foot forward with professional photos and coaching. Is there something along those lines I can help with?",
                "show_form": False,
            })

        # Build messages for OpenAI
        openai_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in messages:
            role = m.get("role", "user")
            if role in ("user", "assistant"):
                openai_messages.append({"role": role, "content": m.get("content", "")})

        resp = get_client().chat.completions.create(
            model="gpt-4o",
            messages=openai_messages,
            max_tokens=300,
            temperature=0.7,
        )

        reply = resp.choices[0].message.content.strip()

        # Check for contact form trigger
        show_form = "[SHOW_CONTACT_FORM]" in reply
        # Strip the marker from visible text
        reply = reply.replace("[SHOW_CONTACT_FORM]", "").strip()

        return jsonify({"reply": reply, "show_form": show_form})

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({
            "reply": "Sorry, something went wrong on my end. You can reach the team directly at premierdatingphotography.com.",
            "show_form": False,
        })


@app.route("/submit", methods=["POST"])
def submit():
    try:
        data = request.json or {}

        required = ["first_name", "email", "phone"]
        for field in required:
            if not data.get(field, "").strip():
                return jsonify({"ok": False, "error": f"Missing: {field}"}), 400

        email = data.get("email", "")
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return jsonify({"ok": False, "error": "Please enter a valid email"}), 400

        # Moderate the message field if present
        msg = data.get("message", "")
        if msg and is_inappropriate(msg):
            return jsonify({"ok": False, "blocked": True, "error": "Unable to process this request."}), 400

        result = create_ghl_contact(data)
        if not result["ok"]:
            logger.error(f"GHL failed, form data: {data}")

        return jsonify({"ok": True, "redirect": THANK_YOU_URL})

    except Exception as e:
        logger.error(f"Submit error: {e}")
        return jsonify({"ok": False, "error": "Something went wrong. Please try again."}), 500


# -------------------------------------------------
# Funnel analytics
# -------------------------------------------------
funnel = {
    "page_loads": 0,
    "chat_started": 0,     # sent first message
    "messages_sent": 0,     # total messages sent
    "form_shown": 0,        # AI triggered contact form
    "form_started": 0,      # user began filling form
    "submitted": 0,         # form submitted to GHL
    "blocked": 0,           # hit blocklist
    "bounced": 0,           # loaded page, no message sent (tracked client-side)
}

@app.route("/track", methods=["POST"])
def track_event():
    data = request.json or {}
    event = data.get("event", "")
    if event in funnel:
        funnel[event] += 1
    return jsonify({"ok": True})


@app.route("/stats")
def stats():
    f = funnel.copy()
    analysis = {}
    if f["page_loads"] > 0:
        analysis["engagement_rate"] = f"{round(f['chat_started'] / f['page_loads'] * 100)}%"
    if f["chat_started"] > 0:
        analysis["avg_messages"] = round(f["messages_sent"] / f["chat_started"], 1)
        analysis["form_trigger_rate"] = f"{round(f['form_shown'] / f['chat_started'] * 100)}%"
    if f["form_shown"] > 0:
        analysis["form_completion_rate"] = f"{round(f['submitted'] / f['form_shown'] * 100)}%"
    if f["page_loads"] > 0:
        analysis["overall_conversion"] = f"{round(f['submitted'] / f['page_loads'] * 100)}%"
    return jsonify({"funnel": f, "conversion_rates": analysis})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "ghl_configured": bool(GHL_LOCATION_ID)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
