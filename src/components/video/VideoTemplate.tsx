import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

const SCENE_DURATIONS = {
  scene1: 8000, // The Problem
  scene2: 7000, // The Arrival
  scene3: 15000, // The Difference
  scene4: 15000, // The Power
  scene5: 10000, // The Future
  scene6: 5000, // The Call to Action
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Deep ambient glow */}
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-20 mix-blend-screen"
          animate={{
            x: ['-20%', '10%', '-10%', '0%'][currentScene % 4] || '0%',
            y: ['-10%', '-20%', '10%', '0%'][currentScene % 4] || '0%',
            scale: [1, 1.2, 0.9, 1.5, 1, 1][currentScene] || 1,
            backgroundColor: [
              '#ff0033', // Red glitchy for scene 1
              '#00C896', // Emerald for scene 2
              '#1a1a1a', // Dark for scene 3
              '#C9A84C', // Gold for scene 4
              '#C9A84C', // Gold/warm for scene 5
              '#00C896', // Emerald for scene 6
            ][currentScene] || '#00C896',
          }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-10 mix-blend-screen right-0 bottom-0"
          animate={{
            backgroundColor: currentScene === 0 ? '#ff0033' : '#00C896',
            scale: currentScene === 5 ? 1.5 : 1,
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
        />
        
        {/* Subtle noise overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
      </div>

      <AnimatePresence mode="sync">
        {currentScene === 0 && <Scene1 key="scene1" />}
        {currentScene === 1 && <Scene2 key="scene2" />}
        {currentScene === 2 && <Scene3 key="scene3" />}
        {currentScene === 3 && <Scene4 key="scene4" />}
        {currentScene === 4 && <Scene5 key="scene5" />}
        {currentScene === 5 && <Scene6 key="scene6" />}
      </AnimatePresence>
    </div>
  );
}
