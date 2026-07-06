import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),  // Zero Fees
      setTimeout(() => setPhase(2), 800),  // Instant Execution
      setTimeout(() => setPhase(3), 1600), // Exit drift
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#FFD700]"
      initial={{ scale: 0 }}
      animate={{ scale: 1, borderRadius: ['100%', '0%'] }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative text-center px-8 flex flex-col items-center w-full">
        
        {/* Zero Fees */}
        <motion.div
          className="overflow-hidden"
          initial={{ opacity: 1 }}
        >
          <motion.h1 
            className="text-[8vw] font-black text-[#040B16] leading-none uppercase tracking-tighter"
            initial={{ y: '100%', opacity: 0 }}
            animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            Zero Fees
          </motion.h1>
        </motion.div>

        {/* Instant Execution */}
        <motion.div
          className="mt-4 overflow-hidden"
          initial={{ opacity: 1 }}
        >
          <motion.h2 
            className="text-[4vw] font-bold text-[#1E3A8A] uppercase tracking-widest leading-none"
            initial={{ y: -50, opacity: 0, filter: 'blur(10px)' }}
            animate={phase >= 2 ? { y: 0, opacity: 1, filter: 'blur(0px)' } : { y: -50, opacity: 0, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            Instant Execution
          </motion.h2>
        </motion.div>

      </div>
    </motion.div>
  );
}
