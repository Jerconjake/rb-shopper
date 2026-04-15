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

      // Spawn confetti after flap starts opening
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

  // Auto-advance after prize is revealed
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
      className="reveal-bg flex flex-col items-center justify-center min-h-screen select-none overflow-hidden"
      style={{ position: 'relative' }}
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
      <div className="text-center mb-10 px-4">
        <img
          src="/logo.png"
          alt="Revolution Boutique"
          style={{ height: 28, width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.6, marginBottom: '1.5rem', display: 'block', margin: '0 auto 1.5rem' }}
        />
        {phase === 'idle' && (
          <>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f5eee4', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Your Surprise Awaits</h2>
            <p className="tap-hint" style={{ color: 'rgba(201,131,90,0.7)', fontSize: '0.85rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tap the envelope to reveal</p>
          </>
        )}
        {(phase === 'shaking' || phase === 'opening') && (
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f5eee4', letterSpacing: '-0.02em' }}>Opening...</h2>
        )}
        {phase === 'revealed' && (
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f5eee4', letterSpacing: '-0.02em' }}>Congratulations!</h2>
        )}
      </div>

      {/* Envelope */}
      <div className={envelopeClass} style={{ position: 'relative' }}>
        {/* Body */}
        <div className="env-body" />

        {/* Inner fold shadows */}
        <div className="env-fold-left" />
        <div className="env-fold-right" />
        <div className="env-fold-bottom" />

        {/* Flap */}
        <div className={flapClass} />

        {/* Wax seal */}
        {phase === 'idle' && (
          <div className="env-seal">💌</div>
        )}

        {/* Prize card rises from envelope */}
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

      {/* Footer */}
      <div className="mt-16 text-center px-4">
        {phase === 'idle' && (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>Revolution Boutique · Season of Surprises</p>
        )}
        {phase === 'revealed' && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Show this to your cashier ✦</p>
        )}
      </div>
    </div>
  );
};
