'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PremiumLoaderProps {
  text?: string;
  className?: string;
  compact?: boolean;
}

export function PremiumLoader({ text = "SKEWX", className = "", compact = false }: PremiumLoaderProps) {
  // Scaling factors for the 3x larger version (approx)
  // Non-compact: w-4 (16px) -> w-12 (48px)
  // Text: text-3xl (30px) -> text-8xl (96px)
  
  const dotSize = compact ? 'w-2 h-2' : 'w-6 h-6';
  const bounceHeight = compact ? -6 : -24;
  const gapSize = compact ? 'gap-2' : 'gap-3';
  const mainGap = compact ? 'gap-3' : 'gap-10';
  const textSize = compact ? 'text-sm' : 'text-4xl';
  const separatorSize = compact ? 'text-xs' : 'text-4xl';
  
  return (
    <div className={`flex items-center justify-center ${mainGap} ${className}`}>
      {!compact && (
        <div className="flex items-center gap-10">
          <span className={`${textSize} font-black tracking-[0.25em] text-white uppercase opacity-95`}>
            {text}
          </span>
          <span className={`${separatorSize} font-thin text-white/10`}>|</span>
        </div>
      )}
      <div className={`flex ${gapSize} items-center`}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`${dotSize} rounded-full`}
            style={{
              background: 'radial-gradient(circle at 35% 35%, #999, #222)',
              boxShadow: compact 
                ? 'inset -1px -1px 2px rgba(0,0,0,0.8), inset 1px 1px 2px rgba(255,255,255,0.1), 0 1px 3px rgba(0,0,0,0.5)'
                : 'inset -4px -4px 10px rgba(0,0,0,0.9), inset 4px 4px 10px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.7)'
            }}
            animate={{
              y: [0, bounceHeight, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: [0.45, 0.05, 0.55, 0.95] // Smooth sine-like movement
            }}
          />
        ))}
      </div>
    </div>
  );
}
