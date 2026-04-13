import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ShoppingBag } from 'lucide-react';
import { ChatMessage, Product, CartItem } from './types';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { VariantPickerModal } from './components/VariantPickerModal';
import { CartDrawer } from './components/CartDrawer';

const DEMO_PIN = 'rb2025';

const SUGGESTIONS = [
  'Help me find a dress for a wedding',
  'What do you have in tops under $80?',
  'I need a complete date night outfit',
  "What's new this season?",
];

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: "Hi, I'm Ava — your personal style assistant at Revolution Boutique.\n\nTell me what you're looking for. An occasion, a vibe, a specific piece. I'll pull together options from what we have in store right now.",
  timestamp: Date.now(),
};

// ── PIN Screen ───────────────────────────────────────────────────────────────
const PinScreen: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Stagger the entrance animation
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

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
    <div style={{
      background: 'var(--rb-bg)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Subtle radial glow behind logo */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(201,131,90,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        <img
          src="/logo.png"
          alt="Revolution Boutique"
          style={{
            width: '200px',
            filter: 'brightness(0) invert(1)',
            opacity: 0.88,
          }}
        />
      </div>

      {/* Accent line */}
      <div style={{
        width: mounted ? '48px' : '0px',
        height: '1px',
        background: 'var(--rb-accent)',
        transition: 'width 0.6s 0.3s ease',
        marginBottom: '44px',
      }} />

      {/* PIN form */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '260px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.6s 0.2s ease, transform 0.6s 0.2s ease',
        }}
      >
        <div>
          <p style={{
            color: 'var(--rb-cream-35)',
            fontSize: '10px',
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            fontFamily: "'Inter', sans-serif",
            marginBottom: '14px',
            textAlign: 'center',
          }}>
            Demo Access
          </p>
          <input
            type="password"
            className={`pin-input${error ? ' error' : ''}`}
            placeholder="· · · · · ·"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoFocus
            maxLength={12}
          />
          {error && (
            <p style={{
              color: 'var(--rb-error)',
              fontSize: '11px',
              textAlign: 'center',
              marginTop: '10px',
              fontFamily: "'Inter', sans-serif",
              letterSpacing: '0.3px',
            }}>
              Incorrect — try again
            </p>
          )}
        </div>
        <button type="submit" className="btn-pin">
          Enter
        </button>
      </form>

      {/* Footer mark */}
      <p style={{
        position: 'absolute',
        bottom: '24px',
        color: 'var(--rb-cream-18)',
        fontSize: '10px',
        letterSpacing: '1.5px',
        fontFamily: "'Inter', sans-serif",
        textTransform: 'uppercase',
      }}>
        © Revolution Boutique
      </p>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('rb_unlocked') === '1');
  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

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

      const resolvedIds = new Set<string>();
      const recommendedProducts: Product[] = [];
      for (const id of parsed.product_ids) {
        const byId = productById(id);
        if (byId && !resolvedIds.has(byId.id)) {
          resolvedIds.add(byId.id);
          recommendedProducts.push(byId);
        }
      }
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
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'Sorry, I had a little hiccup! Try again in a moment — or hit "Talk to a person" and our team will help.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, handedOff, messages, productById, products]);

  const handleHandoff = useCallback(() => {
    if (handedOff) return;
    setHandedOff(true);
    setMessages(prev => [...prev, {
      id: `handoff-${Date.now()}`,
      role: 'handoff',
      text: '',
      timestamp: Date.now(),
    }]);
  }, [handedOff]);

  const handleAddToCart = useCallback((product: Product) => {
    setPickerProduct(product);
  }, []);

  const handleCartAdd = useCallback((item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.variantId === item.variantId);
      if (existing) return prev.map(c => c.variantId === item.variantId ? { ...c, qty: c.qty + item.qty } : c);
      return [...prev, item];
    });
  }, []);

  const handleUpdateQty = useCallback((cartId: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(c => c.cartId !== cartId));
    else setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, qty } : c));
  }, []);

  const handleRemove = useCallback((cartId: string) => {
    setCart(prev => prev.filter(c => c.cartId !== cartId));
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const hasUserMessages = messages.some(m => m.role === 'user');

  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--rb-bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 18px',
        borderBottom: '1px solid var(--rb-border)',
        background: 'var(--rb-bg)',
        flexShrink: 0,
        gap: '14px',
      }}>
        <img
          src="/logo.png"
          alt="Revolution Boutique"
          style={{ height: '20px', width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.82 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: 'var(--rb-green)',
            display: 'inline-block',
          }} />
          <span style={{
            fontSize: '11px',
            color: 'var(--rb-cream-35)',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.3px',
          }}>
            Ava · Online
          </span>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-cart" onClick={() => setCartOpen(true)} title="View cart">
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px', right: '-2px',
                width: '16px', height: '16px',
                background: 'var(--rb-accent)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 600,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Inter', sans-serif",
              }}>
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{
          margin: '12px 18px 0',
          padding: '10px 14px',
          background: 'rgba(196,122,122,0.08)',
          border: '1px solid rgba(196,122,122,0.25)',
          color: 'var(--rb-error)',
          fontSize: '12px',
          fontFamily: "'Inter', sans-serif",
        }}>
          {loadError}
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <ChatWindow messages={messages} isLoading={isLoading} onAddToCart={handleAddToCart} />

      {/* ── Suggestion chips ────────────────────────────────────────────── */}
      {!hasUserMessages && !handedOff && (
        <div style={{ padding: '0 18px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              className="suggestion-chip fade-up"
              style={{ animationDelay: `${i * 0.07}s` }}
              onClick={() => sendMessage(s)}
              disabled={isLoading}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <InputBar
        onSend={sendMessage}
        onHandoff={handleHandoff}
        disabled={isLoading || products.length === 0}
        handedOff={handedOff}
      />

      {/* ── Variant picker ──────────────────────────────────────────────── */}
      <VariantPickerModal
        product={pickerProduct}
        onClose={() => setPickerProduct(null)}
        onAdd={item => {
          handleCartAdd(item);
          setPickerProduct(null);
          setTimeout(() => setCartOpen(true), 300);
        }}
      />

      {/* ── Cart drawer ─────────────────────────────────────────────────── */}
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
