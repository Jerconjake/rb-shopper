import os, json, hashlib, hmac, time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI
import psycopg2
import psycopg2.extras
import sendgrid
from sendgrid.helpers.mail import Mail

app = Flask(__name__, static_folder="static")
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

DATABASE_URL = os.environ.get("DATABASE_URL")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@j-squared.ca")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "heather@nurserelief.ca")
ADMIN_PIN = os.environ.get("ADMIN_PIN", "nr2025")

NURSE_TYPES = [
    "Registered Nurse (RN)",
    "Nurse Practitioner (NP)",
    "Licensed Practical Nurse (LPN)",
    "Registered Psychiatric Nurse (RPN)",
    "Personal Support Worker (PSW)",
]

SPECIALTIES = [
    "Labor and Delivery", "Operating Room", "Community Health", "Medicine",
    "Surgery", "Neurology", "ICU", "Long Term Care", "Pediatrics", "Clinic",
    "Home Care", "Critical Care", "Cardiology", "Teaching", "Management",
    "Outpost", "Nephrology", "Emergency", "Flight", "Obstetrics",
    "Post Partum", "Palliative Care", "Infusion Nurse", "Occupational",
    "Health Nurse", "Mental Health", "Dialysis",
]

# ── DB ─────────────────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DATABASE_URL)

