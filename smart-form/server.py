import os, json, sqlite3, time, re, secrets
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response, abort
from openai import OpenAI

app = Flask(__name__, static_folder='static')
_ai = None

def get_ai():
    global _ai
    if _ai is None:
        _ai = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    return _ai

ADMIN_PIN = os.environ.get('ADMIN_PIN', 'smart2025')

# ---------------------------------------------------------------------------
# SQLite — persistent config + ephemeral leads
# ---------------------------------------------------------------------------
DB = os.environ.get('DB_PATH', '/tmp/smartform.db')

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            business_name TEXT NOT NULL,
            business_description TEXT NOT NULL DEFAULT '',
            services TEXT NOT NULL DEFAULT '[]',
            wont_do TEXT NOT NULL DEFAULT '[]',
            notification_email TEXT NOT NULL DEFAULT '',
            brand_color TEXT NOT NULL DEFAULT '#2563eb',
            facebook_pixel_id TEXT NOT NULL DEFAULT '',
            google_ads_id TEXT NOT NULL DEFAULT '',
            google_ads_label TEXT NOT NULL DEFAULT '',
            thank_you_url TEXT NOT NULL DEFAULT '',
            solicitor_sheet_url TEXT NOT NULL DEFAULT '',
            job_sheet_url TEXT NOT NULL DEFAULT '',
            knowledge_base TEXT NOT NULL DEFAULT '',
            demo_mode INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            category TEXT NOT NULL,
            name TEXT, email TEXT, phone TEXT,
            message TEXT, ai_summary TEXT,
            estimated_value TEXT,
            conversation TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    db.commit()
    db.close()
    _seed_defaults()

# ---------------------------------------------------------------------------
# Seed default clients (survives Render restarts)
# ---------------------------------------------------------------------------
SEED_CLIENTS = {
    "premierdatingphotography": {
        "business_name": "Premier Dating Photography",
        "business_description": "Professional dating profile photography and coaching in Austin, TX. We help singles present their best selves on dating apps with professional photos, profile optimization, and dating coaching.",
        "services": [
            {"name": "Dating Profile Photo Shoot", "value": "$300 – $800", "priority": "high"},
            {"name": "Profile Optimization & Coaching", "value": "$150 – $400", "priority": "high"},
            {"name": "Full Dating Makeover Package", "value": "$500 – $1,200", "priority": "high"},
        ],
        "wont_do": [
            "Matchmaking or date arrangement",
            "Explicit or adult content",
            "Wedding or event photography",
            "General portrait photography unrelated to dating",
        ],
        "notification_email": "",
        "brand_color": "#000000",
        "thank_you_url": "https://premierdatingphotography.com/thank-you-for-contacting-pdp/",
    },
    "tsn": {
        "business_name": "TSN Custom Cabinets",
        "business_description": "Custom kitchen and bathroom cabinetry, full remodels, cabinet refacing, countertops, and custom built-ins in the Greater Toronto Area.",
        "services": [
            {"name": "Kitchen Remodels", "value": "$15,000 – $50,000+", "priority": "high"},
            {"name": "Bathroom Remodels", "value": "$8,000 – $25,000", "priority": "high"},
            {"name": "Cabinet Refacing", "value": "$3,000 – $8,000", "priority": "medium"},
            {"name": "Countertops", "value": "$1,500 – $5,000", "priority": "medium"},
            {"name": "Custom Built-ins", "value": "$2,000 – $10,000", "priority": "medium"},
        ],
        "wont_do": [
            "Painting individual cabinet doors",
            "Minor touch-ups or single-door repairs",
            "General contracting outside of cabinetry/counters",
            "Rentals or property management",
        ],
        "notification_email": "",
        "brand_color": "#2563eb",
    },
}

