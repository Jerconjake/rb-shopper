import React from 'react';
import { X, ShoppingBag, Trash2, ExternalLink } from 'lucide-react';
import { CartItem } from '../types';

const STORE_URL = 'https://revolutionboutique.ca';

interface CartDrawerProps {
  items: CartItem[];
  open: boolean;
  onClose: () => void;
  onUpdateQty: (cartId: string, qty: number) => void;
  onRemove: (cartId: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ items, open, onClose, onUpdateQty, onRemove }) => {
  if (!open) return null;

  const total = items.reduce((sum, item) => sum + parseFloat(item.price) * item.qty, 0);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      background: '#080808',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(240,236,228,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '20px',
            color: '#f0ece4',
            fontWeight: 400,
            letterSpacing: '0.5px',
          }}>
            Your Selections
          </p>
          {itemCount > 0 && (
            <span style={{
              background: '#c4a26e',
              color: '#080808',
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 7px',
              fontFamily: "'Inter', sans-serif",
            }}>
              {itemCount}
            </span>
          )}
        </div>
        <button
          className="btn-icon-luxury"
          onClick={onClose}
          style={{ padding: '6px' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {items.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: '16px', textAlign: 'center',
          }}>
            <ShoppingBag size={36} style={{ color: 'rgba(240,236,228,0.1)' }} />
            <p style={{ fontSize: '14px', color: 'rgba(240,236,228,0.3)', fontFamily: "'Inter', sans-serif" }}>
              Nothing here yet
            </p>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid rgba(240,236,228,0.15)',
                color: 'rgba(240,236,228,0.6)',
                padding: '10px 20px',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Keep Browsing
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => (
              <div key={item.cartId} style={{
                display: 'flex', gap: '14px', alignItems: 'flex-start',
                padding: '14px',
                border: '1px solid rgba(240,236,228,0.06)',
                background: '#0f0f0f',
              }}>
                {/* Image */}
                <div style={{
                  width: '60px', height: '60px',
                  background: '#1a1a1a',
                  flexShrink: 0,
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.image ? (
                    <img src={item.image} alt={item.productTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ShoppingBag size={16} style={{ color: 'rgba(240,236,228,0.15)' }} />
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: '#f0ece4', fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}>
                    {item.productTitle}
                  </p>
                  {item.variantTitle && (
                    <p style={{ fontSize: '11px', color: 'rgba(240,236,228,0.35)', fontFamily: "'Inter', sans-serif", marginTop: '3px' }}>
                      {item.variantTitle}
                    </p>
                  )}
                  <p style={{
                    fontSize: '14px',
                    color: '#c4a26e',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 500,
                    marginTop: '6px',
                  }}>
                    ${(parseFloat(item.price) * item.qty).toFixed(2)} CAD
                  </p>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                  <button className="btn-icon-luxury" onClick={() => onRemove(item.cartId)} style={{ padding: '3px' }}>
                    <Trash2 size={13} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => onUpdateQty(item.cartId, item.qty - 1)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(240,236,228,0.12)',
                        color: 'rgba(240,236,228,0.6)',
                        width: '24px', height: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >−</button>
                    <span style={{ fontSize: '13px', color: '#f0ece4', fontFamily: "'Inter', sans-serif", minWidth: '12px', textAlign: 'center' }}>
                      {item.qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(item.cartId, item.qty + 1)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(240,236,228,0.12)',
                        color: 'rgba(240,236,228,0.6)',
                        width: '24px', height: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div style={{
          padding: '20px',
          borderTop: '1px solid rgba(240,236,228,0.06)',
          background: '#080808',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.35)', fontFamily: "'Inter', sans-serif" }}>
              Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})
            </span>
            <span style={{
              fontSize: '20px',
              color: '#f0ece4',
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 500,
            }}>
              ${total.toFixed(2)} CAD
            </span>
          </div>
          <p style={{ fontSize: '10px', color: 'rgba(240,236,228,0.2)', fontFamily: "'Inter', sans-serif" }}>
            Shipping & taxes calculated at checkout
          </p>
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: '#f0ece4',
              color: '#080808',
              padding: '14px',
              textDecoration: 'none',
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
          >
            Proceed to Checkout <ExternalLink size={13} />
          </a>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(240,236,228,0.25)',
              fontSize: '11px',
              letterSpacing: '1px',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              padding: '6px',
            }}
          >
            Continue Shopping
          </button>
        </div>
      )}
    </div>
  );
};