def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS nurse_relief_leads (
                    id SERIAL PRIMARY KEY,
                    path TEXT NOT NULL,          -- 'nurse' | 'facility' | 'general'
                    name TEXT,
                    email TEXT,
                    phone TEXT,
                    org_name TEXT,
                    nurse_type TEXT,
                    registration_number TEXT,
                    province TEXT,
                    specialties TEXT,            -- comma-separated
                    availability TEXT,
                    message TEXT,
                    ai_category TEXT,            -- 'genuine' | 'noise' | 'facility' | 'general_qualified' | 'general_unqualified'
                    ai_summary TEXT,
                    notified INTEGER DEFAULT 0,  -- 1 if email sent to owner
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS nurse_relief_chat (
                    id SERIAL PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            conn.commit()

try:
    init_db()
except Exception as e:
    print(f"DB init error: {e}")

# ── helpers ────────────────────────────────────────────────────────────────────

def send_email(to, subject, body_html):
    if not SENDGRID_API_KEY:
        print(f"[NO SENDGRID] Would send to {to}: {subject}")
        return
    try:
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        msg = Mail(
            from_email=SENDGRID_FROM_EMAIL,
            to_emails=to,
            subject=subject,
            html_content=body_html,
        )
        sg.send(msg)
    except Exception as e:
        print(f"SendGrid error: {e}")

def classify_nurse_message(nurse_type, registration_number, specialties, message):
    """Ask GPT if this nurse submission looks genuine."""
    prompt = f"""You are reviewing a nurse job application for a staffing agency.
    
Nurse type: {nurse_type}
Registration number provided: {registration_number or 'none'}
Specialties selected: {specialties or 'none'}
Message: {message}

Is this a genuine nurse applicant worth the agency's time, or does this look like noise (random clicking, bot, gibberish, no real intent)?

Respond with JSON only:
{{
  "category": "genuine" or "noise",
  "summary": "1-2 sentence brief for the owner if genuine, or reason if noise",
  "confidence": 0.0-1.0
}}"""
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        print(f"Classify error: {e}")
        return {"category": "genuine", "summary": "Classification unavailable.", "confidence": 0.5}


NURSE_CHAT_SYSTEM = """You are a professional intake assistant for Nurse Relief Inc., an Alberta-based nursing staffing agency placing nurses with healthcare facilities across Western Canada.

Your role is to ask the nurse applicant 1–2 follow-up questions to better understand their background and what they're looking for. You already have their name, designation, registration number, province, specialties, and availability — do NOT ask for those again.

What to uncover (pick what's most relevant based on what they say):
- Depth of clinical experience (years, settings — hospital, LTC, home care, fly-in/fly-out)
- What types of facilities or roles interest them most
- Why they're considering agency/relief work (flexibility, extra income, travel, between positions)
- Any preferences around shift length, geography, or travel willingness

Rules:
- Ask only 1–2 questions per reply. Conversational, not interrogative.
- Be warm and professional — tone of a colleague, not a form.
- Do NOT ask for info already collected.
- After exactly 2 user turns AND you have a clear picture, end your reply with exactly: [READY_TO_SUBMIT]
- If after 1 turn they're clearly not a nurse (confused, spammy, no nursing context), ask one clarifying question — then after their second turn, append [READY_TO_SUBMIT] regardless (the AI gate handles final screening).
- Never submit on the first turn."""

GENERAL_SYSTEM = """You are a professional intake assistant for Nurse Relief Inc., an Alberta-based nursing staffing agency that places nurses with healthcare facilities across Western Canada.

Your job: understand what the person needs and gather enough to pass them to the right person on the team.

Two types come through this channel:
1. Healthcare facilities looking to staff nurses — highest priority; collect organization name, what type of nurses they need, and timeline. 2 exchanges max then submit.
2. General questions — answer briefly if you can, then ask what specifically prompted them to reach out.

Rules:
- If the first message is vague, short, or unintelligible (e.g. "what is this", "hi", "?"), respond with a brief explanation of what Nurse Relief does and ask what brought them here. Do NOT submit yet.
- Never submit on the first exchange under any circumstances — always ask at least one follow-up question first.
- You must have: their name (already collected), a clear reason for contact, and enough detail to brief the team. Only then end your reply with exactly: [READY_TO_SUBMIT]
- Keep replies to 1-3 sentences. No filler affirmations. Professional, direct, warm.
- Do not ask for information already collected (name, email, phone are already captured)."""

def chat_general(session_id, user_message):
    """Handle general inquiry AI chat."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role, content FROM nurse_relief_chat WHERE session_id=%s ORDER BY created_at",
                (session_id,)
            )
            history = [{"role": r, "content": c} for r, c in cur.fetchall()]

    history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": GENERAL_SYSTEM}] + history[-12:]

    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=300,
        )
        reply = resp.choices[0].message.content.strip()
    except Exception as e:
        reply = "Thank you — a member of the Nurse Relief team will be in touch shortly."

    # Never submit on the first exchange — require at least 2 user turns
    turn_count = sum(1 for m in history if m["role"] == "user")
    ready = "[READY_TO_SUBMIT]" in reply and turn_count >= 2
    reply_clean = reply.replace("[READY_TO_SUBMIT]", "").strip()

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO nurse_relief_chat (session_id, role, content) VALUES (%s,%s,%s),(%s,%s,%s)",
                (session_id, "user", user_message, session_id, "assistant", reply_clean)
            )
            conn.commit()

    return reply_clean, ready, history

# ── routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory("static", path)

@app.route("/admin")
def admin():
    return send_from_directory("static", "admin.html")

@app.route("/version")
def version():
    return jsonify({"version": "nurse-relief-form-1.0.0", "status": "ok"})


@app.route("/api/submit-nurse", methods=["POST"])
def submit_nurse():
    """Structured nurse application path."""
    data = request.json or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    nurse_type = data.get("nurse_type", "").strip()
    registration_number = data.get("registration_number", "").strip()
    province = data.get("province", "").strip()
    specialties = data.get("specialties", "")  # comma-separated string
    availability = data.get("availability", "").strip()
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Message is required."}), 400
    if not name or not email:
        return jsonify({"error": "Name and email are required."}), 400

    # AI classification
    result = classify_nurse_message(nurse_type, registration_number, specialties, message)
    category = result.get("category", "genuine")
    ai_summary = result.get("summary", "")

    notified = 0

    if category == "genuine":
        # Build email for Heather
        specialties_list = specialties if specialties else "Not specified"
        html = f"""
<h2>New Nurse Application — Nurse Relief Inc.</h2>
<table style="border-collapse:collapse;width:100%">
  <tr><td style="padding:6px;font-weight:bold;width:180px">Name</td><td style="padding:6px">{name}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Email</td><td style="padding:6px">{email}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Phone</td><td style="padding:6px">{phone or '—'}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Nurse Type</td><td style="padding:6px">{nurse_type or '—'}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Registration #</td><td style="padding:6px">{registration_number or '—'}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Province</td><td style="padding:6px">{province or '—'}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Specialties</td><td style="padding:6px">{specialties_list}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Availability</td><td style="padding:6px">{availability or '—'}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Message</td><td style="padding:6px">{message}</td></tr>
</table>
<hr>
<p><strong>AI Summary:</strong> {ai_summary}</p>
"""
        send_email(OWNER_EMAIL, f"New Nurse Application: {name}", html)
        notified = 1

    # Store in DB
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO nurse_relief_leads
                  (path, name, email, phone, nurse_type, registration_number, province, specialties, availability, message, ai_category, ai_summary, notified)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, ("nurse", name, email, phone, nurse_type, registration_number, province,
                  specialties, availability, message, category, ai_summary, notified))
            conn.commit()

    return jsonify({
        "status": "ok",
        "genuine": category == "genuine",
        "message": "Application received. We'll be in touch shortly." if category == "genuine"
                   else "Thank you — your information has been recorded.",
    })


@app.route("/api/submit-facility", methods=["POST"])
def submit_facility():
    """Healthcare facility inquiry — always fires."""
    data = request.json or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    org_name = data.get("org_name", "").strip()
    message = data.get("message", "").strip()

    if not name or not email:
        return jsonify({"error": "Name and email are required."}), 400

    html = f"""
<h2>New Facility Inquiry — Nurse Relief Inc.</h2>
<table style="border-collapse:collapse;width:100%">
  <tr><td style="padding:6px;font-weight:bold;width:180px">Contact Name</td><td style="padding:6px">{name}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Organization</td><td style="padding:6px">{org_name or '—'}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Email</td><td style="padding:6px">{email}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Phone</td><td style="padding:6px">{phone or '—'}</td></tr>
  <tr><td style="padding:6px;font-weight:bold">Message</td><td style="padding:6px">{message or '—'}</td></tr>
</table>
"""
    send_email(OWNER_EMAIL, f"New Facility Inquiry: {org_name or name}", html)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO nurse_relief_leads
                  (path, name, email, phone, org_name, message, ai_category, notified)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, ("facility", name, email, phone, org_name, message, "facility", 1))
            conn.commit()

    return jsonify({"status": "ok", "message": "Thank you! A member of our team will reach out shortly."})


def chat_nurse(session_id, user_message):
    """Handle nurse qualification chat — 2 turns then ready."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role, content FROM nurse_relief_chat WHERE session_id=%s ORDER BY created_at",
                (session_id,)
            )
            history = [{"role": r, "content": c} for r, c in cur.fetchall()]

    history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": NURSE_CHAT_SYSTEM}] + history[-10:]

    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=250,
        )
        reply = resp.choices[0].message.content.strip()
    except Exception as e:
        reply = "Thank you — that's helpful. We'll be in touch soon. [READY_TO_SUBMIT]"

    turn_count = sum(1 for m in history if m["role"] == "user")
    ready = "[READY_TO_SUBMIT]" in reply and turn_count >= 2
    reply_clean = reply.replace("[READY_TO_SUBMIT]", "").strip()

    # Build transcript
    transcript_parts = []
    for m in history:
        label = "You" if m["role"] == "user" else "Nurse Relief"
        transcript_parts.append(f"{label}: {m['content']}")
    transcript_parts.append(f"Nurse Relief: {reply_clean}")
    transcript = "\n".join(transcript_parts)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO nurse_relief_chat (session_id, role, content) VALUES (%s,%s,%s),(%s,%s,%s)",
                (session_id, "user", user_message, session_id, "assistant", reply_clean)
            )
            conn.commit()

    return reply_clean, ready, transcript


