import React from 'react';
import { Phone } from 'lucide-react';
import { ChatMessage, Product } from '../types';
import { ProductCard } from './ProductCard';

interface MessageBubbleProps {
  message: ChatMessage;
  onAddToCart?: (product: Product) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onAddToCart }) => {
  const isUser = message.role === 'user';
  const isHandoff = message.role === 'handoff';

  if (isHandoff) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }} className="fade-slide-up">
        <div style={{
          background: '#0f0f0f',
          border: '1px solid rgba(196,162,110,0.2)',
          maxWidth: '280px',
          width: '100%',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '36px', height: '36px',
            border: '1px solid rgba(196,162,110,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Phone size={16} style={{ color: '#c4a26e' }} />
          </div>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '17px',
            color: '#f0ece4',
            marginBottom: '8px',
            fontWeight: 400,
          }}>
            Connecting you with our team
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.4)', lineHeight: 1.6, marginBottom: '16px' }}>
            We'll follow up shortly. Feel free to keep browsing in the meantime.
          </p>
          <div style={{ borderTop: '1px solid rgba(240,236,228,0.06)', paddingTop: '14px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(240,236,228,0.3)', lineHeight: 1.8, fontFamily: "'Inter', sans-serif" }}>
              Four locations across Alberta<br />
              Mon–Fri 10am–6pm · Sat 10am–5pm<br />
              hello@revolutionboutique.ca
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', gap: '10px', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}
      className="fade-slide-up"
    >
      {/* Avatar */}
      {!isUser && (
        <div style={{
          width: '28px', height: '28px',
          border: '1px solid rgba(196,162,110,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: '2px',
        }}>
          <span style={{ fontSize: '13px', color: '#c4a26e', fontFamily: "'Cormorant Garamond', serif" }}>A</span>
        </div>
      )}
      {isUser && (
        <div style={{
          width: '28px', height: '28px',
          border: '1px solid rgba(240,236,228,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: '2px',
        }}>
          <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.4)', fontFamily: "'Inter', sans-serif" }}>You</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '78%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Bubble */}
        <div style={{
          padding: '11px 15px',
          fontSize: '14px',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: "'Inter', sans-serif",
          ...(isUser ? {
            background: '#f0ece4',
            color: '#0a0a0a',
          } : {
            background: '#111111',
            border: '1px solid rgba(240,236,228,0.06)',
            color: '#f0ece4',
          }),
        }}>
          {message.text}
        </div>

        {/* Product cards */}
        {message.products && message.products.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
            {message.products.map(p => (
              <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
