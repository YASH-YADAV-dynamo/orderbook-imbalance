'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { NavTabs } from '@/components/ui/NavTabs';
import { ThemeSwitcher } from '@/components/ui/apple-liquid-glass-switcher';
import styles from './page.module.css';

const FundingScreener = dynamic(() => import('@/components/FundingScreener'), { ssr: false });

export default function ArbitragePage() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navDot} />
          <span className={styles.navTitle}>Funding rate arbitrage</span>
        </div>
        <div className={styles.navActions}>
          <NavTabs />
          
          <ThemeSwitcher 
            value={theme}
            onValueChange={(val) => setTheme(val)}
          />
        </div>
      </nav>

      <main className={styles.main}>
        <FundingScreener darkMode={theme === 'dark' || theme === 'dim'} />
      </main>
    </div>
  );
}
