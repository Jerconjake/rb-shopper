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
    <div
      className={bgClass}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div className="result-animate" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '320px' }}>
        {/* Big prize card */}
        <div className={`prize-card-inner ${info.cssClass} w-full`} style={{ padding: '2rem 1.5rem', width: '100%' }}>
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>{info.emoji}</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.03em', marginTop: '0.5rem', lineHeight: 1 }}>
            {info.label}
          </div>
          <div style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.85 }}>
            {info.sublabel}
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'center' }}>
            <img src="./logo.png" alt="Revolution Boutique" style={{ height: 20, width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.7 }} />
          </div>
        </div>

        {/* Instructions */}
        <div style={{ fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' }}>
          <p>Show this screen to your cashier.</p>
          <p style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.35)', marginTop: '4px' }}>Max $150 savings. One per customer.</p>
        </div>

        {/* Done button */}
        <button
          onClick={onDone}
          className="btn btn-wide"
          style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 0, marginTop: '0.5rem' }}
        >
          <CheckCircle size={18} />
          Done — Next Customer
        </button>
      </div>
    </div>
  );
};
