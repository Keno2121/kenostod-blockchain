import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PAIRS = [
  { bad: 'Irreversible', good: '5-Minute Reversal Window' },
  { bad: 'Lost Seed Phrase = Lost Funds', good: 'Guardian Recovery System' },
  { bad: 'Speculation & Hype', good: 'Earn Through Education' },
  { bad: 'Complex', good: 'Learn by Doing' },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 4300),
      setTimeout(() => setPhase(3), 7800),
      setTimeout(() => setPhase(4), 11300),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex z-30"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* LEFT: Chaos */}
      <div className="relative w-1/2 h-full flex flex-col justify-center items-center overflow-hidden" style={{ background: '#110305', borderRight: '1px solid rgba(255,0,51,0.25)' }}>
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(255,0,51,0.12), transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="absolute top-[5vh] left-[4vw] font-display opacity-10 text-[#ff0033]" style={{ fontSize: '9vw', lineHeight: 1 }}>CHAOS</div>

        <AnimatePresence mode="wait">
          {phase >= 1 && (
            <motion.div
              key={`bad-${phase}`}
              className="relative z-10 text-center px-8"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5 }}
            >
              <span className="block" style={{ fontSize: '4vw', marginBottom: '2vh' }}>❌</span>
              <span className="font-display uppercase text-[#ff0033] tracking-wider" style={{ fontSize: '3vw', filter: 'drop-shadow(0 0 12px rgba(255,0,51,0.5))' }}>
                {PAIRS[phase - 1]?.bad}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT: Order */}
      <div className="relative w-1/2 h-full flex flex-col justify-center items-center overflow-hidden" style={{ background: '#041209' }}>
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(0,200,150,0.12), transparent 70%)' }}
          animate={{ scale: [1.2, 1, 1.2] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <div className="absolute bottom-[5vh] right-[4vw] font-display opacity-10 text-[#00C896]" style={{ fontSize: '9vw', lineHeight: 1 }}>ORDER</div>

        <AnimatePresence mode="wait">
          {phase >= 1 && (
            <motion.div
              key={`good-${phase}`}
              className="relative z-10 text-center px-8"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5 }}
            >
              <span className="block" style={{ fontSize: '4vw', marginBottom: '2vh' }}>✅</span>
              <span className="font-display uppercase text-[#00C896] tracking-wider" style={{ fontSize: '3vw', filter: 'drop-shadow(0 0 12px rgba(0,200,150,0.5))' }}>
                {PAIRS[phase - 1]?.good}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Center divider glow */}
      <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: '50%', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.1) 70%, transparent)' }} />
    </motion.div>
  );
}
