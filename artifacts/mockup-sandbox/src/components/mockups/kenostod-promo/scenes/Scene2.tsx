import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const SHARDS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: (((i * 37 + 13) % 100) - 50),
  y: (((i * 53 + 7) % 100) - 50),
  r: (i * 47) % 360,
  s: 0.5 + (i % 3) * 0.5,
}));

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      {/* Glass shatter particles */}
      {SHARDS.map((shard) => (
        <motion.div
          key={shard.id}
          className="absolute pointer-events-none"
          style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderBottom: '24px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(4px)',
            left: '50%',
            top: '50%',
          }}
          initial={{ x: 0, y: 0, rotate: 0, scale: 0, opacity: 1 }}
          animate={{
            x: `${shard.x}vw`,
            y: `${shard.y}vh`,
            rotate: shard.r,
            scale: shard.s,
            opacity: 0,
          }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        />
      ))}

      {/* Teal radial glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,200,150,0.12) 0%, transparent 70%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 1.5 }}
      />

      {/* 6174 — appears first, shield descends on top of it like it's the foundation */}
      <motion.div
        className="absolute font-display text-[#C9A84C] pointer-events-none select-none"
        style={{
          fontSize: '22vw',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -52%)',
          letterSpacing: '0.05em',
        }}
        initial={{ opacity: 0, scale: 0.6, filter: 'blur(20px)' }}
        animate={phase >= 1
          ? { opacity: [0, 0.9, 0.9, 0.15], scale: [0.6, 1.05, 1, 1], filter: ['blur(20px)', 'blur(0px)', 'blur(0px)', 'blur(6px)'] }
          : { opacity: 0 }}
        transition={{ duration: 2.5, times: [0, 0.2, 0.6, 1], ease: 'easeOut' }}
      >
        6174
      </motion.div>

      {/* Shield logo */}
      <motion.div
        className="relative z-10 mb-[4vh]"
        style={{ width: '22vw', height: '22vw' }}
        initial={{ scale: 0, rotate: -25, filter: 'brightness(3) blur(10px)' }}
        animate={phase >= 1 ? { scale: 1, rotate: 0, filter: 'brightness(1) blur(0px)' } : {}}
        transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }}
      >
        <img
          src={`${import.meta.env.BASE_URL}keno_gold_token_emerald_shield.png`}
          alt="Kenostod Shield"
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 40px rgba(0,200,150,0.6))' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,200,150,0.3) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Text */}
      <div className="text-center overflow-hidden" style={{ height: '18vh' }}>
        <motion.h1
          className="font-display text-white tracking-widest leading-none"
          style={{ fontSize: '7vw' }}
          initial={{ y: '110%', opacity: 0 }}
          animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: '110%', opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          KENOSTOD
        </motion.h1>

        <motion.p
          className="font-display uppercase tracking-[0.3em] text-[#00C896]"
          style={{ fontSize: '2vw', marginTop: '1.5vh' }}
          initial={{ opacity: 0, filter: 'blur(12px)' }}
          animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(12px)' }}
          transition={{ duration: 1 }}
        >
          A Shield Against Poverty
        </motion.p>
      </div>
    </motion.div>
  );
}
