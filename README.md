# Revolution Boutique · Personal Shopper Demo

AI-powered personal shopping assistant for Revolution Boutique.

## Setup on Replit

### 1. Add your OpenAI API Key

In the Replit sidebar, go to **Secrets** (the padlock icon) and add:
- **Key:** `OPENAI_API_KEY`
- **Value:** your OpenAI API key (starts with `sk-`)

### 2. Hit Run

Click the big green **Run** button. Replit will:
1. Install Python packages (flask, openai)
2. Install Node packages (react, vite)
3. Build the React frontend
4. Start the Flask server

### 3. Share the link

Click **Open in new tab** (the arrow icon next to the webview URL) to get the shareable link.

**Demo PIN:** `rb2025` (change in `src/app.tsx` — look for `DEMO_PIN`)

---

## Customising

| Thing to change | Where |
|---|---|
| Demo PIN | `src/app.tsx` → `const DEMO_PIN = 'rb2025'` |
| Ava's personality / system prompt | `server.py` → `SYSTEM_PROMPT_TEMPLATE` |
| Product catalog | Replace `products.json` with a fresh export from Shopify |
| Store hours / contact info in handoff card | `src/components/MessageBubble.tsx` |
| Checkout URL | `src/components/CartDrawer.tsx` → `const STORE_URL` |

## Production (Render.com)

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Set **Build Command:** `pip install -r requirements.txt && npm install && npm run build`
4. Set **Start Command:** `python server.py`
5. Add `OPENAI_API_KEY` as an environment variable
6. Done — you get a permanent `*.onrender.com` URL

---

*Built for Revolution Boutique by Jacob Pringle*
