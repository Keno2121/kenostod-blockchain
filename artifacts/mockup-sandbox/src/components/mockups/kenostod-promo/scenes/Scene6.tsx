import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-[60]"
      style={{ background: '#0a0a0a' }}
      initial={{ opacity: 0, filter: 'brightness(2.5)' }}
      animate={{ opacity: 1, filter: 'brightness(1)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      {/* Deep emerald radial */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,200,150,0.1) 0%, transparent 65%)' }}
      />

      {/* Shield */}
      <motion.div
        className="relative"
        style={{ width: '26vw', height: '26vw', marginBottom: '5vh' }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      >
        <img
          src={`${import.meta.env.BASE_URL}shield-logo-ai.png`}
          alt="Kenostod Shield"
          style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
        />
        {/* Breathing glow */}
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: '#00C896', filter: 'blur(55px)', opacity: 0.35 }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* URL + CTA */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2
          className="font-display uppercase text-white tracking-[0.18em]"
          style={{ fontSize: '3.8vw', marginBottom: '1.5vh' }}
        >
          KENOSTODBLOCKCHAIN.COM
        </h2>
        <p
          className="font-display uppercase text-[#C9A84C] tracking-wider"
          style={{ fontSize: '2vw', marginBottom: '4vh' }}
        >
          Start Your Free Lesson Today
        </p>

        {/* 6174 — Kaprekar constant signature, appears last */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: 0.6, duration: 1, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5vh' }}
        >
          {/* Divider line */}
          <motion.div
            style={{ width: '6vw', height: '1px', background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.5), transparent)' }}
            initial={{ scaleX: 0 }}
            animate={phase >= 2 ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          />
          <motion.span
            className="font-display text-[#C9A84C]"
            style={{
              fontSize: '3.5vw',
              letterSpacing: '0.25em',
              filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.6))',
            }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            6174
          </motion.span>
          <span
            style={{
              fontSize: '0.9vw',
              color: 'rgba(201,168,76,0.45)',
              letterSpacing: '0.3em',
              fontFamily: 'Inter, sans-serif',
              textTransform: 'uppercase',
            }}
          >
            The Kaprekar Constant
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
