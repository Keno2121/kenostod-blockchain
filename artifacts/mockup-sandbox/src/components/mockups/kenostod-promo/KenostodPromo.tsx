import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './scenes/Scene1';
import { Scene2 } from './scenes/Scene2';
import { Scene3 } from './scenes/Scene3';
import { Scene4 } from './scenes/Scene4';
import { Scene5 } from './scenes/Scene5';
import { Scene6 } from './scenes/Scene6';

const SCENE_DURATIONS = {
  scene1: 8000,
  scene2: 7000,
  scene3: 15000,
  scene4: 15000,
  scene5: 10000,
  scene6: 5000,
};

export default function KenostodPromo() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0a]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap');
        .font-display { font-family: 'Anton', sans-serif; }
        .text-shadow-glitch { text-shadow: 2px 0 #ff0033, -2px 0 #00ffff; }
      `}</style>

      {/* Persistent ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-20 mix-blend-screen"
          animate={{
            backgroundColor: [
              '#ff0033',
              '#00C896',
              '#1a1a1a',
              '#C9A84C',
              '#C9A84C',
              '#00C896',
            ][currentScene] ?? '#00C896',
            scale: [1, 1.2, 0.9, 1.5, 1, 1][currentScene] ?? 1,
          }}
          transition={{ duration: 3, ease: 'easeInOut' }}
          style={{ left: '-20%', top: '-10%' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-10 mix-blend-screen"
          animate={{
            backgroundColor: currentScene === 0 ? '#ff0033' : '#00C896',
            scale: currentScene === 5 ? 1.5 : 1,
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
          style={{ right: 0, bottom: 0 }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
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
