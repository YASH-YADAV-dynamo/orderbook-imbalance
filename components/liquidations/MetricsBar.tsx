import React from 'react';
import styles from './MetricsBar.module.css';
import { LiquidationsFeedMetrics } from '@/store/useLiquidationsStore';

interface MetricsBarProps {
  metrics: LiquidationsFeedMetrics;
  isLoading: boolean;
}

export function MetricsBar({ metrics, isLoading }: MetricsBarProps) {
  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  const formatPercentage = (val: number) => {
    return `${(val * 100).toFixed(1)}%`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.label}>TOTAL VOLUME (LIVE)</div>
        {isLoading ? (
          <div className="skeleton" style={{ height: '24px', width: '100px', marginTop: '4px' }} />
        ) : (
          <div className={styles.value}>{formatCurrency(metrics.totalVolume)}</div>
        )}
      </div>
      <div className={styles.card}>
        <div className={styles.label}>WHALE ALERTS (&gt;$500K)</div>
        {isLoading ? (
          <div className="skeleton" style={{ height: '24px', width: '60px', marginTop: '4px' }} />
        ) : (
          <div className={styles.value}>{metrics.whaleCount || 0}</div>
        )}
      </div>
      <div className={styles.card}>
        <div className={styles.label}>LARGEST SINGLE</div>
        {isLoading ? (
          <div className="skeleton" style={{ height: '24px', width: '80px', marginTop: '4px' }} />
        ) : (
          <div className={styles.value}>{formatCurrency(metrics.largestSingle || 0)}</div>
        )}
      </div>
      <div className={styles.card}>
        <div className={styles.label}>TOP ASSET</div>
        {isLoading ? (
          <div className="skeleton" style={{ height: '24px', width: '70px', marginTop: '4px' }} />
        ) : (
          <div className={styles.value} style={{ fontSize: '14px', letterSpacing: '0' }}>{metrics.topAsset || '---'}</div>
        )}
      </div>
      
      <div className={styles.sentimentSection}>
        <div className={styles.sentimentLabels}>
          <span className={styles.longLabel}>
            {isLoading ? '---' : `Longs: ${formatCurrency(metrics.totalLongUsd)} (${formatPercentage(metrics.longRatio)})`}
          </span>
          <span className={styles.shortLabel}>
            {isLoading ? '---' : `Shorts: ${formatCurrency(metrics.totalShortUsd)} (${formatPercentage(metrics.shortRatio)})`}
          </span>
        </div>
        <div className={styles.sentimentBar}>
          {isLoading ? (
             <div className="skeleton" style={{ width: '100%', height: '100%' }} />
          ) : (
            <>
              <div 
                className={styles.longFill} 
                style={{ width: `${metrics.longRatio * 100}%` }} 
              />
              <div 
                className={styles.shortFill} 
                style={{ width: `${metrics.shortRatio * 100}%` }} 
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
