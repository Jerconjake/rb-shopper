import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ShoppingBag, Lock } from 'lucide-react';
import { ChatMessage, Product, CartItem } from './types';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { VariantPickerModal } from './components/VariantPickerModal';
import { CartDrawer } from './components/CartDrawer';

// ── Demo PIN gate ──────────────────────────────────────────────────────────
// Change this to whatever PIN you want to share with the client.
const DEMO_PIN = 'rb2025';

const SUGGESTIONS = [
  'Help me find a dress for a wedding 💍',
  'What do you have in tops under $80?',
  'I need a complete date night outfit ✨',
  "What's new this season?",
];

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: "Hey! I'm Ava, your personal style assistant here at Revolution Boutique 👋\n\nTell me what you're looking for — a specific occasion, a vibe, a type of piece — and I'll pull together some options from what we have in store right now. What can I help you find?",
  timestamp: Date.now(),
};

// ── Logo component ──────────────────────────────────────────────────────────
const RBLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img src="/logo.png" alt="Revolution Boutique" className={className} />
);

// ── PIN Screen ─────────────────────────────────────────────────────────────
const PinScreen: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === DEMO_PIN) {
      sessionStorage.setItem('rb_unlocked', '1');
      onUnlock();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-base-100 px-6">
      <div className="card bg-base-200 border border-base-300 w-full max-w-xs shadow-xl">
        <div className="card-body items-center text-center gap-5 p-8">
          <RBLogo className="w-48 h-auto" />
          <p className="text-xs text-base-content/40 -mt-2">Personal Shopper · Demo</p>
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <input
              type="password"
              className={`input input-bordered w-full text-center tracking-widest text-lg ${error ? 'input-error' : ''}`}
              placeholder="Enter PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
              maxLength={12}
            />
            {error && (
              <p className="text-error text-xs text-center">Incorrect PIN — try again</p>
            )}
            <button type="submit" className="btn btn-primary w-full gap-2">
              <Lock size={14} />
              Enter Demo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('rb_unlocked') === '1');
  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  // Load product catalog from API on mount, deduplicating by title
  useEffect(() => {
    if (!unlocked) return;
    fetch('/api/products')
      .then(r => r.json())
      .then((all: Product[]) => {
        const seen = new Map<string, Product>();
        for (const p of all) seen.set(p.title.toLowerCase(), p);
        setProducts(Array.from(seen.values()));
      })
      .catch(() => setLoadError('Could not load product catalog.'));
  }, [unlocked]);

  const productById = useCallback((id: string): Product | undefined => {
    return products.find(p => p.id === id || p.id.endsWith(`/${id}`));
  }, [products]);

  const sendMessage = useCallback(async (text: string) => {
    if (isLoading || handedOff) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history = [...messages.filter(m => m.role !== 'handoff'), userMsg].map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        text: m.text,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: history }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const parsed = await response.json() as { message: string; product_ids: string[] };

      // Resolve products by ID, with a name-based fallback for hallucinated IDs
      const resolvedIds = new Set<string>();
      const recommendedProducts: Product[] = [];
      for (const id of parsed.product_ids) {
        const byId = productById(id);
        if (byId && !resolvedIds.has(byId.id)) {
          resolvedIds.add(byId.id);
          recommendedProducts.push(byId);
        }
      }
      // Fallback: scan AI text for product titles (fires even when product_ids is empty)
      if (recommendedProducts.length === 0 || recommendedProducts.length < parsed.product_ids.length) {
        const lowerText = parsed.message.toLowerCase();
        for (const p of products) {
          if (!resolvedIds.has(p.id) && lowerText.includes(p.title.toLowerCase())) {
            resolvedIds.add(p.id);
            recommendedProducts.push(p);
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `ava-${Date.now()}`,
        role: 'assistant',
        text: parsed.message,
        products: recommendedProducts.length > 0 ? recommendedProducts : undefined,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('AI chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: "Sorry, I had a little hiccup! Try again in a moment — or hit \"Talk to a person\" and our team will help you out. 😊",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, handedOff, messages, productById, products]);

  const handleHandoff = useCallback(() => {
    if (handedOff) return;
    setHandedOff(true);
    const handoffMsg: ChatMessage = {
      id: `handoff-${Date.now()}`,
      role: 'handoff',
      text: '',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, handoffMsg]);
  }, [handedOff]);

  // Cart handlers
  const handleAddToCart = useCallback((product: Product) => {
    setPickerProduct(product);
  }, []);

  const handleCartAdd = useCallback((item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.variantId === item.variantId);
      if (existing) {
        return prev.map(c =>
          c.variantId === item.variantId ? { ...c, qty: c.qty + item.qty } : c
        );
      }
      return [...prev, item];
    });
  }, []);

  const handleUpdateQty = useCallback((cartId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.cartId !== cartId));
    } else {
      setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, qty } : c));
    }
  }, []);

  const handleRemove = useCallback((cartId: string) => {
    setCart(prev => prev.filter(c => c.cartId !== cartId));
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const hasUserMessages = messages.some(m => m.role === 'user');

  if (!unlocked) {
    return <PinScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-200 flex-shrink-0">
        <RBLogo className="h-7 w-auto" />
        <div className="ml-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            <p className="text-xs text-base-content/50">Ava · Personal Shopper</p>
          </div>
        </div>

        {/* Cart button */}
        <div className="ml-auto">
          <button
            className="btn btn-ghost btn-sm btn-circle relative"
            onClick={() => setCartOpen(true)}
            title="View cart"
          >
            <ShoppingBag size={18} className="text-base-content/70" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-content text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-error mx-4 mt-3 text-sm py-2">
          {loadError}
        </div>
      )}

      {/* Messages */}
      <ChatWindow messages={messages} isLoading={isLoading} onAddToCart={handleAddToCart} />

      {/* Suggestion chips */}
      {!hasUserMessages && !handedOff && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              className="btn btn-sm btn-outline text-xs font-normal"
              onClick={() => sendMessage(s)}
              disabled={isLoading}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <InputBar
        onSend={sendMessage}
        onHandoff={handleHandoff}
        disabled={isLoading || products.length === 0}
        handedOff={handedOff}
      />

      {/* Variant picker modal */}
      <VariantPickerModal
        product={pickerProduct}
        onClose={() => setPickerProduct(null)}
        onAdd={item => {
          handleCartAdd(item);
          setPickerProduct(null);
          setTimeout(() => setCartOpen(true), 300);
        }}
      />

      {/* Cart drawer */}
      <CartDrawer
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemove}
      />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
