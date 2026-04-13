"""
Revolution Boutique · Personal Shopper — Flask Backend
Serves the React frontend (dist/) and provides /api/products + /api/chat endpoints.
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json, os, re

app = Flask(__name__, static_folder='dist', static_url_path='')
CORS(app)


def get_openai_client():
    from openai import OpenAI
    api_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not api_key and os.path.exists('.openai_key'):
        api_key = open('.openai_key').read().strip()
    if not api_key:
        raise ValueError("No OpenAI API key found. Set OPENAI_API_KEY in Replit Secrets.")
    return OpenAI(api_key=api_key)


def load_products():
    """Load products.json and deduplicate by title (keep last/newest)."""
    with open('products.json', encoding='utf-8') as f:
        all_products = json.load(f)
    seen = {}
    for p in all_products:
        seen[p['title'].lower()] = p
    return list(seen.values())


def build_catalog(products):
    """Build the catalog string for the AI system prompt."""
    lines = []
    for p in products:
        sizes, colors = set(), set()
        for v in p.get('variants', []):
            for opt in v.get('options', []):
                n = opt['name'].lower()
                if 'size' in n:
                    sizes.add(opt['value'])
                elif 'col' in n:
                    colors.add(opt['value'])
        in_stock = sum((v.get('qty') or 0) for v in p.get('variants', []) if v.get('available'))
        if in_stock == 0:
            continue
        # minPrice/maxPrice are in cents (e.g. 4800 = $48)
        min_p = float(p.get('minPrice', 0)) / 100
        max_p = float(p.get('maxPrice', 0)) / 100
        price_str = f"${min_p:.0f}" if min_p == max_p else f"${min_p:.0f}–${max_p:.0f}"
        line = f"[{p['id']}] {p['title']} ({p.get('productType', '')}) {price_str} CAD"
        if sizes:
            line += f" | Sizes: {', '.join(sorted(sizes))}"
        if colors:
            line += f" | Colours: {', '.join(sorted(colors))}"
        line += f" | {in_stock} in stock"
        if p.get('tags'):
            line += f" | Tags: {', '.join(p['tags'][:4])}"
        lines.append(line)
    return '\n'.join(lines)


SYSTEM_PROMPT_TEMPLATE = """You are Ava, the personal style assistant for Revolution Boutique — a women's fashion boutique in Alberta, Canada. Think of yourself as that stylish friend who always knows exactly what to wear. You're warm, genuine, enthusiastic, and knowledgeable about fashion without being intimidating or salesy.

CURRENT INVENTORY (recommend in-stock items only):
{catalog}

HOW TO RESPOND:
- Chat like a real person, not a customer service bot. Keep it warm, fun, and natural.
- If you need more info (occasion, size, style preference), ask ONE quick question.
- Recommend 1–3 specific items max — be curated, not overwhelming.
- After your conversational message, on its own line, add exactly: PRODUCTS: ["id1", "id2"]
  Use the exact IDs from the inventory list above (the part in square brackets).
- If nothing fits what they want, say so honestly and suggest the closest alternative.
- Keep responses concise — 2–4 sentences max, then the product list.
- Prices are in CAD.
- If asked about orders, returns, or account issues, offer to connect them with the team."""


@app.route('/api/products')
def get_products():
    return jsonify(load_products())


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    conversation = data.get('conversation', [])

    try:
        products = load_products()
        catalog = build_catalog(products)
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(catalog=catalog)

        messages = [{'role': 'system', 'content': system_prompt}]
        for msg in conversation:
            if msg.get('role') in ('user', 'assistant'):
                messages.append({'role': msg['role'], 'content': msg['text']})

        client = get_openai_client()
        resp = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=messages,
            max_tokens=500,
            temperature=0.75,
        )
        raw = resp.choices[0].message.content.strip()

        # Extract PRODUCTS: [...] from the response
        product_ids = []
        match = re.search(r'PRODUCTS:\s*(\[.*?\])\s*$', raw, re.DOTALL | re.IGNORECASE)
        if match:
            try:
                product_ids = json.loads(match.group(1))
            except Exception:
                pass
            raw = raw[:match.start()].strip()

        return jsonify({'message': raw, 'product_ids': product_ids})

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({
            'message': "Sorry, I'm having a quick moment — try again in a sec! 😅",
            'product_ids': [],
            'error': str(e),
        }), 500


# Serve the built React app for all other routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    dist = os.path.join(os.path.dirname(__file__), 'dist')
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🏪 Revolution Boutique Personal Shopper running at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
