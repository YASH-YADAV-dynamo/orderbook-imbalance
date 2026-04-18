'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { GlassButton } from '@/components/ui/glass-button';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import styles from './page.module.css';

const FundingScreener = dynamic(() => import('@/components/FundingScreener'), { ssr: false });

export default function ArbitragePage() {
  const darkMode = useAppStore(s => s.darkMode);
  const toggleDarkMode = useAppStore(s => s.toggleDarkMode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navDot} />
          <span className={styles.navTitle}>Funding rate arbitrage</span>
        </div>
        <div className={styles.navActions}>
          <GlassButton asChild size="sm" contentClassName="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 no-underline text-inherit">
              <ArrowLeft className="h-3 w-3" />
              <span>Orderbook imbalance</span>
            </Link>
          </GlassButton>
          
          <GlassButton 
            size="sm" 
            onClick={toggleDarkMode}
            contentClassName="flex items-center gap-2"
          >
            {darkMode ? (
              <>
                <Sun className="h-3 w-3" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3 w-3" />
                <span>Dark</span>
              </>
            )}
          </GlassButton>
        </div>
      </nav>

      <main className={styles.main}>
        <FundingScreener darkMode={darkMode} />
      </main>
    </div>
  );
}