def _seed_defaults():
    db = get_db()
    for cid, cfg in SEED_CLIENTS.items():
        exists = db.execute('SELECT 1 FROM clients WHERE id=?', (cid,)).fetchone()
        if not exists:
            db.execute(
                '''INSERT INTO clients (id, business_name, business_description, services, wont_do,
                   notification_email, brand_color, thank_you_url) VALUES (?,?,?,?,?,?,?,?)''',
                (cid, cfg['business_name'], cfg['business_description'],
                 json.dumps(cfg['services']), json.dumps(cfg['wont_do']),
                 cfg.get('notification_email',''), cfg.get('brand_color','#2563eb'),
                 cfg.get('thank_you_url',''))
            )
    db.commit()
    db.close()

init_db()

# ---------------------------------------------------------------------------
# Helpers — load client config from DB
# ---------------------------------------------------------------------------
def get_client(client_id):
    db = get_db()
    row = db.execute('SELECT * FROM clients WHERE id=? AND active=1', (client_id,)).fetchone()
    db.close()
    if not row:
        return None
    cfg = dict(row)
    cfg['services'] = json.loads(cfg['services'])
    cfg['wont_do'] = json.loads(cfg['wont_do'])
    return cfg

def require_admin():
    pin = request.args.get('pin') or request.headers.get('X-Admin-Pin') or ''
    if not pin:
        body = request.get_json(silent=True) or {}
        pin = body.get('pin', '')
    if pin != ADMIN_PIN:
        abort(401)

# ---------------------------------------------------------------------------
# AI system prompt builder
# ---------------------------------------------------------------------------
def build_system_prompt(cfg):
    services = "\n".join(
        f"- {s['name']} ({s['value']}, {s['priority']} priority)" for s in cfg['services']
    )
    wont = "\n".join(f"- {w}" for w in cfg['wont_do'])

    return f"""You are an intelligent contact form assistant for {cfg['business_name']}.
{cfg['business_description']}

SERVICES OFFERED (with rough project values):
{services}

THINGS WE DO NOT DO:
{wont}

A visitor just submitted a contact form with their name, email, phone, and a written message.
Classify the submission into exactly ONE category:

1. QUALIFIED_LEAD — Genuine interest in a service we offer. Enough info to act on.
2. NEEDS_CLARIFICATION — Likely a lead but vague. Ask ONE short conversational question.
3. JOB_APPLICANT — Looking for employment or asking about hiring.
4. SOLICITOR — A vendor/agency/salesperson pitching their services.
5. SCOPE_MISMATCH — Wants something we don't do (painting one door, rentals, etc).

RULES:
- NEVER miss a real lead. If uncertain, classify NEEDS_CLARIFICATION — never SOLICITOR or SCOPE_MISMATCH.
- For NEEDS_CLARIFICATION: ask exactly ONE short question. Conversational, not a list.
- For SCOPE_MISMATCH: briefly mention what we actually do — they might pivot.
- For SOLICITOR / JOB_APPLICANT: be warm and brief. We keep their info on file.
- No filler phrases ("Great question!", "Absolutely!", "Wonderful!").
- All responses: 1–3 sentences maximum. Concise and natural.

Return ONLY this JSON — no markdown, no extra text:
{{
  "category": "QUALIFIED_LEAD",
  "confidence": 0.95,
  "summary": "Brief summary for the business owner (they read this in their email)",
  "response": "What the visitor sees — null if QUALIFIED_LEAD with enough info to act on",
  "estimated_value": "$X,XXX – $XX,XXX or null if unknown",
  "end_conversation": false
}}

Set "end_conversation": true when no further input is needed from the visitor
(QUALIFIED_LEAD with null response, SOLICITOR, JOB_APPLICANT after keeping on file).
Set it false when you need their reply (NEEDS_CLARIFICATION, SCOPE_MISMATCH with offer to redirect)."""

