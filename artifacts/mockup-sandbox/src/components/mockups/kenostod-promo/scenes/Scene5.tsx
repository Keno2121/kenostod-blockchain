import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i * 4.5) % 100,
  delay: (i * 0.4) % 5,
  duration: 5 + (i % 4),
  size: 0.5 + (i % 3) * 0.3,
}));

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 3500),
      setTimeout(() => setPhase(3), 6500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden z-50"
      style={{ background: '#0a0a0a' }}
      initial={{ opacity: 0, y: '8%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 1 }}
    >
      {/* Warm gold top glow */}
      <motion.div
        className="absolute top-0 w-full pointer-events-none"
        style={{ height: '55vh', background: 'linear-gradient(to bottom, rgba(201,168,76,0.18), transparent)', filter: 'blur(30px)' }}
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* Rising gold particles */}
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${p.size}vw`,
            height: `${p.size}vw`,
            background: '#C9A84C',
            filter: 'blur(2px)',
            left: `${p.x}vw`,
          }}
          initial={{ y: '105vh', opacity: 0.3 }}
          animate={{ y: '-5vh', opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'linear' }}
        />
      ))}

      {/* Text stack */}
      <div className="relative z-10 flex flex-col items-center" style={{ gap: '8vh' }}>
        <motion.h2
          className="font-display uppercase text-[#F5F5F5] tracking-widest"
          style={{ fontSize: '6vw' }}
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          Break the cycle.
        </motion.h2>

        <motion.h2
          className="font-display uppercase text-[#C9A84C] tracking-widest"
          style={{ fontSize: '6vw', filter: phase >= 2 ? 'drop-shadow(0 0 20px rgba(201,168,76,0.5))' : 'none' }}
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          Build generational wealth.
        </motion.h2>

        <motion.div
          className="font-display uppercase text-black tracking-wider"
          style={{
            fontSize: '4vw',
            background: '#00C896',
            padding: '1.2vw 4vw',
            borderRadius: '0.3vw',
          }}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.75 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          Start FREE.
        </motion.div>
      </div>
    </motion.div>
  );
}
