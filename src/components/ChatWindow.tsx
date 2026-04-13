import React, { useEffect, useRef } from 'react';
import { ChatMessage, Product } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onAddToCart: (p: Product) => void;
}

export const ChatWindow: React.FC<Props> = ({ messages, isLoading, onAddToCart }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px 18px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {messages.map(msg => (
        <MessageBubble key={msg.id} msg={msg} onAddToCart={onAddToCart} />
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'var(--rb-surface)',
            border: '1px solid var(--rb-border)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            borderRadius: '2px 2px 2px 0',
          }}>
            <span style={{
              display: 'inline-block',
              width: '18px',
              height: '18px',
              background: 'var(--rb-accent)',
              color: '#fff',
              fontSize: '9px',
              fontFamily: "'Cormorant Garamond', serif",
              textAlign: 'center',
              lineHeight: '18px',
              marginRight: '6px',
            }}>A</span>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
