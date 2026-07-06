import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';

const SCENE_DURATIONS = {
  intro: 2500,
  arbitrage: 3500,
  payoff: 2000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#040B16]">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0A1930] via-[#040B16] to-[#040B16]"></div>
        
        {/* Dynamic Glows */}
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-20 mix-blend-screen"
          animate={{
            x: ['-20%', '30%', '10%'][currentScene] || '10%',
            y: ['-10%', '20%', '-20%'][currentScene] || '-20%',
            scale: [1, 1.2, 0.9][currentScene] || 1,
            backgroundColor: ['#1E3A8A', '#FFD700', '#00C896'][currentScene] || '#1E3A8A',
          }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute right-0 bottom-0 w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-15 mix-blend-screen"
          animate={{
            x: ['10%', '-20%', '0%'][currentScene] || '0%',
            y: ['10%', '-10%', '20%'][currentScene] || '20%',
            backgroundColor: ['#FFD700', '#00C896', '#FFD700'][currentScene] || '#FFD700',
            scale: [1.2, 0.8, 1.5][currentScene] || 1.5,
          }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 40L40 40 40 0' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")` }}></div>
      </div>

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="intro" />}
        {currentScene === 1 && <Scene2 key="arbitrage" />}
        {currentScene === 2 && <Scene3 key="payoff" />}
      </AnimatePresence>
    </div>
  );
}
