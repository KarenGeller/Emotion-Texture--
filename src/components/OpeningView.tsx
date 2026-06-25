/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EMOTIONS } from '../data/emotions';
import { Emotion } from '../types';
import { Sparkles, Music, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface OpeningViewProps {
  onSelectEmotion: (emotion: Emotion) => void;
}

export const OpeningView: React.FC<OpeningViewProps> = ({ onSelectEmotion }) => {
  // Check if screen is mobile (width < 768px)
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative px-6 py-12 overflow-hidden bg-radial from-[#0a0a14] via-[#05050a] to-[#010103]">
      {/* Dynamic Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f1d_1px,transparent_1px),linear-gradient(to_bottom,#0f0f1d_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />

      {/* Hero Header */}
      <div className="text-center z-10 max-w-3xl mb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel border-white/5 text-xs text-blue-400 font-mono tracking-wider uppercase mb-6"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>Google AI Studio • 交互音乐空间</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl md:text-7xl font-bold font-display tracking-tight text-white mb-6 drop-shadow-sm"
        >
          情绪织体
          <span className="block mt-2 text-2xl md:text-3xl font-light font-sans tracking-widest text-slate-400">
            EMOTION TEXTURE
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.2, ease: 'easeOut' }}
          className="text-base md:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed"
        >
          融合 MediaPipe 摄像头手势识别与 Tone.js 音频合成引擎。
          通过手掌的移动、张开与旋转，实时操纵旋律、节奏、音色与空间，生成一座随音乐生长的 3D 建筑织体。
        </motion.p>
      </div>

      {/* Emotion Grid */}
      <motion.div
        id="selector"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className={isMobile ? "mobile-selector max-w-5xl w-full z-10" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full z-10"}
      >
        {EMOTIONS.map((emotion, idx) => {
          // Adjust text contrast for lighter themes (like Sakura Pink)
          const isLight = emotion.id === 'sakura-pink';
          const textColorClass = isLight ? 'text-neutral-900' : 'text-white';
          const descColorClass = isLight ? 'text-neutral-800 font-medium' : 'text-slate-300';
          const tagBgClass = isLight ? 'bg-neutral-900/10 text-neutral-800 border-neutral-900/20' : 'bg-white/10 text-slate-200 border-white/5';

          return (
            <motion.button
              key={emotion.id}
              onClick={() => onSelectEmotion(emotion)}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
              className="group relative flex flex-col justify-between items-start text-left p-6 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-shadow duration-300 h-52 glow-border"
              style={{
                background: `linear-gradient(135deg, ${emotion.colors[0]}, ${emotion.colors[1]})`,
              }}
            >
              {/* Overlay for subtle texture */}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
              
              {/* Glowing highlight point */}
              <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-150 transition-transform duration-500" />

              <div className="w-full">
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded border ${tagBgClass}`}>
                    {emotion.englishName}
                  </span>
                  {emotion.bgSoundType === 'heart' ? (
                    <Activity className={`w-4 h-4 ${textColorClass} opacity-75 animate-pulse`} />
                  ) : (
                    <Music className={`w-4 h-4 ${textColorClass} opacity-75`} />
                  )}
                </div>
                <h3 className={`text-2xl font-bold font-display ${textColorClass}`}>
                  {emotion.name}
                </h3>
              </div>

              <div className="w-full mt-auto">
                <p className={`text-sm leading-relaxed line-clamp-2 ${descColorClass}`}>
                  {emotion.description}
                </p>
                <div className="flex items-center gap-2 mt-3 overflow-hidden text-[10px] font-mono opacity-80">
                  <span className={isLight ? 'text-neutral-800' : 'text-white'}>
                    Base BPM: {emotion.baseBPM}
                  </span>
                  <span className={isLight ? 'text-neutral-500' : 'text-slate-400'}>•</span>
                  <span className={isLight ? 'text-neutral-800' : 'text-white'}>
                    Style: {emotion.architectureStyle.toUpperCase()}
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Footer Details */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.0 }}
        className="mt-16 text-center text-xs text-slate-500 font-mono tracking-wide z-10"
      >
        <p>「情绪织体」 3D 声音艺术装置 © 2026</p>
        <p className="mt-1 text-slate-600">选择任意情绪即可启动情绪织体引擎</p>
      </motion.div>
    </div>
  );
};
