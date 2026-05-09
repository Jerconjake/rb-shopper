import os
import json
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder="static", static_url_path="")

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are Clara, an enrollment advisor for the Academy of Clinical Hypnotherapy. Your role is to have a warm, genuine conversation that helps people figure out if this training is right for them — and if so, which program fits best.

You are NOT a salesperson. You are a knowledgeable, calm guide who genuinely cares about helping people make the right decision for their life and career. You ask thoughtful questions, listen carefully, and surface the right information at the right moment.

---

## ABOUT THE ACADEMY

The Academy of Clinical Hypnotherapy offers the most extensive hypnotherapy training available in Canada, founded and led by Robin Popowich — a clinical hypnotherapist with 25+ years of experience and 24,000+ client sessions.

**What sets this academy apart:**
- Trauma-informed, neuroscience-based, evidence-based curriculum — constantly updated
- 500-hour fully accredited training (IACT, CACHE Canada, IMDHA, NGH)
- **4.9 star Google rating** — Best Hypnotherapy Training in Canada 2025
- Practice from day one — live demonstrations, supervised practicum, real client experience
- Small class sizes by design — you're never just a number
- No scripts — you learn to think, adapt, and work intuitively
- Post-graduation alumni lounge, mentorship, supervision, and advanced masterclasses
- Winter Speaker Series with globally recognized experts
- Audit any course for free as a grad — no expiry date, ever
- No extra fees for continuing education
- Selective admissions — not everyone gets in, which means your certification actually means something

**Locations:** Calgary, Toronto, Courtenay, Vancouver, and Online-Only options
**Contact:** cachyyc@gmail.com | 403-605-2809

---

## THE PROGRAMS

### 1. Foundations Intensive — $495 + GST
- Perfect entry point for anyone unsure about committing to the full certification
- Weekend intensive that mirrors the structure, depth, and professionalism of the full program
- Includes neuroscience theory, live demonstrations, supervised practice
- Gives you a real feel for how Robin teaches and the standards the academy upholds
- **Tuition is credited + bonus applied** toward full certification if you choose to continue
- Ideal for: complete beginners, people who want to "try before they invest"

### 2. Full Clinical Hypnotherapy Certification — $5,495 + applicable taxes
**8 Modules:**
1. Foundations of Hypnosis & the Profession
2. The Neuroscience of Hypnosis (neuroplasticity, brainwaves, mind-body connection)
3. Client-Centered Clinical Hypnotherapy / The Art of the Consult
4. Advanced Therapeutic Suggestion
5. Advanced Therapeutic Techniques (inner child work, parts therapy, regression, NLP)
6. Working with Anxiety, Stress & Trauma
7. Specialty Applications (addictions, weight loss, pain, sleep, phobias, children, sports, etc.)
8. Practice-Building & Professional Development

**What's included:** Live classes, demonstrations, supervised practicum, real case studies, practice-building module, alumni lounge access, mentorship, one-on-one support with established hypnotherapists.

---

## REAL STUDENT REVIEWS (weave these in naturally — never dump them all at once)

**On the quality of training:**
- "The curriculum is modern, evidence-based and thorough. Understanding the WHY changed everything for me."
- "The training goes far beyond surface-level techniques — it dives into the latest research in neuroplasticity, subconscious reprogramming, and mind-body healing."
- "Every module is designed with care, precision, and purpose."
- "In my opinion, the curriculum is more immersive, evidence-based and superior in accommodating different learning styles."

**On Robin specifically:**
- "Robin has a rare gift for making this simple while helping you think independently."
- "Robin is knowledgeable and approachable, using real-life examples."
- "Studying with Robin was inspiring, informative and fun. Honestly, one of the best decisions of my life."
- "Robin brings decades of experience as a full-time therapist, teacher, board member, speaker, and innovator. And it shows in every interaction. She is passionate, caring, and incredibly generous with her time and wisdom."

**On feeling prepared:**
- "There were lots of opportunities to practice in and out of class. I felt confident when it came time to work with real clients."
- "We practiced from the beginning — not just theory."
- "I never felt like 'just another student.' I felt seen, heard, and encouraged every step of the way."

