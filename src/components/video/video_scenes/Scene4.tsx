import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4500),
      setTimeout(() => setPhase(4), 6500),
      setTimeout(() => setPhase(5), 8500),
      setTimeout(() => setPhase(6), 10500),
      setTimeout(() => setPhase(7), 13000), // Fade all together
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const features = [
    "21 Interactive Courses",
    "Proof-of-Residual-Value Mining",
    "Flash Arbitrage Loans — Zero Collateral",
    "Perpetual Royalty Income (RVTs)",
    "Merchant Payment Gateway",
    "KUTL Card — Spend Your Knowledge",
  ];

  const positions = [
    { top: '10%', left: '10%', rotate: -5 },
    { top: '25%', right: '10%', rotate: 8 },
    { top: '40%', left: '15%', rotate: -3 },
    { top: '55%', right: '15%', rotate: 5 },
    { top: '70%', left: '12%', rotate: -7 },
    { top: '85%', right: '12%', rotate: 4 },
  ];

  return (
    <motion.div
      className="absolute inset-0 z-40 bg-[#0a0a0a]"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8 }}
    >
      {/* Background kinetic grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(201,168,76,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(201,168,76,0.05)_1px,transparent_1px)] bg-[size:4vw_4vw]" />

      <div className="relative w-full h-full max-w-[90vw] mx-auto">
        {features.map((feat, index) => {
          const isVisible = phase > index;
          return (
            <motion.div
              key={index}
              className="absolute bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#C9A84C]/40 p-[2vw] rounded-xl shadow-[0_10px_30px_rgba(201,168,76,0.15)]"
              style={{
                top: positions[index].top,
                ...(positions[index].left ? { left: positions[index].left } : { right: positions[index].right }),
                transformOrigin: positions[index].left ? 'left center' : 'right center',
              }}
              initial={{ opacity: 0, x: positions[index].left ? -100 : 100, rotate: 0 }}
              animate={
                isVisible 
                  ? { opacity: phase === 7 ? 0 : 1, x: 0, rotate: positions[index].rotate } 
                  : { opacity: 0, x: positions[index].left ? -100 : 100, rotate: 0 }
              }
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <h3 className="text-[3vw] font-display text-[#C9A84C] uppercase tracking-wide m-0 leading-none">
                {feat}
              </h3>
            </motion.div>
          );
        })}
      </div>
      
      {/* Central glow */}
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] bg-[#C9A84C] rounded-full blur-[100px] opacity-10 pointer-events-none"
        animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </motion.div>
  );
}