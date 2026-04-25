'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Preloader.module.css';
import { PremiumLoader } from './PremiumLoader';

export function Preloader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Handle tab switches
  useEffect(() => {
    if (!loading) {
      setIsNavigating(true);
      const timer = setTimeout(() => setIsNavigating(false), 800);
      return () => clearTimeout(timer);
    }
  }, [pathname, loading]);

  const showLoader = loading || isNavigating;

  return (
    <AnimatePresence>
      {showLoader && (
        <motion.div 
          className={styles.overlay}
          initial={{ opacity: 1, y: 0 }}
          exit={{ 
            opacity: 0, 
            y: -20,
            transition: { duration: 0.5, ease: [0.85, 0, 0.15, 1] } 
          }}
          style={{ zIndex: 99999 }}
        >
          <div className={styles.content}>
            <PremiumLoader />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