@app.route("/api/chat-nurse", methods=["POST"])
def api_chat_nurse():
    """Nurse qualification chat endpoint."""
    data = request.json or {}
    session_id = data.get("session_id", "")
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "Message required"}), 400

    reply, ready, transcript = chat_nurse(session_id, user_message)
    return jsonify({"reply": reply, "ready": ready, "transcript": transcript})


@app.route("/api/chat-general", methods=["POST"])
def api_chat_general():
    """General inquiry AI chat."""
    data = request.json or {}
    session_id = data.get("session_id", "")
    user_message = data.get("message", "").strip()
    name = data.get("name", "")
    email = data.get("email", "")
    phone = data.get("phone", "")

    if not user_message:
        return jsonify({"error": "Message required"}), 400

    reply, ready, history = chat_general(session_id, user_message)

    if ready:
        # Build transcript
        transcript = "\n".join(
            f"{'You' if m['role']=='user' else 'Bot'}: {m['content']}"
            for m in history
        ) + f"\nYou: {user_message}\nBot: {reply}"

        # Classify quality
        try:
            classification = client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": f"Is this a genuine inquiry worth following up on? Reply JSON: {{\"genuine\": true/false, \"summary\": \"brief\"}}\n\n{transcript}"
                }],
                temperature=0,
                response_format={"type": "json_object"},
            )
            cl = json.loads(classification.choices[0].message.content)
            genuine = cl.get("genuine", True)
            ai_summary = cl.get("summary", "")
        except:
            genuine = True
            ai_summary = ""

        notified = 0
        if genuine and email:
            html = f"""
<h2>New General Inquiry — Nurse Relief Inc.</h2>
<p><strong>Name:</strong> {name}<br>
<strong>Email:</strong> {email}<br>
<strong>Phone:</strong> {phone or '—'}</p>
<p><strong>AI Summary:</strong> {ai_summary}</p>
<hr>
<h3>Conversation</h3>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px">{transcript}</pre>
"""
            send_email(OWNER_EMAIL, f"New General Inquiry: {name}", html)
            notified = 1

        category = "general_qualified" if genuine else "general_unqualified"
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO nurse_relief_leads
                      (path, name, email, phone, message, ai_category, ai_summary, notified)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """, ("general", name, email, phone, transcript, category, ai_summary, notified))
                conn.commit()

    return jsonify({"reply": reply, "ready": ready})


@app.route("/api/leads", methods=["GET"])
def api_leads():
    """Admin: list all leads."""
    pin = request.args.get("pin", "")
    if pin != ADMIN_PIN:
        return jsonify({"error": "Unauthorized"}), 401
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM nurse_relief_leads ORDER BY created_at DESC LIMIT 200")
            rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