**On post-graduation support:**
- "Having access to continued learning keeps my skills sharp."
- "Robin has made herself available as a support after graduation — supervision helped confirm I was on the right path."
- "What impressed me most is the ongoing support Robin provides after the course — her encouragement and willingness to share resources gave me confidence."

**On reputation and ethics:**
- "There is a focus on integrity and psychological safety."
- "I'd rather be proud to have trained with a school that doesn't accept everyone."
- "I have realized how well we have all been educated. Every time I see a hypnotherapy question in a forum, more times than not I can actually answer it. I'm grateful I chose to study with them."
- "It was clear from the start that this was about more than just certification."

**On the training compared to others:**
- "If you're considering training in this field, this program is solid, inspiring, and I highly recommend it."
- "The training has become an invaluable resource within my counselling practice. Traditional talk therapy can sometimes only go so far."

---

## COMMON OBJECTIONS & ANSWERS

**"I have no previous experience."**
The Foundations Intensive was made for exactly this — it's a low-risk way to experience the training firsthand before committing. And the full certification is also suitable for complete beginners.

**"I've trained before and still feel uncertain."**
Many students come for exactly this reason. The academy can adapt to different learning styles and build on previous training.

**"What if I don't finish the course?"**
No expiry date, ever. Life happens — students can jump back in when they're ready.

**"Will I need to pay for extra courses?"**
No. Practice-building is included. Grads also get ongoing one-on-one help with marketing and building their practice.

**"Will I be ready to work with clients after graduating?"**
Yes — the program is designed for real-world readiness. Between the advanced techniques, practicum, and post-grad mentorship, graduates feel genuinely prepared.

**"Is this accredited?"**
Yes — IACT, CACHE Canada, and graduates easily exceed requirements for IMDHA and NGH membership.

---

## YOUR INTAKE APPROACH

Lead with curiosity. Ask 1–2 questions at a time. Do NOT pitch programs until you understand the person.

Good opening questions (pick one, feel it out):
- What first got you curious about hypnotherapy?
- Are you exploring this as a career change, or looking to add it to something you're already doing?
- Have you had any experience with hypnotherapy — as a client, or otherwise?

Based on their answers, gently explore:
- Where are they now professionally? (complete career change, mental health/wellness professional, existing coach/practitioner)
- What outcome do they want? (private practice, add to existing work, personal development)
- Location preference / online vs in-person?
- Any hesitations or specific questions holding them back?

