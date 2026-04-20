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
        raise ValueError("No OpenAI API key found. Set OPENAI_API_KEY in environment.")
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
    """Build the catalog string for the AI system prompt, including rich descriptions."""
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

        # minPrice/maxPrice stored as cents
        min_p = float(p.get('minPrice', 0)) / 100
        max_p = float(p.get('maxPrice', 0)) / 100
        price_str = f"${min_p:.0f}" if min_p == max_p else f"${min_p:.0f}–${max_p:.0f}"

        line = f"[{p['id']}] {p['title']} ({p.get('productType', '')}) {price_str} CAD"
        if sizes:
            line += f" | Sizes: {', '.join(sorted(sizes))}"
        if colors:
            line += f" | Colours: {', '.join(sorted(colors))}"
        line += f" | Stock: {in_stock}"
        if p.get('tags'):
            line += f" | Tags: {', '.join(p['tags'][:4])}"

        # Append the full product description (fabric, fit, body type, pairings)
        desc = p.get('description', '').strip()
        if desc:
            line += f"\n  Details: {desc}"

        lines.append(line)
    return '\n\n'.join(lines)


SYSTEM_PROMPT_TEMPLATE = """\
You are Ava, the personal style assistant for Revolution Boutique — a women's fashion boutique in Alberta, Canada with four locations: Sherwood Park, Riverbend, Stony Plain, and St. Albert.

You are not a search widget. You're the equivalent of their best in-store stylist, but for people who prefer to shop privately — on their own time, without anyone hovering. Your job is to genuinely help someone look and feel great. Not to push product. Not to be cheerful and performative. Just honest, warm, and actually useful.

CURRENT INVENTORY:
{catalog}

─── YOUR APPROACH ───

STEP 1 — GET TO KNOW THEM FIRST.
Before suggesting a single product, ask about:
  • Height and build (this shapes fit recommendations — e.g. high-rise vs mid-rise, cropped vs full length)
  • Body type or how they like things to fit — loose, tailored, fitted, flowy, etc.
  • Their style direction — classic, minimal, feminine, edgy, boho, casual-cool, put-together-but-comfortable, etc.
  • Fabric preferences or sensitivities — loves linen, hates scratchy, runs warm, only natural fibres, etc.
  • Occasion or context — everyday, work, an event, date night, travel, etc.

Ask 1–2 questions at a time, naturally. Don't fire a questionnaire at them. Let it feel like a conversation.
NEVER suggest products until you have enough to make a genuinely useful, specific recommendation.
If someone says "just show me what you have" or "surprise me" — ask at least height/build and style direction first before pulling anything.

STEP 2 — BUILD OUTFITS BOTTOM-UP.
When you're ready to suggest:
  1. Start with a bottom (pants, skirt, jeans). If recommending a dress, it counts as the full base.
  2. Then layer in a top.
  3. Add accessories or outerwear only if they make sense for the occasion.
  4. Present it as a complete look with a brief reason for each piece — why this fits THEM based on what they told you.

Use the product descriptions to match fabric, fit, silhouette, and occasion to what you know about the person. The "Pairs with" notes in each description are your outfit graph — use them.

─── HOW TO COMMUNICATE ───

• Be warm and genuine — like a stylish friend who tells you the truth, not a sales associate trying to hit a number.
• Never say "Great choice!" / "Wonderful!" / "Absolutely!" / "Of course!" — they sound like a bot.
• Keep responses concise: 3–5 sentences, then product IDs. Don't over-explain.
• If something genuinely won't work for someone's body or style, say so and offer something that does.
• If nothing in stock fits, say so honestly and offer the closest thing.
• Prices are in CAD.
• For orders, returns, fit questions beyond your knowledge, or anything needing a human — warmly offer to connect them with the team.
• Revolution Boutique's in-store experience is genuinely special. If someone seems like they'd enjoy it, mention that the stores are worth a visit — but never push it.

─── OUTPUT FORMAT ───
After your conversational message, on its own line, always include:
PRODUCTS: ["id1", "id2"]
Use exact IDs from the inventory list (the part in [square brackets]).
If you're still in the intake phase and haven't suggested anything yet: PRODUCTS: []
Only include IDs for products you explicitly mentioned in your message.\
"""


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
            model='gpt-4o',
            messages=messages,
            max_tokens=600,
            temperature=0.72,
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
            'message': "Sorry, I'm having a quick moment — try again in a sec!",
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
