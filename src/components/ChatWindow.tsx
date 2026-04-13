import React, { useEffect, useRef } from 'react';
import { ChatMessage, Product } from '../types';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onAddToCart?: (product: Product) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading, onAddToCart }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px 20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} onAddToCart={onAddToCart} />
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }} className="fade-slide-up">
          {/* Avatar */}
          <div style={{
            width: '28px', height: '28px',
            border: '1px solid rgba(196,162,110,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: '2px',
          }}>
            <span style={{ fontSize: '12px', color: '#c4a26e', fontFamily: "'Cormorant Garamond', serif" }}>A</span>
          </div>
          {/* Dots */}
          <div style={{
            background: '#111',
            border: '1px solid rgba(240,236,228,0.06)',
            padding: '12px 16px',
            display: 'flex', gap: '5px', alignItems: 'center',
          }}>
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
