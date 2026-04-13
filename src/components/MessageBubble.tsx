import React from 'react';
import { User, Sparkles, Phone } from 'lucide-react';
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
      <div className="flex justify-center my-2">
        <div className="card bg-base-200 border border-secondary/40 max-w-xs w-full">
          <div className="card-body p-4 items-center text-center gap-2">
            <div className="bg-secondary/20 rounded-full p-2">
              <Phone size={18} className="text-secondary" />
            </div>
            <p className="font-semibold text-base-content text-sm">Connecting you with our team</p>
            <p className="text-xs text-base-content/60 leading-relaxed">
              We'll follow up shortly! In the meantime, feel free to browse the store.
            </p>
            <div className="divider my-0 opacity-30" />
            <div className="text-xs text-base-content/50 space-y-1">
              <p>📍 Four locations across Alberta</p>
              <p>🕙 Mon–Fri 10am–6pm · Sat 10am–5pm</p>
              <p>📧 hello@revolutionboutique.ca</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles size={14} className="text-primary" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0 mt-1">
          <User size={14} className="text-base-content/60" />
        </div>
      )}

      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-content rounded-tr-sm'
              : 'bg-base-200 text-base-content rounded-tl-sm'
          }`}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {message.text}
        </div>

        {/* Product cards */}
        {message.products && message.products.length > 0 && (
          <div className="flex flex-row gap-2 overflow-x-auto pb-1 max-w-full">
            {message.products.map(p => (
              <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
