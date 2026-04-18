'use client';

import React, { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface GlassStickyCardProps {
  children: React.ReactNode;
  className?: string;
  isSticky?: boolean;
  stickyTop?: string;
  blurIntensity?: 'sm' | 'md' | 'lg' | 'xl';
  borderRadius?: string;
  style?: React.CSSProperties;
  animate?: any;
  transition?: any;
}

/**
 * GlassStickyCard
 * 
 * A lightweight reusable component that provides a premium "Liquid Glass" effect.
 * 
 * Features:
 * - Backdrop blur with liquid distortion via SVG filter
 * - Inner edge highlights and outer glow for a premium glass look
 * - Optional sticky positioning
 * - Subtle hover and tap micro-animations
 */
export const GlassStickyCard = ({
  children,
  className = '',
  isSticky = false,
  stickyTop = '0px',
  blurIntensity = 'xl',
  borderRadius = '12px',
  style,
  animate,
  transition,
}: GlassStickyCardProps) => {
  const filterId = useId();
  
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl',
  };

  return (
    <motion.div
      className={cn(
        isSticky ? 'sticky z-40' : 'relative',
        'w-full group',
        className
      )}
      style={{
        ...(isSticky && { top: stickyTop }),
        borderRadius,
        ...style
      }}
      animate={animate}
      transition={transition}
      whileHover={{ scale: 1.002 }}
      whileTap={{ scale: 0.998 }}
    >
      {/* Unique SVG Filter per instance to avoid ID collisions */}
      <svg className="hidden pointer-events-none absolute h-0 w-0 overflow-hidden">
        <defs>
          <filter
            id={filterId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="objectBoundingBox"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.003 0.007"
              numOctaves="1"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="200"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Glass Layers Container */}
      <div className="relative overflow-hidden h-full w-full" style={{ borderRadius }}>
        {/* Bend Layer (Backdrop blur with distortion) */}
        <div
          className={cn('absolute inset-0 z-0', blurClasses[blurIntensity])}
          style={{
            borderRadius,
            filter: `url(#${filterId})`,
          }}
        />

        {/* Face Layer (Main shadow and glow) */}
        <div
          className="absolute inset-0 z-10 transition-opacity duration-300 group-hover:opacity-100 opacity-90"
          style={{
            borderRadius,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 12px rgba(255, 255, 255, 0.05)',
          }}
        />

        {/* Edge Layer (Inner highlights) */}
        <div
          className="absolute inset-0 z-20"
          style={{
            borderRadius,
            boxShadow: 'inset 1px 1px 2px 0 rgba(255, 255, 255, 0.25), inset -1px -1px 2px 0 rgba(255, 255, 255, 0.1)',
          }}
        />

        {/* Content */}
        <div className="relative z-30 h-full w-full">{children}</div>
      </div>
    </motion.div>
  );
};
