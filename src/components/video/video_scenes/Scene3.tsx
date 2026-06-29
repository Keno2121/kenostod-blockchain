import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),  // Pair 1
      setTimeout(() => setPhase(2), 3800), // Pair 2
      setTimeout(() => setPhase(3), 6800), // Pair 3
      setTimeout(() => setPhase(4), 9800), // Pair 4
      setTimeout(() => setPhase(5), 13000), // Exit drift
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const pairs = [
    { bad: "Irreversible", good: "5-Minute Reversal Window" },
    { bad: "Lost Seed Phrase = Lost Funds", good: "Guardian Recovery System" },
    { bad: "Speculation & Hype", good: "Earn Through Education" },
    { bad: "Complex", good: "Learn by Doing" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex z-30"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* LEFT: Chaos */}
      <div className="w-1/2 h-full bg-[#1a0505] border-r border-[#ff0033]/30 flex flex-col justify-center items-center p-12 relative overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,51,0.1),transparent_70%)]"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="absolute top-10 left-10 text-[#ff0033]/50 font-display text-[8vw] leading-none opacity-20">CHAOS</div>
        
        <AnimatePresence mode="wait">
          {phase > 0 && phase <= 4 && (
            <motion.div
              key={`bad-${phase}`}
              className="text-[#ff0033] text-[3.5vw] font-display uppercase tracking-wider text-center relative z-10 drop-shadow-[0_0_15px_rgba(255,0,51,0.5)]"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50, transition: { duration: 0.3 } }}
            >
              <span className="block text-[4vw] mb-4">❌</span>
              {pairs[phase - 1].bad}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT: Order */}
      <div className="w-1/2 h-full bg-[#051a13] flex flex-col justify-center items-center p-12 relative overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,200,150,0.1),transparent_70%)]"
          animate={{ scale: [1.2, 1, 1.2] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <div className="absolute bottom-10 right-10 text-[#00C896]/50 font-display text-[8vw] leading-none opacity-20">ORDER</div>

        <AnimatePresence mode="wait">
          {phase > 0 && phase <= 4 && (
            <motion.div
              key={`good-${phase}`}
              className="text-[#00C896] text-[3.5vw] font-display uppercase tracking-wider text-center relative z-10 drop-shadow-[0_0_15px_rgba(0,200,150,0.5)]"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50, transition: { duration: 0.3 } }}
            >
              <span className="block text-[4vw] mb-4">✅</span>
              {pairs[phase - 1].good}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}