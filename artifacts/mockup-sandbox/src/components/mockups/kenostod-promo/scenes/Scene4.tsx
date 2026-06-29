import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const FEATURES = [
  { label: '21 Interactive Courses', left: true, top: '8%', side: '6%' },
  { label: 'Proof-of-Residual-Value Mining', left: false, top: '22%', side: '6%' },
  { label: 'Flash Arbitrage Loans — Zero Collateral', left: true, top: '38%', side: '4%' },
  { label: 'Perpetual Royalty Income (RVTs)', left: false, top: '54%', side: '4%' },
  { label: 'Merchant Payment Gateway', left: true, top: '70%', side: '6%' },
  { label: 'KUTL Card — Spend Your Knowledge', left: false, top: '84%', side: '6%' },
];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3600),
      setTimeout(() => setPhase(4), 5200),
      setTimeout(() => setPhase(5), 6800),
      setTimeout(() => setPhase(6), 8400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-hidden"
      style={{ background: '#0a0a0a' }}
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8 }}
    >
      {/* Gold grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.05) 1px, transparent 1px)',
          backgroundSize: '4vw 4vw',
        }}
      />

      {/* Central pulse */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '35vw', height: '35vw',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#C9A84C',
          filter: 'blur(100px)',
        }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.08, 0.18, 0.08] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      {FEATURES.map((feat, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{
            top: feat.top,
            [feat.left ? 'left' : 'right']: feat.side,
            maxWidth: '44vw',
          }}
          initial={{ opacity: 0, x: feat.left ? -120 : 120 }}
          animate={phase > index ? { opacity: 1, x: 0 } : { opacity: 0, x: feat.left ? -120 : 120 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a, #0f0f0f)',
            border: '1px solid rgba(201,168,76,0.35)',
            padding: '1.5vw 2vw',
            borderRadius: '0.5vw',
            boxShadow: '0 8px 30px rgba(201,168,76,0.12)',
          }}>
            <span className="font-display uppercase text-[#C9A84C] tracking-wide" style={{ fontSize: '2.4vw', lineHeight: 1 }}>
              {feat.label}
            </span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