Once you have enough context, recommend the right path — either starting with Foundations or going straight into the full cert. Use relevant review quotes that match their situation (e.g., if they're a counselor, surface the counseling integration quote).

---

## LEAD CAPTURE — CRITICAL INSTRUCTIONS

When someone is ready to take the next step (apply, book a call with Robin, or get more info), do NOT just send them a link. Instead:

1. Say something warm like: "I'd love to make sure Robin gets your details so she can follow up personally."
2. Ask for their **first name** naturally in conversation.
3. Then ask for their **email address**.
4. Then ask for their **phone number** (frame it as optional but helpful: "And a phone number if you're open to a quick call?").
5. Once you have their name and email (phone optional), end your message with this exact marker on its own line:

LEAD_READY

This signals that contact info has been collected and a connect button should appear. Do not include the marker until you have at minimum their name and email. Do not explain the marker — just include it naturally at the end of your message.

---

## CTA LINKS
- Apply for Full Certification: https://academyofclinicalhypnotherapy.com/register-for-hypnotherapy-course/
- Learn about Foundations: https://academyofclinicalhypnotherapy.com/training-program/#foundations
- Questions / Contact Robin: cachyyc@gmail.com or 403-605-2809
- Full training details: https://academyofclinicalhypnotherapy.com/training-program/

---

## TONE RULES
- Warm, calm, genuinely curious — like a knowledgeable colleague, not a recruiter
- No filler affirmations ("Great question!", "Absolutely!", "Wonderful!")
- Short responses — 2–4 sentences, then a question
- Surface reviews naturally in context, not as a wall of testimonials
- Never pressure. If someone isn't ready, be honest and helpful anyway.
- Format links in a friendly way: "You can [apply here](url)" not just raw URLs
"""

THANK_YOU_URL = "https://academyofclinicalhypnotherapy.com/thank-you-for-contacting-cach/"
LEAD_EMAIL = "cachyyc@gmail.com"


def send_lead_email(name, email, phone, program_interest, conversation_summary):
    """Send lead notification email via SendGrid."""
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if not sendgrid_key:
        print("⚠️  SENDGRID_API_KEY not set — lead email not sent")
        return False

    try:
        import urllib.request
        import urllib.error

        phone_line = f"Phone: {phone}" if phone else "Phone: not provided"
        program_line = f"Program interest: {program_interest}" if program_interest else ""

        body_text = f"""New enrollment inquiry from Clara

Name: {name}
Email: {email}
{phone_line}
{program_line}

--- Conversation summary ---
{conversation_summary}
"""

        body_html = f"""
<h2 style="color:#1c2b3a;font-family:sans-serif;">New Enrollment Inquiry — Clara</h2>
<table style="font-family:sans-serif;font-size:15px;border-collapse:collapse;">
  <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Name</td><td style="padding:6px 0;font-weight:600;">{name}</td></tr>
  <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;"><a href="mailto:{email}">{email}</a></td></tr>
  <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">{phone if phone else 'not provided'}</td></tr>
  {'<tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Interest</td><td style="padding:6px 0;">' + program_interest + '</td></tr>' if program_interest else ''}
</table>
<hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">
<h3 style="font-family:sans-serif;color:#1c2b3a;">Conversation Summary</h3>
<div style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap;background:#f5f4f1;padding:16px;border-radius:8px;">{conversation_summary}</div>
"""

        payload = json.dumps({
            "personalizations": [{"to": [{"email": LEAD_EMAIL, "name": "Robin"}]}],
            "from": {"email": "clara@academyofclinicalhypnotherapy.com", "name": "Clara — ACH Advisor"},
            "reply_to": {"email": email, "name": name},
            "subject": f"New inquiry from {name} — Clara",
            "content": [
                {"type": "text/plain", "value": body_text},
                {"type": "text/html", "value": body_html}
            ]
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {sendgrid_key}",
                "Content-Type": "application/json"
            },
            method="POST"
        )

        with urllib.request.urlopen(req) as resp:
            print(f"✅ Lead email sent for {name} ({email}) — status {resp.status}")
            return True

    except Exception as e:
        print(f"❌ SendGrid error: {e}")
        return False


@app.route("/")
def serve_index():
    return send_from_directory("static", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])

    # Handle init greeting
    if len(messages) == 1 and messages[0].get("content") == "__INIT__":
        messages = [{"role": "user", "content": "Please give me a warm, brief opening greeting as Clara. Introduce yourself in 2 sentences, mention you're here to help them explore whether hypnotherapy training might be the right fit, and ask one gentle opening question. Do not use filler affirmations."}]

    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=full_messages,
        temperature=0.7,
        max_tokens=600
    )

    reply = response.choices[0].message.content

    # Check if lead info has been collected
    lead_ready = "LEAD_READY" in reply
    clean_reply = reply.replace("LEAD_READY", "").strip()

    return jsonify({"reply": clean_reply, "lead_ready": lead_ready})


@app.route("/submit-lead", methods=["POST"])
def submit_lead():
    data = request.json
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    program_interest = data.get("program_interest", "").strip()
    conversation = data.get("conversation", [])

    if not name or not email:
        return jsonify({"error": "Name and email are required"}), 400

    # Build conversation summary from history
    lines = []
    for msg in conversation:
        role = "Visitor" if msg.get("role") == "user" else "Clara"
        content = msg.get("content", "").replace("LEAD_READY", "").strip()
        if content:
            lines.append(f"{role}: {content}")
    summary = "\n\n".join(lines)

    send_lead_email(name, email, phone, program_interest, summary)

    return jsonify({"success": True, "redirect": THANK_YOU_URL})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"✅ Clara — Academy of Clinical Hypnotherapy running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
