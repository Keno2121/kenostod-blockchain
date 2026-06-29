import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),  // Shield enters
      setTimeout(() => setPhase(2), 2000), // KENOSTOD text
      setTimeout(() => setPhase(3), 3500), // Subtitle
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  // Generate glass shards
  const shards = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
    r: (Math.random() - 0.5) * 360,
    s: 0.5 + Math.random() * 1.5,
  }));

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      {/* Glass shatter effect */}
      {shards.map((shard) => (
        <motion.div
          key={shard.id}
          className="absolute w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[40px] border-b-white/20 backdrop-blur-sm"
          initial={{ x: 0, y: 0, rotate: 0, scale: 0 }}
          animate={{
            x: `${shard.x}vw`,
            y: `${shard.y}vh`,
            rotate: shard.r,
            scale: shard.s,
            opacity: [1, 0],
          }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
      ))}

      {/* Emerald Shield Logo */}
      <motion.div
        className="relative z-10 w-[20vw] h-[20vw] mb-8"
        initial={{ scale: 0, rotate: -30, filter: 'brightness(2)' }}
        animate={{ scale: 1, rotate: 0, filter: 'brightness(1)' }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}assets/course-images/keno_gold_token_emerald_shield.png`} 
          alt="Kenostod Shield"
          className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(0,200,150,0.5)]"
        />
      </motion.div>

      {/* Texts */}
      <div className="text-center overflow-hidden h-[15vh]">
        <motion.h1
          className="text-[6vw] font-display text-white tracking-widest leading-none drop-shadow-lg"
          initial={{ y: '100%', opacity: 0 }}
          animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: '100%', opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          KENOSTOD
        </motion.h1>
        
        <motion.p
          className="text-[2vw] text-[#00C896] uppercase tracking-widest font-semibold mt-4"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 1 }}
        >
          A Shield Against Poverty
        </motion.p>
      </div>
    </motion.div>
  );
}