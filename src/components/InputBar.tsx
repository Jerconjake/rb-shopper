import React, { useState, useRef, useEffect } from 'react';
import { Send, UserCircle } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
  onHandoff: () => void;
  disabled: boolean;
  handedOff: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend, onHandoff, disabled, handedOff }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) textareaRef.current.focus();
  }, [disabled]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (handedOff) {
    return (
      <div style={{
        borderTop: '1px solid rgba(240,236,228,0.06)',
        padding: '16px 20px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '12px', color: 'rgba(240,236,228,0.25)', fontFamily: "'Inter', sans-serif", letterSpacing: '0.3px' }}>
          Chat ended · Our team will be in touch soon
        </p>
      </div>
    );
  }

  return (
    <div style={{
      borderTop: '1px solid rgba(240,236,228,0.06)',
      padding: '14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      background: '#080808',
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask Ava anything…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          style={{ maxHeight: '100px' }}
        />
        <button
          className="btn-send-luxury"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          title="Send"
        >
          <Send size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '10px', color: 'rgba(240,236,228,0.15)', fontFamily: "'Inter', sans-serif", letterSpacing: '0.2px' }}>
          Enter to send · Shift+Enter for new line
        </p>
        <button
          className="btn-handoff-luxury"
          onClick={onHandoff}
          disabled={disabled}
        >
          <UserCircle size={12} />
          Talk to a person
        </button>
      </div>
    </div>
  );
};
