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
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
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
      <div className="border-t border-base-300 px-4 py-3">
        <p className="text-center text-sm text-base-content/40">
          Chat ended · Our team will be in touch soon 💌
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-base-300 px-3 py-3 flex flex-col gap-2">
      <div className="flex gap-2 items-end">
        <label className="textarea textarea-bordered flex-1 flex items-end min-h-10 max-h-28 p-0 overflow-hidden">
          <textarea
            ref={textareaRef}
            className="resize-none w-full bg-transparent px-3 py-2.5 text-sm focus:outline-none min-h-10 max-h-28"
            placeholder="Ask Ava anything…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
          />
        </label>
        <button
          className="btn btn-primary btn-square flex-shrink-0"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          title="Send"
        >
          <Send size={16} />
        </button>
      </div>
      <div className="flex justify-between items-center px-1">
        <p className="text-xs text-base-content/30">Press Enter to send · Shift+Enter for new line</p>
        <button
          className="btn btn-xs btn-ghost text-base-content/40 gap-1 hover:text-secondary"
          onClick={onHandoff}
          disabled={disabled}
        >
          <UserCircle size={13} />
          Talk to a person
        </button>
      </div>
    </div>
  );
};
