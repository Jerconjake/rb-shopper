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

_openai_client = None

def get_client():
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _openai_client


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


def ai_moderation_check(message: str) -> bool:
    """Returns True if message is inappropriate."""
    if not message or len(message.strip()) < 10:
        return False
    try:
        resp = get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a content moderator for a professional dating photography business. "
                        "Respond ONLY with the word BLOCK or ALLOW.\n"
                        "BLOCK if the message contains: sexual requests, solicitation, harassment, "
                        "inappropriate propositions, or anything clearly not about photography or coaching services.\n"
                        "ALLOW everything else — curiosity, budget questions, scheduling, even blunt messages."
                    ),
                },
                {"role": "user", "content": message},
            ],
            max_tokens=5,
            temperature=0,
        )
        verdict = resp.choices[0].message.content.strip().upper()
        return verdict == "BLOCK"
    except Exception as e:
        logger.warning(f"AI moderation failed: {e}")
        return False


# -------------------------------------------------
# GHL contact creation
# -------------------------------------------------
def create_ghl_contact(data: dict) -> dict:
    """
    Create or update a contact in GoHighLevel.
    Returns {"ok": True} or {"ok": False, "error": str}
    """
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    city = data.get("city", "").strip()
    services = data.get("services", [])
    situation = data.get("situation", "").strip()
    message = data.get("message", "").strip()
    mismatched = data.get("mismatched", False)

    tags = ["pdp-form-lead"]
    if mismatched:
        tags.append("mismatched-intent")

    notes_parts = []
    if services:
        notes_parts.append(f"Interested in: {', '.join(services)}")
    if situation:
        notes_parts.append(f"Their situation: {situation}")
    if city:
        notes_parts.append(f"City: {city}")
    if message:
        notes_parts.append(f"Message: {message}")
    if mismatched:
        notes_parts.append("Note: Visitor initially indicated interest in meeting people (soft-gated, chose to continue)")
    notes = "\n".join(notes_parts)

    payload = {
        "locationId": GHL_LOCATION_ID,
        "firstName": first_name,
        "lastName": last_name,
        "email": email,
        "phone": phone,
        "address1": city,
        "tags": tags,
        "source": "Premier Dating Photography Form",
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

        # Add note if there's content
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


# -------------------------------------------------
# AI qualification of free-text input
# -------------------------------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        text = (request.json or {}).get("text", "").strip()
        if not text:
            return jsonify({"classification": "unclear", "followup": "Could you tell us a bit about what's going on with your dating life?"})

        # Quick blocklist check first
        if is_inappropriate(text):
            return jsonify({"classification": "blocked"})

        resp = get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You classify messages from visitors to a dating photography & coaching website. "
                        "Respond with ONLY valid JSON, no markdown.\n\n"
                        "Categories:\n"
                        '- "good" — They want better dating photos, profile help, coaching, more matches, '
                        "or anything related to improving their dating presence. Be generous here — "
                        "anyone talking about dating struggles, apps, photos, or wanting to improve counts.\n"
                        '- "unclear" — Vague, off-topic, or you can\'t tell what they want. '
                        "Include a friendly follow-up question that steers them toward our services.\n"
                        '- "blocked" — Sexual, inappropriate, or clearly trolling.\n\n'
                        'JSON format: {"classification": "good|unclear|blocked", "followup": "..." (only for unclear)}\n'
                        "The followup should be warm and conversational, gently redirecting toward photos/coaching."
                    ),
                },
                {"role": "user", "content": text},
            ],
            max_tokens=150,
            temperature=0.3,
        )
        raw = resp.choices[0].message.content.strip()
        # Parse JSON from response
        import json as _json
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = _json.loads(raw)
        return jsonify(result)

    except Exception as e:
        logger.warning(f"Analyze error: {e}")
        # On error, let them through
        return jsonify({"classification": "good"})


@app.route("/submit", methods=["POST"])
def submit():
    try:
        data = request.json or {}

        # Basic validation
        required = ["first_name", "email", "phone"]
        for field in required:
            if not data.get(field, "").strip():
                return jsonify({"ok": False, "error": f"Missing required field: {field}"}), 400

        email = data.get("email", "")
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return jsonify({"ok": False, "error": "Please enter a valid email address"}), 400

        # Content moderation
        message = data.get("message", "")
        if is_inappropriate(message) or ai_moderation_check(message):
            return jsonify({
                "ok": False,
                "blocked": True,
                "error": "We're not able to process this request."
            }), 400

        # Create GHL contact
        result = create_ghl_contact(data)
        if not result["ok"]:
            logger.error(f"GHL failed, form data: {data}")
            # Still redirect — don't break the user experience for a CRM failure
            return jsonify({"ok": True, "redirect": THANK_YOU_URL})

        return jsonify({"ok": True, "redirect": THANK_YOU_URL})

    except Exception as e:
        logger.error(f"Submit error: {e}")
        return jsonify({"ok": False, "error": "Something went wrong. Please try again."}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok", "ghl_location_configured": bool(GHL_LOCATION_ID)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
