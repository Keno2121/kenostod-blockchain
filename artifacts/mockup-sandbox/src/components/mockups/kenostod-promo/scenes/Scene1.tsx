import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 5500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const questions = [
    <>Lost your life savings<br /><span className="text-[#ff0033]">to a crypto scam?</span></>,
    <>Sent Bitcoin to the<br /><span className="text-[#ff0033]">wrong address?</span></>,
    <>Forgot your<br /><span className="text-[#ff0033]">seed phrase?</span></>,
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      {/* 6174 — hidden in the chaos, flickers once at 1.5s then vanishes */}
      <motion.div
        className="absolute font-display text-[#C9A84C] pointer-events-none select-none"
        style={{ fontSize: '18vw', opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', filter: 'blur(4px)' }}
        animate={{
          opacity: [0, 0.18, 0],
          filter: ['blur(4px)', 'blur(1px)', 'blur(8px)'],
        }}
        transition={{ delay: 1.5, duration: 0.4, ease: 'easeInOut' }}
      >
        6174
      </motion.div>

      {/* Scanline glitch */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 2px, rgba(255,0,51,0.04) 2px, rgba(255,0,51,0.04) 4px)',
        }}
        animate={{ y: [0, 8, -4, 0] }}
        transition={{ duration: 0.15, repeat: Infinity, ease: 'linear' }}
      />

      {/* Red vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(255,0,51,0.15) 100%)' }}
      />

      <div className="relative w-full max-w-5xl px-8 text-center h-[40vh] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {phase >= 1 && (
            <motion.h2
              key={`q-${phase}`}
              className="text-[5vw] font-display text-[#F5F5F5] uppercase leading-tight tracking-wide text-shadow-glitch"
              initial={{ opacity: 0, x: -30, skewX: 15 }}
              animate={{ opacity: 1, x: 0, skewX: 0 }}
              exit={{ opacity: 0, x: 30, filter: 'blur(6px)', transition: { duration: 0.25 } }}
              transition={{ duration: 0.5 }}
            >
              {questions[phase - 1]}
            </motion.h2>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom voiceover hint */}
      <motion.p
        className="absolute bottom-[8vh] text-[1.4vw] text-[#F5F5F5]/40 uppercase tracking-widest font-display"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
      >
        Blockchain was supposed to protect us...
      </motion.p>
    </motion.div>
  );
}
