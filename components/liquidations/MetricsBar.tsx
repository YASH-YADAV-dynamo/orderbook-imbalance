import React from 'react';
import styles from './MetricsBar.module.css';
import { LiquidationsFeedMetrics } from '@/hooks/useLiquidationsFeed';

interface MetricsBarProps {
  metrics: LiquidationsFeedMetrics | null;
  isLoading: boolean;
}

export function MetricsBar({ metrics, isLoading }: MetricsBarProps) {
  const formatCurrency = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  const formatPercentage = (val: number) => {
    return `${(val * 100).toFixed(1)}%`;
  };

  if (isLoading || !metrics) {
    return (
      <div className={styles.container}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.label}>24H LIQUIDATIONS</div>
        <div className={styles.value}>{formatCurrency(metrics.totalVolume)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>LONG REKT</div>
        <div className={`${styles.value} ${styles.red}`}>{formatCurrency(metrics.totalLongUsd)}</div>
        <div className={styles.subtext}>{formatPercentage(metrics.longRatio)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>SHORT REKT</div>
        <div className={`${styles.value} ${styles.green}`}>{formatCurrency(metrics.totalShortUsd)}</div>
        <div className={styles.subtext}>{formatPercentage(metrics.shortRatio)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>MAX LIQUIDATION</div>
        <div className={styles.value}>{formatCurrency(metrics.maxLiqUsd)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>BACKSTOPS</div>
        <div className={styles.value}>{formatCurrency(metrics.backstopUsd)}</div>
      </div>
    </div>
  );
}
