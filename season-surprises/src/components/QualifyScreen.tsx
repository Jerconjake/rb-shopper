import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Campaign, Store } from '../types';

interface Props {
  store: Store;
  campaign: Campaign;
  onQualified: () => void;
  onBack: () => void;
}

export const QualifyScreen: React.FC<Props> = ({ store, campaign, onQualified, onBack }) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const parsed = parseFloat(amount.replace(/[^0-9.]/g, ''));
  const qualifies = !isNaN(parsed) && parsed >= campaign.min_purchase;

  const handleSubmit = () => {
    if (!amount) return;
    if (!qualifies) {
      setError(`Purchase must be at least $${campaign.min_purchase.toFixed(0)} to qualify.`);
      return;
    }
    onQualified();
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #e5e5e5', padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: '#111' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <img src="./logo.png" alt="Revolution Boutique" style={{ height: 28, width: 'auto', display: 'block' }} />
          <p style={{ color: '#999', fontSize: '0.72rem', marginTop: '2px', letterSpacing: '0.04em' }}>
            {store.name} · Verify Purchase
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.75rem' }}>

        {/* Icon + title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64,
            border: '1px solid #e5e5e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem', fontSize: '2rem',
          }}>
            🎁
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Ready to Reveal?
          </h3>
          <p style={{ color: '#888', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Enter the customer's purchase total.<br />
            Minimum <strong style={{ color: '#111' }}>${campaign.min_purchase.toFixed(0)}</strong> to qualify.
          </p>
        </div>

        {/* Input */}
        <div style={{ width: '100%', maxWidth: 300 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#f5f5f5',
            border: `1.5px solid ${qualifies ? '#111' : '#e0e0e0'}`,
            padding: '0.85rem 1rem',
            transition: 'border-color 0.2s',
          }}>
            <span style={{ color: qualifies ? '#111' : '#aaa', fontSize: '1.25rem', fontWeight: 600, flexShrink: 0 }}>$</span>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
              min="0"
              step="0.01"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: '#111', fontSize: '1.5rem', fontWeight: 700,
                width: '100%', fontFamily: "'Outfit', sans-serif",
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#c00', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>
          )}

          {qualifies && (
            <p style={{ color: '#111', fontSize: '0.8rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
              ✓ Qualifies — ready to open an envelope
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={!amount}
          style={{
            width: '100%', maxWidth: 300, padding: '1rem',
            background: qualifies ? '#111111' : '#e5e5e5',
            border: 'none',
            color: qualifies ? '#ffffff' : '#aaa',
            fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em',
            textTransform: 'uppercase', cursor: amount ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s', borderRadius: 0,
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Open an Envelope
        </button>

        <p style={{ color: '#bbb', fontSize: '0.7rem', textAlign: 'center', letterSpacing: '0.03em' }}>
          One envelope per customer per visit.
        </p>
      </div>
    </div>
  );
};