# ---------------------------------------------------------------------------
# Q&A assistant system prompt builder
# ---------------------------------------------------------------------------
def build_qa_prompt(cfg):
    return f"""You are a helpful assistant for {cfg['business_name']}.
{cfg['business_description']}

You answer general questions using ONLY the knowledge base below. If the answer isn't in the knowledge base, say you're not sure and suggest they fill out the contact form to speak with someone directly.

KNOWLEDGE BASE:
{cfg.get('knowledge_base', '')}

STRICT RULES:
- NEVER quote prices, cost ranges, or estimates — not even ballpark figures. If asked about pricing, say: "Every project is different — fill out the contact form and {cfg['business_name']} will get back to you with a proper quote."
- NEVER make promises about timelines, availability, or scheduling.
- NEVER speak on behalf of the owner or commit them to anything.
- Any question that requires professional judgment → "That's a great question for the team — fill out the contact form and they'll get back to you."
- Keep responses concise: 1–3 sentences. Conversational and helpful, not corporate.
- No filler phrases ("Great question!", "Absolutely!", "Wonderful!").

Return ONLY this JSON — no markdown, no extra text:
{{
  "response": "Your answer to the visitor's question",
  "is_buying_signal": false,
  "topic": "Brief topic label (e.g. 'service area', 'process', 'materials')"
}}

Set "is_buying_signal": true if the question suggests genuine purchase/project intent (e.g. asking about specific services, process for getting started, what they'd need to prepare). This flags it for the owner's transcript."""

# ---------------------------------------------------------------------------
# Routes — public config (subset, no secrets)
# ---------------------------------------------------------------------------
@app.route('/config/<client_id>')
def client_config(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'business_name': cfg['business_name'],
        'brand_color': cfg.get('brand_color', '#2563eb'),
        'facebook_pixel_id': cfg.get('facebook_pixel_id', ''),
        'google_ads_id': cfg.get('google_ads_id', ''),
        'google_ads_label': cfg.get('google_ads_label', ''),
        'thank_you_url': cfg.get('thank_you_url', ''),
        'demo_mode': bool(cfg.get('demo_mode', 0)),
        'has_knowledge_base': bool(cfg.get('knowledge_base', '').strip()),
    })

