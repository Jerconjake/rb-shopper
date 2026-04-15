import React, { useState } from 'react';
import { ArrowLeft, DollarSign } from 'lucide-react';
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
    if (!qualifies) {
      setError(`Purchase must be at least $${campaign.min_purchase.toFixed(0)} to qualify.`);
      return;
    }
    onQualified();
  };

  return (
    <div className="rb-screen-bg flex flex-col">
      {/* Header */}
      <div className="rb-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} className="btn btn-ghost btn-sm btn-square" style={{ color: 'rgba(245,238,228,0.5)', background: 'transparent', border: 'none' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.png" alt="Revolution Boutique" className="rb-logo" style={{ height: 24 }} />
          </div>
          <p style={{ color: 'rgba(245,238,228,0.35)', fontSize: '0.72rem', marginTop: '2px', letterSpacing: '0.04em' }}>
            {store.name} · Verify Purchase
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '2rem' }}>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, border: '1px solid rgba(201,131,90,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem', fontSize: '2rem'
          }}>
            🎁
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f5eee4', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Ready to Reveal?
          </h3>
          <p style={{ color: 'rgba(245,238,228,0.45)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            Enter the customer's purchase total.<br />
            Minimum{' '}
            <span style={{ color: '#c9835a', fontWeight: 600 }}>${campaign.min_purchase.toFixed(0)}</span>
            {' '}to qualify.
          </p>
        </div>

        {/* Input */}
        <div style={{ width: '100%', maxWidth: 280 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#1c1917', border: `1px solid ${qualifies ? '#c9835a' : 'rgba(255,255,255,0.1)'}`,
            padding: '0.75rem 1rem', transition: 'border-color 0.2s',
          }}>
            <DollarSign size={18} style={{ color: qualifies ? '#c9835a' : 'rgba(245,238,228,0.3)', flexShrink: 0 }} />
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
                color: '#f5eee4', fontSize: '1.5rem', fontWeight: 700,
                width: '100%',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>
          )}

          {qualifies && (
            <p style={{ color: '#c9835a', fontSize: '0.8rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✓ Qualifies — ready to open an envelope
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={!amount}
          style={{
            width: '100%', maxWidth: 280, padding: '1rem',
            background: qualifies ? '#c9835a' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${qualifies ? '#c9835a' : 'rgba(255,255,255,0.1)'}`,
            color: qualifies ? '#fff' : 'rgba(245,238,228,0.3)',
            fontWeight: 700, fontSize: '1rem', letterSpacing: '0.04em',
            textTransform: 'uppercase', cursor: amount ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s', borderRadius: 0,
          }}
        >
          Open an Envelope
        </button>

        <p style={{ color: 'rgba(245,238,228,0.2)', fontSize: '0.7rem', textAlign: 'center', letterSpacing: '0.03em' }}>
          One envelope per customer per visit. Max $150 savings.
        </p>
      </div>
    </div>
  );
};
