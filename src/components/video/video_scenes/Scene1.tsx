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

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      {/* Glitchy red overlay lines */}
      <motion.div 
        className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(255,0,51,0.05)_50%)] bg-[length:100%_4px] pointer-events-none"
        animate={{ y: [0, 10, -5, 0] }}
        transition={{ duration: 0.2, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative w-full max-w-5xl px-8 text-center h-[30vh] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.h2 
              key="q1"
              className="text-[5vw] font-bold text-[#F5F5F5] uppercase leading-tight font-display tracking-wide text-shadow-glitch"
              initial={{ opacity: 0, x: -20, skewX: 20 }}
              animate={{ opacity: 1, x: 0, skewX: 0 }}
              exit={{ opacity: 0, x: 20, filter: 'blur(5px)', transition: { duration: 0.3 } }}
            >
              Lost your life savings<br/><span className="text-[#ff0033]">to a crypto scam?</span>
            </motion.h2>
          )}
          {phase === 2 && (
            <motion.h2 
              key="q2"
              className="text-[5vw] font-bold text-[#F5F5F5] uppercase leading-tight font-display tracking-wide text-shadow-glitch"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(5px)', transition: { duration: 0.3 } }}
            >
              Sent Bitcoin to the<br/><span className="text-[#ff0033]">wrong address?</span>
            </motion.h2>
          )}
          {phase === 3 && (
            <motion.h2 
              key="q3"
              className="text-[5vw] font-bold text-[#F5F5F5] uppercase leading-tight font-display tracking-wide text-shadow-glitch"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: [0, 1, 0.5, 1], y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
            >
              Forgot your<br/><span className="text-[#ff0033]">seed phrase?</span>
            </motion.h2>
          )}
        </AnimatePresence>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .text-shadow-glitch {
          text-shadow: 2px 0 #ff0033, -2px 0 #00ffff;
        }
      `}} />
    </motion.div>
  );
}