# ---------------------------------------------------------------------------
# Routes — AI classification
# ---------------------------------------------------------------------------
@app.route('/api/classify', methods=['POST'])
def classify():
    data = request.json or {}
    client_id = data.get('client_id', '')
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Unknown client'}), 404

    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    phone = data.get('phone', '').strip()
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'error': 'Message required'}), 400

    ai = get_ai()
    system = build_system_prompt(cfg)
    user_msg = f"Name: {name}\nEmail: {email}\nPhone: {phone}\n\nMessage:\n{message}"

    resp = ai.chat.completions.create(
        model='gpt-4o',
        messages=[
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user_msg},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    result = json.loads(resp.choices[0].message.content)

    # Save lead
    db = get_db()
    db.execute(
        '''INSERT INTO leads (client_id,category,name,email,phone,message,ai_summary,estimated_value,conversation)
           VALUES (?,?,?,?,?,?,?,?,?)''',
        (client_id, result['category'], name, email, phone, message,
         result.get('summary',''), result.get('estimated_value',''),
         json.dumps([{'role':'user','content':message}]))
    )
    lead_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    db.commit()
    db.close()

    is_demo = bool(cfg.get('demo_mode', 0))

    # Email owner for qualified leads (skip in demo mode)
    if result['category'] == 'QUALIFIED_LEAD' and not result.get('response') and not is_demo:
        _email_owner(cfg, result, name, email, phone, message)

    resp_data = {
        'category': result['category'],
        'response': result.get('response'),
        'end_conversation': result.get('end_conversation', False),
        'lead_id': lead_id,
    }

    # In demo mode, expose the full AI analysis
    if is_demo:
        resp_data['demo'] = {
            'category': result['category'],
            'confidence': result.get('confidence', 0),
            'summary': result.get('summary', ''),
            'estimated_value': result.get('estimated_value'),
            'would_email': bool(cfg.get('notification_email')),
            'email_recipient': cfg.get('notification_email', '(not configured)'),
        }

    return jsonify(resp_data)

# ---------------------------------------------------------------------------
# Routes — follow-up chat
# ---------------------------------------------------------------------------
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    client_id = data.get('client_id', '')
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Unknown client'}), 404

    lead_id = data.get('lead_id')
    message = data.get('message', '').strip()
    conversation = data.get('conversation', [])
    name = data.get('name', '')
    email = data.get('email', '')
    phone = data.get('phone', '')

    ai = get_ai()
    system = build_system_prompt(cfg) + """

This is a FOLLOW-UP message. The visitor already submitted the form and you asked a clarifying question.
Re-classify based on the full conversation so far.
If you now have enough info → QUALIFIED_LEAD with response: null, end_conversation: true.
Maximum 2 total follow-ups. If this is the second follow-up, resolve — lean toward QUALIFIED_LEAD if there's any real interest."""

    msgs = [{'role': 'system', 'content': system}]
    msgs.append({'role': 'user', 'content': f"Contact info — Name: {name}, Email: {email}, Phone: {phone}\n\nConversation so far:"})
    for m in conversation:
        msgs.append(m)
    msgs.append({'role': 'user', 'content': message})

    resp = ai.chat.completions.create(
        model='gpt-4o',
        messages=msgs,
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    result = json.loads(resp.choices[0].message.content)

    # Update conversation log
    conversation.append({'role': 'user', 'content': message})
    if result.get('response'):
        conversation.append({'role': 'assistant', 'content': result['response']})

    db = get_db()
    db.execute(
        'UPDATE leads SET category=?, ai_summary=?, estimated_value=?, conversation=? WHERE id=?',
        (result['category'], result.get('summary',''), result.get('estimated_value',''),
         json.dumps(conversation), lead_id)
    )
    db.commit()
    db.close()

    is_demo = bool(cfg.get('demo_mode', 0))

    # Email owner if now qualified (skip in demo mode)
    if result['category'] == 'QUALIFIED_LEAD' and not result.get('response') and not is_demo:
        full_msg = "\n".join(m['content'] for m in conversation if m['role'] == 'user')
        _email_owner(cfg, result, name, email, phone, full_msg)

    resp_data = {
        'category': result['category'],
        'response': result.get('response'),
        'end_conversation': result.get('end_conversation', False),
        'lead_id': lead_id,
    }

    if is_demo:
        resp_data['demo'] = {
            'category': result['category'],
            'confidence': result.get('confidence', 0),
            'summary': result.get('summary', ''),
            'estimated_value': result.get('estimated_value'),
            'would_email': bool(cfg.get('notification_email')),
            'email_recipient': cfg.get('notification_email', '(not configured)'),
        }

    return jsonify(resp_data)

# ---------------------------------------------------------------------------
# Routes — Q&A assistant (knowledge base chat)
# ---------------------------------------------------------------------------
@app.route('/api/qa/start', methods=['POST'])
def qa_start():
    data = request.json or {}
    client_id = data.get('client_id', '')
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Unknown client'}), 404

    if not cfg.get('knowledge_base', '').strip():
        return jsonify({'error': 'No knowledge base configured'}), 400

    name = data.get('name', '').strip()
    email = data.get('email', '').strip()

    if not name or not email:
        return jsonify({'error': 'Name and email required'}), 400

    # Create a lead record for this Q&A session
    db = get_db()
    db.execute(
        '''INSERT INTO leads (client_id,category,name,email,phone,message,ai_summary,estimated_value,conversation)
           VALUES (?,?,?,?,?,?,?,?,?)''',
        (client_id, 'AI_CHAT', name, email, '', '', 'AI chat session', '', json.dumps([]))
    )
    lead_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    db.commit()
    db.close()

    return jsonify({'lead_id': lead_id, 'ok': True})


@app.route('/api/qa/chat', methods=['POST'])
def qa_chat():
    data = request.json or {}
    client_id = data.get('client_id', '')
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Unknown client'}), 404

    lead_id = data.get('lead_id')
    message = data.get('message', '').strip()
    conversation = data.get('conversation', [])
    name = data.get('name', '')
    email = data.get('email', '')

    if not message:
        return jsonify({'error': 'Message required'}), 400

    ai = get_ai()
    system = build_qa_prompt(cfg)

    msgs = [{'role': 'system', 'content': system}]
    for m in conversation:
        msgs.append(m)
    msgs.append({'role': 'user', 'content': message})

    resp = ai.chat.completions.create(
        model='gpt-4o',
        messages=msgs,
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    result = json.loads(resp.choices[0].message.content)

    # Update conversation log
    conversation.append({'role': 'user', 'content': message})
    conversation.append({'role': 'assistant', 'content': result['response']})

    # Build summary from topics discussed
    topics = data.get('topics', [])
    if result.get('topic'):
        topics.append(result['topic'])
    topic_summary = ', '.join(dict.fromkeys(topics))  # dedupe, preserve order

    db = get_db()
    db.execute(
        '''UPDATE leads SET ai_summary=?, conversation=?, message=? WHERE id=?''',
        (f"AI chat — topics: {topic_summary}" if topic_summary else "AI chat session",
         json.dumps(conversation),
         '\n'.join(m['content'] for m in conversation if m['role'] == 'user'),
         lead_id)
    )
    db.commit()
    db.close()

    is_demo = bool(cfg.get('demo_mode', 0))

    # If buying signal detected, email the owner with transcript (skip in demo)
    if result.get('is_buying_signal') and not is_demo:
        _email_qa_transcript(cfg, name, email, conversation, topic_summary)

    resp_data = {
        'response': result['response'],
        'is_buying_signal': result.get('is_buying_signal', False),
        'topic': result.get('topic', ''),
    }

    if is_demo:
        resp_data['demo'] = {
            'is_buying_signal': result.get('is_buying_signal', False),
            'topic': result.get('topic', ''),
            'would_email': result.get('is_buying_signal', False) and bool(cfg.get('notification_email')),
        }

    return jsonify(resp_data)


@app.route('/api/qa/end', methods=['POST'])
def qa_end():
    """Called when user closes/leaves Q&A chat — emails transcript to owner."""
    # sendBeacon sends as text/plain, so handle both
    if request.is_json:
        data = request.json or {}
    else:
        try:
            data = json.loads(request.get_data(as_text=True))
        except:
            data = {}
    client_id = data.get('client_id', '')
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Unknown client'}), 404

    lead_id = data.get('lead_id')
    name = data.get('name', '')
    email = data.get('email', '')
    conversation = data.get('conversation', [])
    topics = data.get('topics', [])
    topic_summary = ', '.join(dict.fromkeys(topics))

    is_demo = bool(cfg.get('demo_mode', 0))

    # Always email transcript at end (if not already sent via buying signal, and not demo)
    if conversation and not is_demo:
        _email_qa_transcript(cfg, name, email, conversation, topic_summary)

    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Email Q&A transcript to business owner
# ---------------------------------------------------------------------------
def _email_qa_transcript(cfg, name, email, conversation, topics):
    notify = cfg.get('notification_email') or os.environ.get('NOTIFICATION_EMAIL', '')
    sg_key = os.environ.get('SENDGRID_API_KEY', '')
    if not notify or not sg_key:
        print(f"[AI CHAT] {cfg['business_name']}: {name} <{email}> — Topics: {topics}")
        return
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content

        sg = sendgrid.SendGridAPIClient(api_key=sg_key)
        biz = cfg['business_name']

        # Build transcript HTML
        transcript_html = ''
        for m in conversation:
            if m['role'] == 'user':
                transcript_html += f'<div style="background:#eff6ff;padding:10px 14px;border-radius:10px;margin:6px 0;margin-left:40px"><strong>{name}:</strong> {m["content"]}</div>'
            else:
                transcript_html += f'<div style="background:#f1f5f9;padding:10px 14px;border-radius:10px;margin:6px 0;margin-right:40px"><strong>AI:</strong> {m["content"]}</div>'

        html = f"""<div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto">
<div style="background:#6366f1;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
<h2 style="margin:0;font-size:18px">💬 AI Chat Engagement</h2>
<p style="margin:4px 0 0;font-size:13px;opacity:.85">Someone chatted with your AI assistant</p></div>
<div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px">
<p style="margin:0 0 8px"><strong>Name:</strong> {name}</p>
<p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
<p style="margin:0 0 16px"><strong>Topics discussed:</strong> {topics or 'General'}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
<p style="margin:0 0 12px;font-weight:600">Conversation:</p>
{transcript_html}
</div></div>"""

        mail = Mail(
            from_email=Email("leads@j-squared.ca", f"{biz} AI Chat"),
            to_emails=To(notify),
            subject=f"AI Chat — {name} asked about {topics or 'your business'}",
            html_content=Content("text/html", html),
        )
        sg.client.mail.send.post(request_body=mail.get())
    except Exception as e:
        print(f"QA email send error: {e}")


# ---------------------------------------------------------------------------
# Email notification to business owner (form leads)
# ---------------------------------------------------------------------------
def _email_owner(cfg, result, name, email, phone, message):
    notify = cfg.get('notification_email') or os.environ.get('NOTIFICATION_EMAIL', '')
    sg_key = os.environ.get('SENDGRID_API_KEY', '')
    if not notify or not sg_key:
        print(f"[LEAD] {cfg['business_name']}: {name} <{email}> — {result.get('summary','')}")
        return
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content

        sg = sendgrid.SendGridAPIClient(api_key=sg_key)
        biz = cfg['business_name']
        summary = result.get('summary', '')
        value = result.get('estimated_value', 'Not estimated')

        html = f"""<div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto">
<div style="background:#10b981;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
<h2 style="margin:0;font-size:18px">✅ New Qualified Lead</h2></div>
<div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px">
<p style="margin:0 0 8px"><strong>Name:</strong> {name}</p>
<p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
<p style="margin:0 0 8px"><strong>Phone:</strong> <a href="tel:{phone}">{phone}</a></p>
<p style="margin:0 0 16px"><strong>Est. Value:</strong> {value}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
<p style="margin:0 0 8px"><strong>Message:</strong></p>
<p style="background:#f9fafb;padding:14px;border-radius:8px;margin:0 0 16px;white-space:pre-wrap">{message}</p>
<p style="margin:0;color:#6b7280;font-size:13px"><strong>AI Summary:</strong> {summary}</p>
</div></div>"""

        mail = Mail(
            from_email=Email("leads@j-squared.ca", f"{biz} Leads"),
            to_emails=To(notify),
            subject=f"New Lead — {summary[:80]}",
            html_content=Content("text/html", html),
        )
        sg.client.mail.send.post(request_body=mail.get())
    except Exception as e:
        print(f"Email send error: {e}")

# ===========================================================================
# ADMIN API — PIN-protected
# ===========================================================================

# --- List all clients ---
@app.route('/admin/api/clients')
def admin_list_clients():
    require_admin()
    db = get_db()
    rows = db.execute('SELECT * FROM clients ORDER BY created_at DESC').fetchall()
    db.close()
    clients = []
    for r in rows:
        c = dict(r)
        c['services'] = json.loads(c['services'])
        c['wont_do'] = json.loads(c['wont_do'])
        clients.append(c)
    return jsonify(clients)

# --- Get single client ---
@app.route('/admin/api/clients/<client_id>')
def admin_get_client(client_id):
    require_admin()
    db = get_db()
    row = db.execute('SELECT * FROM clients WHERE id=?', (client_id,)).fetchone()
    db.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    c = dict(row)
    c['services'] = json.loads(c['services'])
    c['wont_do'] = json.loads(c['wont_do'])
    return jsonify(c)

# --- Create / update client ---
@app.route('/admin/api/clients', methods=['POST'])
def admin_save_client():
    require_admin()
    data = request.json or {}

    client_id = data.get('id', '').strip().lower()
    client_id = re.sub(r'[^a-z0-9_-]', '', client_id)
    if not client_id or len(client_id) < 2:
        return jsonify({'error': 'Client ID must be at least 2 characters (letters, numbers, hyphens)'}), 400

    biz_name = data.get('business_name', '').strip()
    if not biz_name:
        return jsonify({'error': 'Business name is required'}), 400

    services = data.get('services', [])
    wont_do = data.get('wont_do', [])

    db = get_db()
    existing = db.execute('SELECT 1 FROM clients WHERE id=?', (client_id,)).fetchone()

    if existing:
        db.execute('''UPDATE clients SET
            business_name=?, business_description=?, services=?, wont_do=?,
            notification_email=?, brand_color=?, facebook_pixel_id=?,
            google_ads_id=?, google_ads_label=?, thank_you_url=?,
            solicitor_sheet_url=?, job_sheet_url=?, knowledge_base=?,
            demo_mode=?, active=?,
            updated_at=CURRENT_TIMESTAMP
            WHERE id=?''',
            (biz_name, data.get('business_description',''), json.dumps(services), json.dumps(wont_do),
             data.get('notification_email',''), data.get('brand_color','#2563eb'),
             data.get('facebook_pixel_id',''), data.get('google_ads_id',''),
             data.get('google_ads_label',''), data.get('thank_you_url',''),
             data.get('solicitor_sheet_url',''), data.get('job_sheet_url',''),
             data.get('knowledge_base', ''),
             1 if data.get('demo_mode', False) else 0,
             1 if data.get('active', True) else 0, client_id)
        )
    else:
        db.execute('''INSERT INTO clients
            (id, business_name, business_description, services, wont_do,
             notification_email, brand_color, facebook_pixel_id,
             google_ads_id, google_ads_label, thank_you_url,
             solicitor_sheet_url, job_sheet_url, knowledge_base,
             demo_mode, active)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (client_id, biz_name, data.get('business_description',''),
             json.dumps(services), json.dumps(wont_do),
             data.get('notification_email',''), data.get('brand_color','#2563eb'),
             data.get('facebook_pixel_id',''), data.get('google_ads_id',''),
             data.get('google_ads_label',''), data.get('thank_you_url',''),
             data.get('solicitor_sheet_url',''), data.get('job_sheet_url',''),
             data.get('knowledge_base', ''),
             1 if data.get('demo_mode', False) else 0,
             1 if data.get('active', True) else 0)
        )

    db.commit()
    db.close()
    return jsonify({'ok': True, 'id': client_id})

# --- Delete client ---
@app.route('/admin/api/clients/<client_id>', methods=['DELETE'])
def admin_delete_client(client_id):
    require_admin()
    db = get_db()
    db.execute('DELETE FROM clients WHERE id=?', (client_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# --- Get leads for a client ---
@app.route('/admin/api/leads/<client_id>')
def admin_leads(client_id):
    require_admin()
    db = get_db()
    rows = db.execute(
        'SELECT * FROM leads WHERE client_id=? ORDER BY created_at DESC LIMIT 200',
        (client_id,)
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# --- Lead stats ---
@app.route('/admin/api/stats/<client_id>')
def admin_stats(client_id):
    require_admin()
    db = get_db()
    total = db.execute('SELECT COUNT(*) FROM leads WHERE client_id=?', (client_id,)).fetchone()[0]
    cats = db.execute(
        'SELECT category, COUNT(*) as cnt FROM leads WHERE client_id=? GROUP BY category',
        (client_id,)
    ).fetchall()
    db.close()
    return jsonify({
        'total': total,
        'by_category': {r['category']: r['cnt'] for r in cats}
    })

# ---------------------------------------------------------------------------
# Static / pages
# ---------------------------------------------------------------------------
@app.route('/embed.js')
def serve_embed():
    return send_from_directory('static', 'embed.js', mimetype='application/javascript')

@app.route('/form/<client_id>')
def form_page(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return "Not found", 404
    return send_from_directory('static', 'form.html')

@app.route('/landing/<client_id>')
def landing_page(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return "Not found", 404
    return send_from_directory('static', 'form.html')

@app.route('/admin')
def admin_page():
    return send_from_directory('static', 'admin.html')

@app.route('/')
def index():
    return '<p>SmartForm API — <a href="/admin">Admin Panel</a></p>', 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
