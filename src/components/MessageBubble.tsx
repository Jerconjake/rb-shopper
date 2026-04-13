import React from 'react';
import { ChatMessage, Product } from '../types';
import { ProductCard } from './ProductCard';

interface Props {
  msg: ChatMessage;
  onAddToCart: (p: Product) => void;
}

const HandoffCard: React.FC = () => (
  <div style={{
    background: 'var(--rb-surface)',
    border: '1px solid var(--rb-border-md)',
    padding: '20px',
    maxWidth: '340px',
  }}>
    <p style={{
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '17px',
      fontWeight: 400,
      color: 'var(--rb-cream)',
      marginBottom: '6px',
      lineHeight: 1.4,
    }}>
      Our team is ready to help
    </p>
    <p style={{
      fontSize: '12.5px',
      color: 'var(--rb-cream-60)',
      fontFamily: "'Inter', sans-serif",
      lineHeight: 1.6,
      marginBottom: '18px',
    }}>
      Reach us any way that works for you:
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <a
        href="tel:+17804677700"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--rb-cream)',
          textDecoration: 'none',
          fontSize: '13px',
          fontFamily: "'Inter', sans-serif",
          padding: '10px 14px',
          border: '1px solid var(--rb-border)',
          background: 'var(--rb-raised)',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--rb-accent-30)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--rb-border)')}
      >
        <span style={{ fontSize: '16px' }}>📞</span>
        <span>+1 (780) 467-7700</span>
      </a>

      <a
        href="mailto:hello@revolutionboutique.ca"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--rb-cream)',
          textDecoration: 'none',
          fontSize: '13px',
          fontFamily: "'Inter', sans-serif",
          padding: '10px 14px',
          border: '1px solid var(--rb-border)',
          background: 'var(--rb-raised)',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--rb-accent-30)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--rb-border)')}
      >
        <span style={{ fontSize: '16px' }}>✉️</span>
        <span>hello@revolutionboutique.ca</span>
      </a>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 14px',
        border: '1px solid var(--rb-border)',
        background: 'var(--rb-raised)',
        fontSize: '13px',
        color: 'var(--rb-cream-60)',
        fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{ fontSize: '16px' }}>🕐</span>
        <span style={{ lineHeight: 1.6 }}>
          Mon–Fri 10am–6pm<br />
          Sat 10am–5pm · Sun Closed
        </span>
      </div>
    </div>
  </div>
);

export const MessageBubble: React.FC<Props> = ({ msg, onAddToCart }) => {
  const isUser = msg.role === 'user';
  const isHandoff = msg.role === 'handoff';

  if (isHandoff) {
    return (
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <HandoffCard />
      </div>
    );
  }

  return (
    <div
      className="fade-up"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: '10px',
      }}
    >
      {/* Text bubble */}
      <div
        className={isUser ? 'msg-user' : 'msg-assistant'}
        style={{
          maxWidth: '82%',
          padding: '11px 15px',
          fontSize: '14px',
          lineHeight: 1.65,
          fontFamily: "'Inter', sans-serif",
          whiteSpace: 'pre-wrap',
        }}
      >
        {!isUser && (
          <span style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            background: 'var(--rb-accent)',
            color: '#fff',
            fontSize: '10px',
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 500,
            textAlign: 'center',
            lineHeight: '20px',
            marginRight: '8px',
            marginBottom: '-3px',
            letterSpacing: '0',
            flexShrink: 0,
          }}>
            A
          </span>
        )}
        {msg.text}
      </div>

      {/* Product cards */}
      {msg.products && msg.products.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '4px',
          maxWidth: '100%',
          alignSelf: 'flex-start',
        }}>
          {msg.products.map(p => (
            <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
          ))}
        </div>
      )}
    </div>
  );
};
