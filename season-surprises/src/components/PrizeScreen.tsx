import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Prize, PRIZE_INFO, PrizeType } from '../types';

interface Props {
  prize: Prize;
  onDone: () => void;
}

const BG_CLASS: Record<PrizeType, string> = {
  '50_off':    'prize-bg-50',
  '20_off':    'prize-bg-20',
  '10_off':    'prize-bg-10',
  'free_gift': 'prize-bg-gift',
};

export const PrizeScreen: React.FC<Props> = ({ prize, onDone }) => {
  const info = PRIZE_INFO[prize.type];
  const bgClass = BG_CLASS[prize.type];

  return (
    <div className={`${bgClass} min-h-screen flex flex-col items-center justify-center p-8 text-center`}>
      <div className="result-animate flex flex-col items-center gap-6 w-full" style={{ maxWidth: 320 }}>
        {/* Big prize card */}
        <div className={`prize-card-inner ${info.cssClass} w-full`} style={{ padding: '2rem 1.5rem' }}>
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>{info.emoji}</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.03em', marginTop: '0.5rem', lineHeight: 1 }}>
            {info.label}
          </div>
          <div style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.85 }}>
            {info.sublabel}
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'center' }}>
            <img src="/logo.png" alt="Revolution Boutique" style={{ height: 20, width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
          </div>
        </div>

        {/* Instructions */}
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
          <p>Show this screen to your cashier.</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '4px' }}>Max $150 savings. One per customer.</p>
        </div>

        {/* Done button (staff taps when finished) */}
        <button
          onClick={onDone}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '0.75rem 2rem', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
            fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', marginTop: 8,
            width: '100%',
          }}
        >
          <CheckCircle size={18} />
          Done — Next Customer
        </button>
      </div>
    </div>
  );
};
