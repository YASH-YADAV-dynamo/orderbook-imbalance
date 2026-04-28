'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useVolumeFeed } from '@/hooks/useVolumeFeed';
import { VolumeHero } from '@/components/volume/VolumeHero';
import { VolumeChart } from '@/components/volume/VolumeChart';
import { LiveVolumeFeed } from '@/components/volume/LiveVolumeFeed';
import { VolumeHeatmap } from '@/components/volume/VolumeHeatmap';
import Header from '@/components/Header';
import styles from './page.module.css';

export default function VolumePage() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const { 
    trades, 
    stats, 
    buckets, 
    isLive, 
    isLoading, 
    exchangeStatuses, 
    lastUpdate,
    toggleLive,
    exchangeVolumeMap,
    assetVolumeMap,
    exchangeSymbolVolumeMap
  } = useVolumeFeed();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const formattedUpdate = useMemo(() => {
    if (!lastUpdate) return '--:--:-- UTC';
    const d = new Date(lastUpdate);
    return d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
  }, [lastUpdate]);

  const connectedCount = Object.values(exchangeStatuses).filter(s => s === 'connected').length;
  const totalExchanges = Object.keys(exchangeStatuses).length;

  return (
    <div className={styles.page}>
      <Header
        symbol="ALL"
        aggLevel={1}
        connected={isLive}
        connecting={isLoading}
        error={null}
        darkMode={theme === 'dark'}
        theme={theme}
        onSymbolChange={() => {}}
        onAggChange={() => {}}
        onReconnect={() => window.location.reload()}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onSetTheme={setTheme}
        brandName=""
        brandMetric="GLOBAL VOLUME"
        showAgg={false}
        backHref="/"
      />

      <main className={styles.main}>
        {/* Header Strip */}
        <div className={styles.headerStrip}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Institutional Volume Analytics</h1>
            <p className={styles.pageSubtitle}>Aggregated real-time volume across top-tier venues</p>
          </div>
          
          <div className={styles.liveStatus}>
            <div className={styles.sourceBadges}>
              {Object.entries(exchangeStatuses).map(([key, status]) => (
                <span 
                  key={key} 
                  className={`${styles.sourceBadge} ${
                    status === 'connected' ? styles.badgeConnected : 
                    status === 'connecting' ? styles.badgeConnecting : 
                    status === 'error' ? styles.badgeError : ''
                  }`}
                >
                  {key} {status.toUpperCase()}
                </span>
              ))}
              {isLive && (
                <span className={styles.connectedCount}>
                  {connectedCount}/{totalExchanges || 5} LIVE
                </span>
              )}
            </div>
            
            <span className={styles.timestamp} suppressHydrationWarning>
              {mounted ? formattedUpdate : '--:--:-- UTC'}
            </span>
          </div>
        </div>

        {/* Metrics Overview */}
        <VolumeHero stats={stats} isLoading={isLoading} />

        {/* Primary Dashboard Grid */}
        <div className={styles.dashboardGrid}>
          {/* Main Volume Chart */}
          <div className={`${styles.section} ${styles.chartArea}`}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Aggregated Volume (Stacked)</h3>
              <span className={styles.sectionSubtitle}>1m resolution • 1h lookback</span>
            </div>
            <VolumeChart buckets={buckets} />
          </div>

          {/* Live Feed */}
          <div className={`${styles.section} ${styles.feedArea}`}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Real-Time Trade Stream</h3>
            </div>
            <LiveVolumeFeed trades={trades} />
          </div>
        </div>

        {/* Heatmap Section */}
        <div className={styles.secondaryGrid}>
          <div className={`${styles.section} ${styles.heatmapArea}`}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Exchange-Asset Heatmap</h3>
              <span className={styles.sectionSubtitle}>Volume concentration matrix</span>
            </div>
            <VolumeHeatmap 
              assetVolumeMap={assetVolumeMap}
              exchangeVolumeMap={exchangeVolumeMap}
              exchangeSymbolVolumeMap={exchangeSymbolVolumeMap}
              buckets={buckets}
              isLoading={isLoading}
            />
          </div>

          <div className={`${styles.section} ${styles.breakdownArea}`}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Market Share Breakdown</h3>
            </div>
            <div className={styles.breakdownContent}>
              {Object.entries(stats.marketShare).sort((a,b) => b[1] - a[1]).map(([ex, share]) => (
                <div key={ex} className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>{ex}</span>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${share}%` }}></div>
                  </div>
                  <span className={styles.breakdownValue}>{share.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
