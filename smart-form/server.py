import os, json, time, re, secrets
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response, abort
from openai import OpenAI
import requests as http_requests

app = Flask(__name__, static_folder='static')
_ai = None

def get_ai():
    global _ai
    if _ai is None:
        _ai = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    return _ai

ADMIN_PIN = os.environ.get('ADMIN_PIN', 'smart2025')

# ---------------------------------------------------------------------------
# Database — Postgres (production) or SQLite (local dev)
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get('DATABASE_URL', '')
_PG = bool(DATABASE_URL)

if _PG:
    import psycopg2, psycopg2.extras
else:
    import sqlite3

def get_db():
    if _PG:
        return psycopg2.connect(DATABASE_URL)
    else:
        conn = sqlite3.connect(os.environ.get('DB_PATH', '/tmp/smartform.db'))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

def _q(sql):
    return sql.replace('?', '%s') if _PG else sql

def db_one(conn, sql, params=()):
    if _PG:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(_q(sql), params)
        row = cur.fetchone()
        return dict(row) if row else None
    else:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None

def db_all(conn, sql, params=()):
    if _PG:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(_q(sql), params)
        return [dict(r) for r in cur.fetchall()]
    else:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]

def db_exec(conn, sql, params=()):
    if _PG:
        cur = conn.cursor()
        cur.execute(_q(sql), params)
        return cur
    else:
        return conn.execute(sql, params)

def db_insert_id(conn, sql, params=()):
    if _PG:
        sql_pg = _q(sql).rstrip().rstrip(';') + ' RETURNING id'
        cur = conn.cursor()
        cur.execute(sql_pg, params)
        return cur.fetchone()[0]
    else:
        return conn.execute(sql, params).lastrowid

def _pg_add_col(conn, table, col, typedef):
    """Safely add a column to a Postgres table (no-op if exists)."""
    old = conn.autocommit
    conn.autocommit = True
    try:
        cur = conn.cursor()
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}")
    except Exception:
        pass
    finally:
        conn.autocommit = old

# ---------------------------------------------------------------------------
# Schema + init
# ---------------------------------------------------------------------------
CLIENTS_COLS = """
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
    ghl_api_token TEXT NOT NULL DEFAULT '',
    ghl_location_id TEXT NOT NULL DEFAULT '',
    ghl_tag TEXT NOT NULL DEFAULT 'SmartForm Lead',
    dashboard_pin TEXT NOT NULL DEFAULT '',
    demo_mode INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
"""

