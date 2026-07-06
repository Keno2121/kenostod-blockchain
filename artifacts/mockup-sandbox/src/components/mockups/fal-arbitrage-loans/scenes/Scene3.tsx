import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center flex-col z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col items-center gap-[4vh]">
        <motion.div className="bg-slate-900 border border-amber-500/30 px-12 py-6 rounded-3xl shadow-[0_0_40px_rgba(251,191,36,0.15)] text-center"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: phase >= 1 ? 0 : 50, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <div className="text-[4vw] font-black text-white tracking-tight uppercase">
            Zero Fees
          </div>
        </motion.div>
        
        <motion.div className="bg-slate-900 border border-amber-500/30 px-12 py-6 rounded-3xl shadow-[0_0_40px_rgba(251,191,36,0.15)] text-center"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: phase >= 2 ? 0 : 50, opacity: phase >= 2 ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <div className="text-[4vw] font-black text-amber-400 tracking-tight uppercase">
            Instant Execution
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
