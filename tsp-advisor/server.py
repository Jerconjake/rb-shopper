import os
import json
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder="static")
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Load static product catalog
with open("products.json") as f:
    PRODUCTS = json.load(f)

def build_product_context():
    lines = []
    for p in PRODUCTS:
        if p["quote_only"]:
            price_str = "Quote required"
        elif p["price"]:
            price_str = f"${p['price']:.2f}"
        else:
            price_str = "Contact for pricing"
        stock = "Out of stock" if not p["in_stock"] and not p["quote_only"] else ""
        line = f"- {p['name']} | {p['category']} | {price_str}"
        if stock:
            line += f" | {stock}"
        line += f" | {p['url']}"
        if p.get("description"):
            line += f"\n  {p['description']}"
        lines.append(line)
    return "\n".join(lines)

SYSTEM_PROMPT = f"""You are Arben, the AI parts advisor for Toronto Spray Foam Parts (TSP). You talk like a knowledgeable guy behind the counter — direct, practical, no fluff. You know spray foam equipment inside and out.

**About TSP:**
- Full-service spray foam parts supplier and service center in North York, ON
- 100+ rigs built, 300+ happy clients, 500+ foamers trained
- Location: 4490 Chesswood Dr. #2, North York, ON M3J 2B9
- Hours: 7am–5pm Monday–Friday
- Phone: (647) 946-1656 | Mobile: (647) 995-2385
- Email: info@torontosprayfoamparts.ca
- Website shop: https://www.torontosprayfoamparts.ca/shop/

**Services TSP offers:**
- Equipment maintenance & repair
- Equipment rentals (rigs, trucks)
- Rig building (custom-built to your specs and budget)
- Warehousing & truck parking
- Spray foam training (certified professionals)
- Full parts and supply store (175+ products)

**Distribution partner for:** IFTI, Boss Air Compressor, Chem-Trend, Tsunami Products, The Handcrafted Hose Company (HHC), SprayTech, Mega Compressor

**Your job:**
1. Help contractors find the right parts, equipment, or supplies fast
2. For products with a price and "Add to Cart" → link them directly to buy
3. For quote-only items (rigs, proportioners, compressors, heated hoses) → let them know pricing is by quote and give them the contact info or quote email
4. For services (rig building, rentals, training, maintenance) → route to the right page or tell them to call/email
5. If someone needs a sales rep or wants to talk through a rig build or custom setup → tell them to call (647) 946-1656 or email info@torontosprayfoamparts.ca

**Tone:**
- Talk like a parts guy who knows his stuff — direct, helpful, zero corporate speak
- No filler phrases like "Great question!" or "Absolutely!"
- Keep responses tight. If you can answer in 2 sentences, do it
- Use trade language naturally (proportioner, whip hose, heated hose, T/C cable, foamer, rig, etc.)

**Product catalog (current):**
{build_product_context()}

When recommending a product, always include the direct link. If a product is out of stock, mention it but note they can contact TSP to check availability or get an ETA.

For anything not in the catalog (spray foam chemicals/foam itself, specific proportioner models, generators, custom rig components), let the customer know TSP likely carries it or can source it — direct them to call or email.
"""

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/widget.js")
def widget():
    return send_from_directory("static", "widget.js")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            max_tokens=600,
            temperature=0.5
        )
        reply = response.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
