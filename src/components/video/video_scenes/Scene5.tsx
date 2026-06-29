import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-50 overflow-hidden"
      initial={{ opacity: 0, y: '10%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      {/* Warm hopeful background elements */}
      <motion.div 
        className="absolute top-0 w-full h-[50vh] bg-gradient-to-b from-[#C9A84C]/20 to-transparent blur-2xl"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="absolute inset-0 flex flex-col justify-center items-center space-y-[8vh]">
        <motion.h2
          className="text-[6vw] font-display uppercase tracking-widest text-[#F5F5F5] drop-shadow-xl"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          Break the cycle.
        </motion.h2>

        <motion.h2
          className="text-[6vw] font-display uppercase tracking-widest text-[#C9A84C] drop-shadow-[0_0_20px_rgba(201,168,76,0.4)]"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          Build generational wealth.
        </motion.h2>

        <motion.div
          className="bg-[#00C896] text-black px-[4vw] py-[1.5vw] rounded-sm font-display text-[4vw] uppercase tracking-wider"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          Start FREE.
        </motion.div>
      </div>
      
      {/* Gold particle floaters */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[1vw] h-[1vw] bg-[#C9A84C] rounded-full blur-[2px]"
          initial={{ 
            x: `${Math.random() * 100}vw`, 
            y: '100vh',
            opacity: 0.2 + Math.random() * 0.5
          }}
          animate={{ 
            y: '-10vh',
            x: `${(Math.random() - 0.5) * 20 + 50}vw` 
          }}
          transition={{ 
            duration: 5 + Math.random() * 5, 
            repeat: Infinity, 
            delay: Math.random() * 5,
            ease: 'linear' 
          }}
        />
      ))}
    </motion.div>
  );
}