import React, { useState, useRef } from 'react';
import { Send, User } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onHandoff: () => void;
  disabled: boolean;
  handedOff: boolean;
}

export const InputBar: React.FC<Props> = ({ onSend, onHandoff, disabled, handedOff }) => {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    ref.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="input-bar-wrapper">
      {/* Text row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
        background: 'var(--rb-surface)',
        border: '1px solid var(--rb-border-md)',
        padding: '4px 6px 4px 14px',
      }}>
        <textarea
          ref={ref}
          className="chat-textarea"
          placeholder={handedOff ? 'Our team has been notified…' : 'Ask about styles, sizing, occasions…'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={disabled || handedOff}
          style={{ maxHeight: '100px' }}
        />
        <button
          className="btn-send"
          onClick={submit}
          disabled={disabled || handedOff || !value.trim()}
          title="Send"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <button
          className="btn-handoff"
          onClick={onHandoff}
          disabled={handedOff}
        >
          <User size={12} />
          {handedOff ? 'Connected to team' : 'Talk to a person'}
        </button>
        <span style={{
          fontSize: '10px',
          color: 'var(--rb-cream-18)',
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '0.3px',
        }}>
          Revolution Boutique · Ava
        </span>
      </div>
    </div>
  );
};
