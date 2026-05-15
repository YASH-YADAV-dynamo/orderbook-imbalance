'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, BarChart3 } from 'lucide-react';
import styles from './NavTabs.module.css';

const TABS = [
  { name: 'Orderbook Imbalance', path: '/', icon: Activity },
  { name: 'Funding Arbitrage', path: '/arbitrage', icon: Zap },
  { name: 'Volume', path: '/volume', icon: BarChart3 },
];

export function NavTabs() {
  const pathname = usePathname();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  return (
    <div 
      className={styles.tabsContainer}
      onMouseLeave={() => setHoveredPath(null)}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.path;
        const isHovered = hoveredPath === tab.path;
        const Icon = tab.icon;
        
        return (
          <Link 
            key={tab.path} 
            href={tab.path}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onMouseEnter={() => setHoveredPath(tab.path)}
          >
            {/* 
                Shared Layout ID for the Background Pill.
                This allows the "container" to smoothly move between tabs.
            */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className={styles.activeIndicator}
                  transition={{ 
                    type: 'spring', 
                    bounce: 0.2, 
                    duration: 0.6 
                  }}
                />
              )}
            </AnimatePresence>

            {/* 
                A separate "hover" pill that slides as you move your mouse.
            */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  layoutId="hover-pill"
                  className={styles.hoverIndicator}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    type: 'spring', 
                    bounce: 0.15, 
                    duration: 0.4 
                  }}
                />
              )}
            </AnimatePresence>

            <motion.span 
              className={styles.tabContent}
              animate={{ 
                color: isActive || isHovered ? 'var(--fg)' : 'var(--fg-muted)',
                scale: isHovered ? 1.02 : 1
              }}
            >
              <Icon className={styles.icon} />
              <span>{tab.name}</span>
            </motion.span>
          </Link>
        );
      })}
    </div>
  );
}
