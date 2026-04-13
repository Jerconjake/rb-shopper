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
    <div className="fixed inset-0 z-50 flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingBag size={18} className="text-primary" />
          <span className="font-bold text-base-content">Your Cart</span>
          {itemCount > 0 && (
            <span className="badge badge-primary badge-sm">{itemCount}</span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <ShoppingBag size={48} className="opacity-20" />
            <p className="text-base-content/50 text-sm">Your cart is empty</p>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Keep browsing</button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.cartId} className="flex gap-3 items-start bg-base-200 rounded-xl p-3 border border-base-300">
                {/* Image */}
                <div className="w-16 h-16 rounded-lg bg-base-300 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.image ? (
                    <img src={item.image} alt={item.productTitle} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag size={20} className="opacity-30" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-base-content leading-tight">{item.productTitle}</p>
                  {item.variantTitle && (
                    <p className="text-xs text-base-content/50 mt-0.5">{item.variantTitle}</p>
                  )}
                  <p className="text-primary font-bold text-sm mt-1">
                    ${(parseFloat(item.price) * item.qty).toFixed(2)} CAD
                  </p>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button
                    className="btn btn-ghost btn-xs opacity-40 hover:opacity-100 hover:text-error p-0"
                    onClick={() => onRemove(item.cartId)}
                  >
                    <Trash2 size={13} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-xs btn-circle btn-ghost border border-base-300"
                      onClick={() => onUpdateQty(item.cartId, item.qty - 1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-base-content">{item.qty}</span>
                    <button
                      className="btn btn-xs btn-circle btn-ghost border border-base-300"
                      onClick={() => onUpdateQty(item.cartId, item.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-4 py-4 border-t border-base-300 bg-base-200 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-base-content/60 text-sm">
              Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})
            </span>
            <span className="font-bold text-base-content text-lg">${total.toFixed(2)} CAD</span>
          </div>
          <p className="text-xs text-base-content/40">Shipping & taxes calculated at checkout</p>
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full gap-2"
          >
            Proceed to Checkout <ExternalLink size={14} />
          </a>
          <button className="btn btn-ghost btn-sm w-full text-base-content/60" onClick={onClose}>
            Continue Shopping
          </button>
        </div>
      )}
    </div>
  );
};
