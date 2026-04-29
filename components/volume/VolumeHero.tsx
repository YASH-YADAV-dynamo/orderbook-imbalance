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
      label: 'AGGREGATED 24H VOLUME',
      value: formatUSD(stats.total24h),
      subValue: `${stats.change24h > 0 ? '+' : ''}${stats.change24h.toFixed(2)}%`,
      subColor: stats.change24h >= 0 ? 'var(--bid)' : 'var(--ask)'
    },
    {
      label: 'DOMINANT EXCHANGE',
      value: stats.dominantExchange,
      subValue: `${stats.marketShare[stats.dominantExchange]?.toFixed(1)}% SHARE`,
      subColor: 'var(--accent)'
    },
    {
      label: 'LARGEST TRADE SPIKE',
      value: formatUSD(stats.largestSpike.amount),
      subValue: `ON ${stats.largestSpike.exchange}`,
      subColor: 'var(--fg-muted)'
    },
    {
      label: 'CONCENTRATION SCORE',
      value: stats.concentrationScore.toFixed(1),
      subValue: 'HERFINDAHL INDEX',
      subColor: 'var(--fg-muted)'
    }
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
