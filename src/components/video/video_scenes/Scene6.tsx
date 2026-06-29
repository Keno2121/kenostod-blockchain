import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-[60]"
      initial={{ opacity: 0, filter: 'brightness(2)' }}
      animate={{ opacity: 1, filter: 'brightness(1)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="relative w-[25vw] h-[25vw] mb-[5vh]"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}shield-logo.png`} 
          alt="Kenostod Logo"
          className="w-full h-full object-contain relative z-10"
        />
        {/* Pulsing glow behind logo */}
        <motion.div 
          className="absolute inset-0 bg-[#00C896] rounded-full blur-[60px] opacity-40 -z-10"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-[4vw] font-display uppercase tracking-[0.2em] text-white mb-2">
          KENOSTODBLOCKCHAIN.COM
        </h2>
        <p className="text-[2vw] text-[#C9A84C] uppercase tracking-wider font-semibold">
          Start Your Free Lesson Today
        </p>
      </motion.div>
    </motion.div>
  );
}