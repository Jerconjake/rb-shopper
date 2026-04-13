import React from 'react';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { CartItem } from '../types';

interface Props {
  items: CartItem[];
  open: boolean;
  onClose: () => void;
  onUpdateQty: (cartId: string, qty: number) => void;
  onRemove: (cartId: string) => void;
}

export const CartDrawer: React.FC<Props> = ({ items, open, onClose, onUpdateQty, onRemove }) => {
  if (!open) return null;

  const subtotal = items.reduce((sum, i) => sum + parseFloat(i.price as string) * i.qty, 0);

  return (
    <>
      {/* Overlay */}
      <div className="cart-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="cart-panel">
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid var(--rb-border)',
        }}>
          <div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '20px',
              fontWeight: 400,
              color: 'var(--rb-cream)',
              margin: 0,
              lineHeight: 1.2,
            }}>
              Your Selections
            </h2>
            <p style={{
              fontSize: '11px',
              color: 'var(--rb-cream-35)',
              fontFamily: "'Inter', sans-serif",
              margin: '3px 0 0',
              letterSpacing: '0.3px',
            }}>
              {items.length === 0 ? 'Nothing here yet' : `${items.reduce((s, i) => s + i.qty, 0)} item${items.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: '60px 0',
              color: 'var(--rb-cream-35)',
            }}>
              <ShoppingBag size={32} strokeWidth={1} />
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', margin: 0 }}>
                Ask Ava for recommendations
              </p>
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.cartId}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  background: 'var(--rb-raised)',
                  border: '1px solid var(--rb-border)',
                }}
              >
                {/* Image or placeholder */}
                <div style={{
                  width: '56px',
                  height: '72px',
                  background: 'var(--rb-surface)',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '14px',
                      color: 'var(--rb-cream-18)',
                    }}>RB</div>
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '12.5px',
                    fontFamily: "'Inter', sans-serif",
                    color: 'var(--rb-cream)',
                    margin: '0 0 3px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </p>
                  {item.variantTitle && item.variantTitle !== 'Default Title' && (
                    <p style={{
                      fontSize: '11px',
                      color: 'var(--rb-cream-35)',
                      fontFamily: "'Inter', sans-serif",
                      margin: '0 0 8px',
                    }}>
                      {item.variantTitle}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Qty controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn-icon"
                        onClick={() => onUpdateQty(item.cartId, item.qty - 1)}
                        style={{ padding: '3px', border: '1px solid var(--rb-border)', background: 'var(--rb-surface)' }}
                      >
                        <Minus size={11} />
                      </button>
                      <span style={{ fontSize: '13px', color: 'var(--rb-cream)', fontFamily: "'Inter', sans-serif", minWidth: '16px', textAlign: 'center' }}>
                        {item.qty}
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => onUpdateQty(item.cartId, item.qty + 1)}
                        style={{ padding: '3px', border: '1px solid var(--rb-border)', background: 'var(--rb-surface)' }}
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: '16px',
                        color: 'var(--rb-cream)',
                      }}>
                        ${(parseFloat(item.price as string) * item.qty).toFixed(2)}
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => onRemove(item.cartId)}
                        title="Remove"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--rb-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '12px', color: 'var(--rb-cream-60)', fontFamily: "'Inter', sans-serif", letterSpacing: '0.5px' }}>
                SUBTOTAL
              </span>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '20px',
                color: 'var(--rb-cream)',
              }}>
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <button
              style={{
                width: '100%',
                background: 'var(--rb-cream)',
                color: 'var(--rb-bg)',
                border: 'none',
                padding: '14px',
                fontSize: '11px',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--rb-accent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--rb-cream)')}
              onMouseEnterCapture={e => ((e.target as HTMLElement).style.color = '#fff')}
              onClick={() => alert('Checkout integration coming soon!')}
            >
              Proceed to Checkout
            </button>
            <p style={{
              textAlign: 'center',
              fontSize: '10.5px',
              color: 'var(--rb-cream-35)',
              fontFamily: "'Inter', sans-serif",
              margin: 0,
            }}>
              Shipping &amp; taxes calculated at checkout
            </p>
          </div>
        )}
      </div>
    </>
  );
};
