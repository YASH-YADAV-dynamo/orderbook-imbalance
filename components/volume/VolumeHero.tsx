import React from 'react';
import styles from './VolumeHero.module.css';
import { VolumeStats } from '@/lib/volume/types';

interface VolumeHeroProps {
  stats: VolumeStats;
  isLoading: boolean;
}

export const VolumeHero: React.FC<VolumeHeroProps> = ({ stats, isLoading }) => {
  const formatUSD = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const metrics = [
    {
      label: 'DOMINANT EXCHANGE (stats.dominantExchange)',
      value: stats.dominantExchange,
      subValue: `stats.marketShare[${stats.dominantExchange}] = ${(stats.marketShare[stats.dominantExchange] || 0).toFixed(1)}%`,
      subColor: 'var(--accent)'
    },
    {
      label: 'LARGEST TRADE (stats.largestSpike.amount)',
      value: formatUSD(stats.largestSpike.amount),
      subValue: `stats.largestSpike.exchange = ${stats.largestSpike.exchange}`,
      subColor: 'var(--fg-muted)'
    },
  ];

  return (
    <div className={styles.hero}>
      {metrics.map((m, i) => (
        <div key={i} className={styles.card}>
          <span className={styles.label}>{m.label}</span>
          <div className={styles.valueGroup}>
            <span className={`${styles.value} ${isLoading ? styles.skeleton : ''}`}>
              {isLoading ? '---' : m.value}
            </span>
            <span 
              className={styles.subValue} 
              style={{ color: m.subColor }}
            >
              {isLoading ? '' : m.subValue}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