def init_db():
    conn = get_db()
    if _PG:
        cur = conn.cursor()
        cur.execute(f"CREATE TABLE IF NOT EXISTS clients ({CLIENTS_COLS})")
        cur.execute("""CREATE TABLE IF NOT EXISTS leads (
            id SERIAL PRIMARY KEY,
            client_id TEXT NOT NULL,
            category TEXT NOT NULL,
            name TEXT, email TEXT, phone TEXT,
            message TEXT, ai_summary TEXT,
            estimated_value TEXT,
            conversation TEXT,
            ghl_contact_id TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.commit()
        # Migrations for future column adds
        for col, td in [
            ('ghl_api_token', "TEXT NOT NULL DEFAULT ''"),
            ('ghl_location_id', "TEXT NOT NULL DEFAULT ''"),
            ('ghl_tag', "TEXT NOT NULL DEFAULT 'SmartForm Lead'"),
            ('dashboard_pin', "TEXT NOT NULL DEFAULT ''"),
        ]:
            _pg_add_col(conn, 'clients', col, td)
        _pg_add_col(conn, 'leads', 'ghl_contact_id', "TEXT DEFAULT ''")
    else:
        conn.executescript(f"""
            CREATE TABLE IF NOT EXISTS clients ({CLIENTS_COLS});
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL,
                category TEXT NOT NULL,
                name TEXT, email TEXT, phone TEXT,
                message TEXT, ai_summary TEXT,
                estimated_value TEXT,
                conversation TEXT,
                ghl_contact_id TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
    conn.close()
    _seed_defaults()

# ---------------------------------------------------------------------------
# Seed default clients (survives restarts)
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
        "ghl_api_token": "pit-3b2b40f2-563c-41cc-b7fb-ede506e41ce3",
        "ghl_location_id": "pmUzbbRzxGVF4bqXfdG5",
        "ghl_tag": "SmartForm Lead",
        "dashboard_pin": "pdp2025",
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
    conn = get_db()
    for cid, cfg in SEED_CLIENTS.items():
        row = db_one(conn, 'SELECT 1 FROM clients WHERE id=?', (cid,))
        if not row:
            db_exec(conn, '''INSERT INTO clients
                (id, business_name, business_description, services, wont_do,
                 notification_email, brand_color, thank_you_url,
                 ghl_api_token, ghl_location_id, ghl_tag, dashboard_pin)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
                (cid, cfg['business_name'], cfg['business_description'],
                 json.dumps(cfg['services']), json.dumps(cfg['wont_do']),
                 cfg.get('notification_email',''), cfg.get('brand_color','#2563eb'),
                 cfg.get('thank_you_url',''),
                 cfg.get('ghl_api_token',''), cfg.get('ghl_location_id',''),
                 cfg.get('ghl_tag','SmartForm Lead'), cfg.get('dashboard_pin',''))
            )
        else:
            # Update GHL fields if currently empty (handles pre-existing seeds)
            if cfg.get('ghl_api_token'):
                db_exec(conn,
                    "UPDATE clients SET ghl_api_token=?, ghl_location_id=?, ghl_tag=?, dashboard_pin=? WHERE id=? AND (ghl_api_token='' OR ghl_api_token IS NULL)",
                    (cfg['ghl_api_token'], cfg.get('ghl_location_id',''),
                     cfg.get('ghl_tag','SmartForm Lead'), cfg.get('dashboard_pin',''), cid))
    conn.commit()
    conn.close()

init_db()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_client(client_id):
    conn = get_db()
    row = db_one(conn, 'SELECT * FROM clients WHERE id=? AND active=1', (client_id,))
    conn.close()
    if not row:
        return None
    row['services'] = json.loads(row['services'])
    row['wont_do'] = json.loads(row['wont_do'])
    return row

def require_admin():
    pin = request.args.get('pin') or request.headers.get('X-Admin-Pin') or ''
    if not pin:
        body = request.get_json(silent=True) or {}
        pin = body.get('pin', '')
    if pin != ADMIN_PIN:
        abort(403)

def require_dashboard(cfg):
    """Check dashboard PIN (per-client) or admin PIN."""
    pin = request.args.get('pin') or ''
    dash_pin = cfg.get('dashboard_pin', '')
    if dash_pin and pin == dash_pin:
        return True
    if pin == ADMIN_PIN:
        return True
    return False

# ---------------------------------------------------------------------------
# AI system prompt — IMPROVED for lead qualification
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
2. NEEDS_CLARIFICATION — Likely a lead but vague. Ask ONE short conversational question to qualify them.
3. JOB_APPLICANT — Looking for employment or asking about hiring.
4. SOLICITOR — A vendor/agency/salesperson pitching their services TO us.
5. SCOPE_MISMATCH — Wants something we explicitly don't do.

CRITICAL RULES — READ CAREFULLY:
- YOUR JOB IS TO QUALIFY LEADS, NOT FILTER THEM OUT. You are a helpful salesperson, not a bouncer.
- Questions about pricing, cost, "is it free?", "how much?" = an INTERESTED prospect. NEVER end the conversation on a pricing question. Classify as NEEDS_CLARIFICATION. Briefly address pricing context (e.g. "We have packages at different price points") AND ask what specifically they're looking for.
- Vague messages like "interested", "tell me more", "looking for info", "just checking" = NEEDS_CLARIFICATION. Engage them with a specific question about what they need.
- If someone mentions ANYTHING related to our services, even loosely, classify NEEDS_CLARIFICATION and draw out what they need.
- Only classify SOLICITOR if they are CLEARLY selling a product or service TO us (SEO agency, marketing vendor, software pitch, etc.).
- Only classify SCOPE_MISMATCH if they explicitly want something we definitely don't do AND there's no overlap.
- For SCOPE_MISMATCH: briefly mention what we actually do — they might pivot. Keep reply input enabled (end_conversation: false).
- For SOLICITOR / JOB_APPLICANT: be warm and brief. We keep their info on file. Set end_conversation: true.
- When uncertain between categories, ALWAYS lean toward NEEDS_CLARIFICATION.
- No filler phrases ("Great question!", "Absolutely!", "Wonderful!").
- All responses: 1–3 sentences max. Conversational and natural.
- When asking a clarifying question, make it specific to what the visitor mentioned.

Return ONLY this JSON — no markdown, no extra text:
{{
  "category": "QUALIFIED_LEAD",
  "confidence": 0.95,
  "summary": "Brief summary for the business owner (they read this in their notification)",
  "response": "What the visitor sees — null if QUALIFIED_LEAD with enough info to act on",
  "estimated_value": "$X,XXX – $XX,XXX or null if unknown",
  "end_conversation": false
}}

Set "end_conversation": true ONLY when no further input is needed from the visitor:
- QUALIFIED_LEAD with null response (enough info to act)
- SOLICITOR / JOB_APPLICANT (kept on file)
Set it false when you need their reply (NEEDS_CLARIFICATION, SCOPE_MISMATCH)."""


def build_followup_addendum():
    return """

This is a FOLLOW-UP message. The visitor already submitted the form and you asked a clarifying question.
Re-classify based on the FULL conversation so far.

FOLLOW-UP RULES:
- If they answered your question with useful info → QUALIFIED_LEAD, response: null, end_conversation: true.
- If their answer is still vague, ask ONE MORE specific question. You can ask up to 3 total follow-ups.
- Questions about pricing/cost = engaged prospect. Address the pricing context and ask what they specifically need.
- ALWAYS lean toward qualifying. If there's ANY real interest, resolve as QUALIFIED_LEAD.
- On the 3rd follow-up, RESOLVE — lean toward QUALIFIED_LEAD if there's been any engagement at all.
- Never end the conversation abruptly. If resolving as QUALIFIED_LEAD, set response: null (the system shows a success message)."""


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

Set "is_buying_signal": true if the question suggests genuine purchase/project intent (e.g. asking about specific services, process for getting started, what they'd need to prepare)."""

# ---------------------------------------------------------------------------
# GoHighLevel integration
# ---------------------------------------------------------------------------
GHL_API = "https://services.leadconnectorhq.com"

def push_to_ghl(cfg, lead_data):
    """Push lead to GoHighLevel — upsert contact + add note. Returns contact_id or None."""
    token = cfg.get('ghl_api_token', '')
    location = cfg.get('ghl_location_id', '')
    tag = cfg.get('ghl_tag', 'SmartForm Lead')
    if not token or not location:
        return None

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Version": "2021-07-28",
    }

    name = lead_data.get('name', '').strip()
    parts = name.split(' ', 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ''

    contact_payload = {
        "locationId": location,
        "firstName": first_name,
        "lastName": last_name,
        "email": lead_data.get('email', ''),
        "phone": lead_data.get('phone', ''),
        "tags": [tag],
        "source": "SmartForm",
    }

    try:
        resp = http_requests.post(f"{GHL_API}/contacts/upsert",
                                  headers=headers, json=contact_payload, timeout=10)
        result = resp.json()
        contact_id = result.get('contact', {}).get('id')

        if contact_id:
            note_body = _build_ghl_note(lead_data)
            http_requests.post(f"{GHL_API}/contacts/{contact_id}/notes",
                               headers=headers,
                               json={"body": note_body},
                               timeout=10)
        print(f"[GHL] Pushed {lead_data.get('name')} → contact {contact_id}")
        return contact_id
    except Exception as e:
        print(f"[GHL] Push error: {e}")
        return None


def _build_ghl_note(d):
    lines = [
        "📋 SmartForm Lead Brief",
        "━" * 30,
        f"Category: {d.get('category', 'Unknown')}",
        f"Estimated Value: {d.get('estimated_value') or 'N/A'}",
        "",
        f"AI Summary: {d.get('summary', 'N/A')}",
        "",
    ]
    convo = d.get('conversation', [])
    if convo:
        lines.append("Conversation:")
        for m in convo:
            if m['role'] == 'user':
                lines.append(f"→ {d.get('name','Visitor')}: {m['content']}")
            else:
                lines.append(f"← AI: {m['content']}")
    else:
        lines.append(f"Message: {d.get('message', 'N/A')}")
    return "\n".join(lines)


def _notify_lead(cfg, result, name, email, phone, message, conversation=None):
    """Notify business owner — GHL first, SendGrid fallback."""
    is_demo = bool(cfg.get('demo_mode', 0))
    if is_demo:
        return

    # Build lead data for GHL note
    lead_data = {
        'name': name, 'email': email, 'phone': phone,
        'message': message,
        'category': result.get('category', ''),
        'summary': result.get('summary', ''),
        'estimated_value': result.get('estimated_value', ''),
        'conversation': conversation or [{'role': 'user', 'content': message}],
    }

    # Try GHL first
    ghl_id = push_to_ghl(cfg, lead_data)
    if ghl_id:
        return ghl_id

    # Fallback to SendGrid email
    _email_owner(cfg, result, name, email, phone, message)
    return None


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
    conversation_log = [{'role': 'user', 'content': message}]

    # Save lead
    conn = get_db()
    lead_id = db_insert_id(conn,
        '''INSERT INTO leads (client_id,category,name,email,phone,message,ai_summary,estimated_value,conversation)
           VALUES (?,?,?,?,?,?,?,?,?)''',
        (client_id, result['category'], name, email, phone, message,
         result.get('summary',''), result.get('estimated_value',''),
         json.dumps(conversation_log))
    )
    conn.commit()

    is_demo = bool(cfg.get('demo_mode', 0))

    # Notify owner for qualified leads
    ghl_id = None
    if result['category'] == 'QUALIFIED_LEAD' and not result.get('response') and not is_demo:
        ghl_id = _notify_lead(cfg, result, name, email, phone, message)
        if ghl_id:
            db_exec(conn, 'UPDATE leads SET ghl_contact_id=? WHERE id=?', (ghl_id, lead_id))
            conn.commit()

    conn.close()

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
            'would_email': bool(cfg.get('notification_email') or cfg.get('ghl_api_token')),
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
    system = build_system_prompt(cfg) + build_followup_addendum()

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

    conversation.append({'role': 'user', 'content': message})
    if result.get('response'):
        conversation.append({'role': 'assistant', 'content': result['response']})

    conn = get_db()
    db_exec(conn,
        'UPDATE leads SET category=?, ai_summary=?, estimated_value=?, conversation=? WHERE id=?',
        (result['category'], result.get('summary',''), result.get('estimated_value',''),
         json.dumps(conversation), lead_id)
    )
    conn.commit()

    is_demo = bool(cfg.get('demo_mode', 0))

    # Notify owner if now qualified
    ghl_id = None
    if result['category'] == 'QUALIFIED_LEAD' and not result.get('response') and not is_demo:
        full_msg = "\n".join(m['content'] for m in conversation if m['role'] == 'user')
        ghl_id = _notify_lead(cfg, result, name, email, phone, full_msg, conversation)
        if ghl_id:
            db_exec(conn, 'UPDATE leads SET ghl_contact_id=? WHERE id=?', (ghl_id, lead_id))
            conn.commit()

    conn.close()

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
            'would_email': bool(cfg.get('notification_email') or cfg.get('ghl_api_token')),
            'email_recipient': cfg.get('notification_email', '(not configured)'),
        }

    return jsonify(resp_data)


# ---------------------------------------------------------------------------
# Routes — Thank You page continuation context
# ---------------------------------------------------------------------------
@app.route('/api/lead-context/<int:lead_id>')
def lead_context(lead_id):
    """Return minimal lead context for TY page continuation widget."""
    conn = get_db()
    row = db_one(conn, 'SELECT client_id, name, email, phone, conversation FROM leads WHERE id=?', (lead_id,))
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'lead_id': lead_id,
        'client_id': row['client_id'],
        'name': row['name'] or '',
        'email': row['email'] or '',
        'phone': row['phone'] or '',
        'conversation': json.loads(row['conversation'] or '[]'),
    })


# ---------------------------------------------------------------------------
# Routes — Q&A assistant
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

    conn = get_db()
    lead_id = db_insert_id(conn,
        '''INSERT INTO leads (client_id,category,name,email,phone,message,ai_summary,estimated_value,conversation)
           VALUES (?,?,?,?,?,?,?,?,?)''',
        (client_id, 'AI_CHAT', name, email, '', '', 'AI chat session', '', json.dumps([]))
    )
    conn.commit()
    conn.close()

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

    conversation.append({'role': 'user', 'content': message})
    conversation.append({'role': 'assistant', 'content': result['response']})

    topics = data.get('topics', [])
    if result.get('topic'):
        topics.append(result['topic'])
    topic_summary = ', '.join(dict.fromkeys(topics))

    conn = get_db()
    db_exec(conn,
        'UPDATE leads SET ai_summary=?, conversation=?, message=? WHERE id=?',
        (f"AI chat — topics: {topic_summary}" if topic_summary else "AI chat session",
         json.dumps(conversation),
         '\n'.join(m['content'] for m in conversation if m['role'] == 'user'),
         lead_id)
    )
    conn.commit()
    conn.close()

    is_demo = bool(cfg.get('demo_mode', 0))

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
    if request.is_json:
        data = request.json or {}
    else:
        try:
            data = json.loads(request.get_data(as_text=True))
        except Exception:
            data = {}
    client_id = data.get('client_id', '')
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Unknown client'}), 404

    name = data.get('name', '')
    email = data.get('email', '')
    conversation = data.get('conversation', [])
    topics = data.get('topics', [])
    topic_summary = ', '.join(dict.fromkeys(topics))

    is_demo = bool(cfg.get('demo_mode', 0))
    if conversation and not is_demo:
        _email_qa_transcript(cfg, name, email, conversation, topic_summary)

    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Dashboard API — per-client, PIN-protected
# ---------------------------------------------------------------------------
@app.route('/dashboard-auth/<client_id>', methods=['POST'])
def dashboard_auth(client_id):
    """Verify dashboard PIN."""
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'ok': False}), 404
    data = request.json or {}
    pin = data.get('pin', '')
    dash_pin = cfg.get('dashboard_pin', '')
    if (dash_pin and pin == dash_pin) or pin == ADMIN_PIN:
        return jsonify({'ok': True})
    return jsonify({'ok': False}), 403


@app.route('/api/dashboard/<client_id>')
def dashboard_combined(client_id):
    """Combined dashboard endpoint — returns config + all leads."""
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Not found'}), 404
    if not require_dashboard(cfg):
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    rows = db_all(conn, 'SELECT * FROM leads WHERE client_id=? ORDER BY created_at DESC LIMIT 500', (client_id,))
    conn.close()

    for r in rows:
        if r.get('created_at') and not isinstance(r['created_at'], str):
            r['created_at'] = r['created_at'].isoformat()

    return jsonify({
        'config': {
            'business_name': cfg['business_name'],
            'brand_color': cfg.get('brand_color', '#2563eb'),
        },
        'leads': rows,
    })


@app.route('/dashboard/api/<client_id>/leads')
def dashboard_leads(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Not found'}), 404
    if not require_dashboard(cfg):
        abort(401)

    start = request.args.get('start', '')
    end = request.args.get('end', '')
    category = request.args.get('category', '')

    sql = 'SELECT * FROM leads WHERE client_id=?'
    params = [client_id]

    if category:
        sql += ' AND category=?'
        params.append(category)
    if start:
        sql += ' AND created_at >= ?'
        params.append(start)
    if end:
        sql += ' AND created_at <= ?'
        params.append(end + ' 23:59:59')

    sql += ' ORDER BY created_at DESC LIMIT 500'

    conn = get_db()
    rows = db_all(conn, sql, tuple(params))
    conn.close()

    # Serialize datetime objects for JSON
    for r in rows:
        if r.get('created_at') and not isinstance(r['created_at'], str):
            r['created_at'] = r['created_at'].isoformat()

    return jsonify(rows)


@app.route('/dashboard/api/<client_id>/stats')
def dashboard_stats(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Not found'}), 404
    if not require_dashboard(cfg):
        abort(401)

    conn = get_db()
    total = db_one(conn, 'SELECT COUNT(*) as cnt FROM leads WHERE client_id=?', (client_id,))
    cats = db_all(conn,
        'SELECT category, COUNT(*) as cnt FROM leads WHERE client_id=? GROUP BY category',
        (client_id,))

    # Pipeline value — sum estimated values for qualified leads
    qualified = db_all(conn,
        "SELECT estimated_value FROM leads WHERE client_id=? AND category='QUALIFIED_LEAD'",
        (client_id,))
    conn.close()

    pipeline_low = 0
    pipeline_high = 0
    for q in qualified:
        val = q.get('estimated_value', '') or ''
        nums = re.findall(r'[\d,]+', val.replace(',', ''))
        amounts = [int(n) for n in nums if n]
        if amounts:
            pipeline_low += min(amounts)
            pipeline_high += max(amounts)

    return jsonify({
        'total': total['cnt'] if total else 0,
        'by_category': {r['category']: r['cnt'] for r in cats},
        'pipeline': f"${pipeline_low:,}" + (f" – ${pipeline_high:,}" if pipeline_high != pipeline_low else ""),
    })


@app.route('/dashboard/api/<client_id>/export')
def dashboard_export(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return jsonify({'error': 'Not found'}), 404
    if not require_dashboard(cfg):
        abort(401)

    conn = get_db()
    rows = db_all(conn,
        'SELECT created_at,category,name,email,phone,message,ai_summary,estimated_value FROM leads WHERE client_id=? ORDER BY created_at DESC',
        (client_id,))
    conn.close()

    import csv, io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Category', 'Name', 'Email', 'Phone', 'Message', 'AI Summary', 'Est. Value'])
    for r in rows:
        created = r.get('created_at', '')
        if created and not isinstance(created, str):
            created = created.isoformat()
        writer.writerow([created, r['category'], r.get('name',''), r.get('email',''),
                         r.get('phone',''), r.get('message',''), r.get('ai_summary',''),
                         r.get('estimated_value','')])

    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={client_id}-leads.csv'}
    )


# ---------------------------------------------------------------------------
# Email — SendGrid (fallback if GHL not configured)
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
@app.route('/admin/api/clients')
def admin_list_clients():
    require_admin()
    conn = get_db()
    rows = db_all(conn, 'SELECT * FROM clients ORDER BY created_at DESC')
    conn.close()
    for c in rows:
        c['services'] = json.loads(c['services'])
        c['wont_do'] = json.loads(c['wont_do'])
    return jsonify(rows)


@app.route('/admin/api/clients/<client_id>')
def admin_get_client(client_id):
    require_admin()
    conn = get_db()
    row = db_one(conn, 'SELECT * FROM clients WHERE id=?', (client_id,))
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    row['services'] = json.loads(row['services'])
    row['wont_do'] = json.loads(row['wont_do'])
    return jsonify(row)


@app.route('/admin/api/clients', methods=['POST'])
def admin_save_client():
    require_admin()
    data = request.json or {}

    client_id = data.get('id', '').strip().lower()
    client_id = re.sub(r'[^a-z0-9_-]', '', client_id)
    if not client_id or len(client_id) < 2:
        return jsonify({'error': 'Client ID must be at least 2 characters'}), 400

    biz_name = data.get('business_name', '').strip()
    if not biz_name:
        return jsonify({'error': 'Business name is required'}), 400

    services = data.get('services', [])
    wont_do = data.get('wont_do', [])

    conn = get_db()
    existing = db_one(conn, 'SELECT 1 FROM clients WHERE id=?', (client_id,))

    if existing:
        db_exec(conn, '''UPDATE clients SET
            business_name=?, business_description=?, services=?, wont_do=?,
            notification_email=?, brand_color=?, facebook_pixel_id=?,
            google_ads_id=?, google_ads_label=?, thank_you_url=?,
            solicitor_sheet_url=?, job_sheet_url=?, knowledge_base=?,
            ghl_api_token=?, ghl_location_id=?, ghl_tag=?, dashboard_pin=?,
            demo_mode=?, active=?,
            updated_at=CURRENT_TIMESTAMP
            WHERE id=?''',
            (biz_name, data.get('business_description',''), json.dumps(services), json.dumps(wont_do),
             data.get('notification_email',''), data.get('brand_color','#2563eb'),
             data.get('facebook_pixel_id',''), data.get('google_ads_id',''),
             data.get('google_ads_label',''), data.get('thank_you_url',''),
             data.get('solicitor_sheet_url',''), data.get('job_sheet_url',''),
             data.get('knowledge_base', ''),
             data.get('ghl_api_token',''), data.get('ghl_location_id',''),
             data.get('ghl_tag','SmartForm Lead'), data.get('dashboard_pin',''),
             1 if data.get('demo_mode', False) else 0,
             1 if data.get('active', True) else 0, client_id)
        )
    else:
        db_exec(conn, '''INSERT INTO clients
            (id, business_name, business_description, services, wont_do,
             notification_email, brand_color, facebook_pixel_id,
             google_ads_id, google_ads_label, thank_you_url,
             solicitor_sheet_url, job_sheet_url, knowledge_base,
             ghl_api_token, ghl_location_id, ghl_tag, dashboard_pin,
             demo_mode, active)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (client_id, biz_name, data.get('business_description',''),
             json.dumps(services), json.dumps(wont_do),
             data.get('notification_email',''), data.get('brand_color','#2563eb'),
             data.get('facebook_pixel_id',''), data.get('google_ads_id',''),
             data.get('google_ads_label',''), data.get('thank_you_url',''),
             data.get('solicitor_sheet_url',''), data.get('job_sheet_url',''),
             data.get('knowledge_base', ''),
             data.get('ghl_api_token',''), data.get('ghl_location_id',''),
             data.get('ghl_tag','SmartForm Lead'), data.get('dashboard_pin',''),
             1 if data.get('demo_mode', False) else 0,
             1 if data.get('active', True) else 0)
        )

    conn.commit()
    conn.close()
    return jsonify({'ok': True, 'id': client_id})


@app.route('/admin/api/clients/<client_id>', methods=['DELETE'])
def admin_delete_client(client_id):
    require_admin()
    conn = get_db()
    db_exec(conn, 'DELETE FROM clients WHERE id=?', (client_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/admin/api/leads/<client_id>')
def admin_leads(client_id):
    require_admin()
    conn = get_db()
    rows = db_all(conn,
        'SELECT * FROM leads WHERE client_id=? ORDER BY created_at DESC LIMIT 200',
        (client_id,))
    conn.close()
    for r in rows:
        if r.get('created_at') and not isinstance(r['created_at'], str):
            r['created_at'] = r['created_at'].isoformat()
    return jsonify(rows)


@app.route('/admin/api/stats/<client_id>')
def admin_stats(client_id):
    require_admin()
    conn = get_db()
    total = db_one(conn, 'SELECT COUNT(*) as cnt FROM leads WHERE client_id=?', (client_id,))
    cats = db_all(conn,
        'SELECT category, COUNT(*) as cnt FROM leads WHERE client_id=? GROUP BY category',
        (client_id,))
    conn.close()
    return jsonify({
        'total': total['cnt'] if total else 0,
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

@app.route('/widget/<client_id>')
def widget_page(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return "Not found", 404
    return send_from_directory('static', 'form.html')

@app.route('/dashboard/<client_id>')
def dashboard_page(client_id):
    cfg = get_client(client_id)
    if not cfg:
        return "Not found", 404
    return send_from_directory('static', 'dashboard.html')

@app.route('/admin')
def admin_page():
    return send_from_directory('static', 'admin.html')

@app.route('/')
def index():
    return '<p>SmartForm API — <a href="/admin">Admin Panel</a></p>', 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
