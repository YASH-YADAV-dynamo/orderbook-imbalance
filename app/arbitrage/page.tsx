'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { GlassButton } from '@/components/ui/glass-button';
import { ThemeSwitcher } from '@/components/ui/apple-liquid-glass-switcher';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
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
          <GlassButton asChild size="sm" className="w-[220px] h-[48px] !p-0">
            <Link href="/" className="flex items-center justify-center gap-2 no-underline text-inherit w-full h-full whitespace-nowrap">
              <ArrowLeft className="h-3 w-3" />
              <span>Orderbook imbalance</span>
            </Link>
          </GlassButton>
          
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
