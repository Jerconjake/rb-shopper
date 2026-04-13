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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} onAddToCart={onAddToCart} />
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="flex gap-2 items-start">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-primary">✦</span>
          </div>
          <div className="bg-base-200 rounded-2xl rounded-tl-sm px-4 py-3">
            <span className="loading loading-dots loading-sm text-primary" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
