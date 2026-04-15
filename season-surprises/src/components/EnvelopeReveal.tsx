import React, { useState, useEffect, useCallback } from 'react';
import { Prize, PRIZE_INFO } from '../types';

type Phase = 'idle' | 'shaking' | 'opening' | 'revealed';

interface Props {
  prize: Prize;
  onComplete: () => void;
}

const CONFETTI = ['🎉','✨','🎊','⭐','💫','🌟','🎈','🎀'];

interface ConfettiPiece {
  id: number;
  emoji: string;
  left: number;
  delay: number;
}

export const EnvelopeReveal: React.FC<Props> = ({ prize, onComplete }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const info = PRIZE_INFO[prize.type];

  const handleTap = useCallback(() => {
    if (phase !== 'idle') return;

    setPhase('shaking');

    setTimeout(() => {
      setPhase('opening');

      setTimeout(() => {
        const pieces: ConfettiPiece[] = Array.from({ length: 14 }, (_, i) => ({
          id: i,
          emoji: CONFETTI[i % CONFETTI.length],
          left: 10 + Math.random() * 80,
          delay: Math.random() * 0.4,
        }));
        setConfetti(pieces);
        setPhase('revealed');
      }, 600);
    }, 500);
  }, [phase]);

  useEffect(() => {
    if (phase === 'revealed') {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  const envelopeClass =
    phase === 'idle'     ? 'envelope-wrap env-idle envelope-glow' :
    phase === 'shaking'  ? 'envelope-wrap env-shaking' :
                           'envelope-wrap env-open';

  const flapClass = `env-flap ${phase === 'opening' || phase === 'revealed' ? 'flap-opening' : ''}`;
  const prizeClass = `prize-float ${phase === 'revealed' ? 'prize-rising' : ''}`;

  return (
    <div
      className="reveal-bg select-none overflow-hidden"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 0,
      }}
      onClick={handleTap}
    >
      {/* Confetti */}
      {confetti.map((c) => (
        <span
          key={c.id}
          className="confetti-piece"
          style={{
            left: `${c.left}%`,
            bottom: '45%',
            animationDelay: `${c.delay}s`,
          }}
        >
          {c.emoji}
        </span>
      ))}

      {/* Logo + Header text */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', padding: '0 1rem' }}>
        <img
          src="./logo.png"
          alt="Revolution Boutique"
          style={{ height: 32, width: 'auto', opacity: 0.7, marginBottom: '1.25rem', display: 'block', margin: '0 auto 1.25rem' }}
        />
        {phase === 'idle' && (
          <>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>Your Surprise Awaits</h2>
            <p className="tap-hint" style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tap the envelope to reveal</p>
          </>
        )}
        {(phase === 'shaking' || phase === 'opening') && (
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }}>Opening…</h2>
        )}
        {phase === 'revealed' && (
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }}>Congratulations!</h2>
        )}
      </div>

      {/* Envelope */}
      <div className={envelopeClass} style={{ position: 'relative' }}>
        <div className="env-body" />
        <div className="env-fold-left" />
        <div className="env-fold-right" />
        <div className="env-fold-bottom" />
        <div className={flapClass} />

        {phase === 'idle' && (
          <div className="env-seal">💌</div>
        )}

        <div className={prizeClass}>
          <div className={`prize-card-inner ${info.cssClass}`}>
            <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{info.emoji}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', marginTop: '0.25rem' }}>
              {info.label}
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.85 }}>
              {info.sublabel}
            </div>
          </div>
        </div>
      </div>

      {/* Footer — tight, no big margin */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '0 1rem' }}>
        {phase === 'idle' && (
          <p style={{ color: 'rgba(0,0,0,0.2)', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Revolution Boutique · Season of Surprises</p>
        )}
        {phase === 'revealed' && (
          <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.85rem' }}>Show this to your cashier ✦</p>
        )}
      </div>
    </div>
  );
};
