import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center flex-col z-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="overflow-hidden mb-4">
        <motion.h1 className="text-[5vw] font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500"
          initial={{ y: "100%" }}
          animate={{ y: phase >= 1 ? 0 : "100%" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          FAL - Flash Arbitrage Loans
        </motion.h1>
      </div>
      <motion.div className="h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: phase >= 1 ? "50vw" : 0, opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />
    </motion.div>
  );
}
