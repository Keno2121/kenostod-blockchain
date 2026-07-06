import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),  // Cards appear
      setTimeout(() => setPhase(2), 1000), // Flow of coins starts
      setTimeout(() => setPhase(3), 2800), // Exiting
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative w-full max-w-6xl mx-auto flex items-center justify-between px-16">
        
        {/* Exchange A */}
        <motion.div 
          className="w-[30vw] bg-[#0A1930]/80 border border-[#1E3A8A] rounded-2xl p-8 backdrop-blur-md flex flex-col items-center shadow-[0_0_30px_rgba(30,58,138,0.5)]"
          initial={{ opacity: 0, x: -50, rotateY: -30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0, rotateY: 0 } : { opacity: 0, x: -50, rotateY: -30 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{ perspective: 1000 }}
        >
          <div className="text-[#FFD700] text-[2vw] font-bold uppercase tracking-wider mb-2">Exchange A</div>
          <div className="text-white text-[5vw] font-black font-body leading-none">$8.30</div>
        </motion.div>

        {/* The Flow */}
        <div className="flex-1 h-32 relative mx-8 flex items-center justify-center">
          <AnimatePresence>
            {phase >= 2 && (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Arrow line */}
                <div className="absolute w-full h-1 bg-[#1E3A8A] rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-[#FFD700] shadow-[0_0_10px_#FFD700]"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                
                {/* Flowing coins */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute w-8 h-8 rounded-full bg-[#FFD700] shadow-[0_0_15px_#FFD700] border-2 border-white flex items-center justify-center z-10"
                    initial={{ left: '0%', opacity: 0, scale: 0 }}
                    animate={{ left: '100%', opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: 'linear' }}
                  >
                    <span className="text-[#0A1930] text-xs font-bold">$</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Exchange B */}
        <motion.div 
          className="w-[30vw] bg-[#0A1930]/80 border border-[#1E3A8A] rounded-2xl p-8 backdrop-blur-md flex flex-col items-center shadow-[0_0_30px_rgba(30,58,138,0.5)]"
          initial={{ opacity: 0, x: 50, rotateY: 30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0, rotateY: 0 } : { opacity: 0, x: 50, rotateY: 30 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
          style={{ perspective: 1000 }}
        >
          <div className="text-[#FFD700] text-[2vw] font-bold uppercase tracking-wider mb-2">Exchange B</div>
          <div className="text-white text-[5vw] font-black font-body leading-none">$8.79</div>
        </motion.div>

      </div>
    </motion.div>
  );
}
