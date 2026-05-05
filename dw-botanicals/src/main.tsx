import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";

interface Product {
  id: string;
  name: string;
  tagline: string;
  price: string;
  subscription_price: string | null;
  product_url: string;
  subscription_url: string | null;
  image_url: string;
  chronic: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  products?: Product[];
}

const SUGGESTIONS = [
  "I have trouble sleeping and feel anxious",
  "My joints ache and I have inflammation",
  "I get bad seasonal allergies",
  "I want to do a full body detox",
  "I need better focus and less brain fog",
];

function ProductCard({ product }: { product: Product }) {
  return (
    <div style={{
      background: "white",
      border: "1px solid #DDD5C4",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      gap: 12,
      padding: 12,
    }}>
      <img
        src={product.image_url}
        alt={product.name}
        style={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 600, color: "#2C2C2C" }}>
          {product.name}
        </div>
        <div style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.4 }}>
          {product.tagline}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#C4773B", marginTop: 2 }}>
          {product.price}
          {product.subscription_price && (
            <span style={{ fontWeight: 400, color: "#7A9E7E", marginLeft: 8 }}>
              or {product.subscription_price}/mo (subscribe & save)
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" as const }}>
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
              background: "#7A9E7E",
              color: "white",
            }}
          >
            View Product
          </a>
          {product.subscription_url && product.chronic && (
            <a
              href={product.subscription_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
                background: "#FAF0E6",
                color: "#C4773B",
                border: "1px solid #C4773B",
              }}
            >
              Subscribe & Save 10%
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "#7A9E7E", color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, flexShrink: 0
      }}>🌿</div>
      <div style={{
        display: "flex", gap: 4, padding: "14px 16px",
        background: "white", border: "1px solid #DDD5C4",
        borderRadius: "4px 16px 16px 16px"
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#7A9E7E",
            animation: "bounce 1.2s infinite",
            animationDelay: `${i * 0.2}s`
          }} />
        ))}
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setShowWelcome(false);

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply,
        products: data.products || []
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having a moment — please try again in a second.",
        products: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #F5F0E8; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #DDD5C4; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "white", borderBottom: "1px solid #DDD5C4",
        padding: "12px 20px", display: "flex", alignItems: "center",
        gap: 12, flexShrink: 0
      }}>
        <div style={{
          width: 40, height: 40, background: "#7A9E7E",
          borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", color: "white", fontSize: 18
        }}>🌿</div>
        <div>
          <h1 style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 600, color: "#2C2C2C" }}>
            Sage
          </h1>
          <p style={{ fontSize: 12, color: "#6B6B6B" }}>Desert Willow Botanicals Wellness Advisor</p>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "Lora, serif", fontSize: 13, color: "#5C7D60", fontStyle: "italic" }}>
          Desert Willow Botanicals
        </div>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px 16px",
        display: "flex", flexDirection: "column", gap: 16
      }}>
        {showWelcome && (
          <div style={{ textAlign: "center", padding: "32px 24px 16px" }}>
            <div style={{
              width: 64, height: 64, background: "#7A9E7E",
              borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 28, margin: "0 auto 16px"
            }}>🌿</div>
            <h2 style={{ fontFamily: "Lora, serif", fontSize: 22, color: "#2C2C2C", marginBottom: 8 }}>
              Hi, I'm Sage
            </h2>
            <p style={{ fontSize: 14, color: "#6B6B6B", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
              I'm here to help you find the right Desert Willow formula for what you're dealing with.
              Tell me what's going on and we'll figure it out together.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            gap: 10,
            maxWidth: "85%",
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            flexDirection: msg.role === "user" ? "row-reverse" : "row",
            alignItems: "flex-start",
            animation: "fadeIn 0.2s ease"
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              flexShrink: 0, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14,
              background: msg.role === "assistant" ? "#7A9E7E" : "#EDE6D6",
              color: msg.role === "assistant" ? "white" : "#2C2C2C"
            }}>
              {msg.role === "assistant" ? "🌿" : "👤"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "100%" }}>
              <div style={{
                padding: "12px 16px",
                borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                fontSize: 15, lineHeight: 1.55,
                background: msg.role === "user" ? "#7A9E7E" : "white",
                color: msg.role === "user" ? "white" : "#2C2C2C",
                border: msg.role === "assistant" ? "1px solid #DDD5C4" : "none",
                whiteSpace: "pre-wrap"
              }}>
                {msg.content}
              </div>
              {msg.products && msg.products.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {msg.products.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      {showWelcome && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 8px" }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              style={{
                background: "white", border: "1px solid #DDD5C4",
                borderRadius: 20, padding: "8px 14px",
                fontSize: 13, color: "#5C7D60", cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.15s"
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#EAF2EB";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#7A9E7E";
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "white";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDD5C4";
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p style={{ fontSize: 11, color: "#AAA", textAlign: "center", padding: "0 16px 4px", lineHeight: 1.5 }}>
        These statements have not been evaluated by the FDA. Not intended to diagnose, treat, cure, or prevent any disease.
      </p>

      {/* Input */}
      <div style={{
        background: "white", borderTop: "1px solid #DDD5C4",
        padding: "12px 16px", flexShrink: 0
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what you're dealing with..."
            rows={1}
            style={{
              flex: 1, border: "1px solid #DDD5C4", borderRadius: 20,
              padding: "10px 16px", fontFamily: "Inter, sans-serif",
              fontSize: 15, resize: "none", outline: "none",
              maxHeight: 120, background: "#F5F0E8", color: "#2C2C2C",
              lineHeight: 1.5
            }}
            onFocus={e => { e.target.style.borderColor = "#7A9E7E"; e.target.style.background = "white"; }}
            onBlur={e => { e.target.style.borderColor = "#DDD5C4"; e.target.style.background = "#F5F0E8"; }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: loading || !input.trim() ? "#DDD5C4" : "#7A9E7E",
              border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background 0.15s"
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
