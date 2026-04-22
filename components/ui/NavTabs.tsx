'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Activity, Droplets } from 'lucide-react';
import styles from './NavTabs.module.css';

const TABS = [
  { name: 'Orderbook Imbalance', path: '/', icon: Activity },
  { name: 'Funding Arbitrage', path: '/arbitrage', icon: Zap },
  { name: 'Liquidations', path: '/liquidations', icon: Droplets },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <div className={styles.tabsContainer}>
      {TABS.map((tab) => {
        const isActive = pathname === tab.path;
        const Icon = tab.icon;
        
        return (
          <Link 
            key={tab.path} 
            href={tab.path}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
          >
            <Icon className={styles.icon} />
            <span>{tab.name}</span>
            {isActive && <span className={styles.activeIndicator} />}
          </Link>
        );
      })}
    </div>
  );
}
