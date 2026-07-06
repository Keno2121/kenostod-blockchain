import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200), // Ex A & B appear
      setTimeout(() => setPhase(2), 800), // Price Difference text appears
      setTimeout(() => setPhase(3), 1200), // Flow of coins starts
      setTimeout(() => setPhase(4), 2800), // Outro
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center flex-col z-10 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="absolute top-[20%] text-[3vw] font-semibold text-amber-400 tracking-wide uppercase"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : -20 }}
        transition={{ duration: 0.4 }}
      >
        Price Difference
      </motion.div>

      <div className="flex w-[70vw] justify-between items-center relative mt-10">
        
        {/* Exchange A */}
        <motion.div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center w-[25vw]"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: phase >= 1 ? 0 : -100, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="text-[1.5vw] text-slate-400 mb-2 uppercase tracking-widest font-bold">Exchange A</div>
          <div className="text-[4vw] font-bold text-white">$8.30</div>
        </motion.div>

        {/* Exchange B */}
        <motion.div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center w-[25vw]"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: phase >= 1 ? 0 : 100, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="text-[1.5vw] text-slate-400 mb-2 uppercase tracking-widest font-bold">Exchange B</div>
          <div className="text-[4vw] font-bold text-emerald-400">$8.79</div>
        </motion.div>

        {/* Flowing coins / arrow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {phase >= 3 && (
            <motion.div className="w-[15vw] h-1 bg-gradient-to-r from-amber-400/0 via-amber-400 to-amber-400/0 relative overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div className="absolute inset-0 bg-white w-1/3"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
