'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLiquidationsFeed } from '@/hooks/useLiquidationsFeed';
import { MetricsBar, DataTable, LiquidationMatrix, ExchangeBreakdown, Treemap } from '@/components/liquidations';
import Header from '@/components/Header';
import styles from './page.module.css';

export default function LiquidationsPage() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);

  const { 
    events, 
    metrics, 
    uniqueSymbols,
    uniqueExchanges,
    activeExchanges,
    matrixData,
    symbolsTreemapData,
    exchangesTreemapData,
    isLoading, 
    isLive, 
    toggleLive,
    setIsHydrated,
    setIsLoading,
    lastUpdate,
    exchangeStatuses,
    connectedCount,
  } = useLiquidationsFeed();

  const handleRefresh = () => {
    setIsHydrated(false);
    setIsLoading(true);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  // Initial mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e: any) => {
      if (searchQuery && !e.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [events, searchQuery]);

  const formattedUpdate = useMemo(() => {
    if (!lastUpdate) return '--:--:-- UTC';
    const d = new Date(lastUpdate);
    return d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
  }, [lastUpdate]);

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
        onReconnect={handleRefresh}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onSetTheme={setTheme}
        brandName=""
        brandMetric="GLOBAL LIQUIDATIONS"
        showAgg={false}
        backHref="/"
      />

      <main className={styles.main}>
        {/* Header Strip */}
        <div className={styles.headerStrip}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Global Liquidations</h1>
            <p className={styles.pageSubtitle}>Real-time cross-exchange liquidation monitoring</p>
          </div>
          
          <div className={styles.liveStatus}>
            <div className={styles.sourceBadges}>
              {exchangeStatuses.map(({ key, status, eventCount }) => {
                let label = '';
                let badgeClass = styles.sourceBadge;

                if (status === 'idle') {
                  label = `${key} IDLE`;
                } else if (status === 'connecting') {
                  label = `${key} CONNECTING`;
                  badgeClass = `${styles.sourceBadge} ${styles.badgeConnecting}`;
                } else if (status === 'connected') {
                  label = eventCount > 0 ? `${key} ACTIVE (${eventCount})` : `${key} LIVE`;
                  badgeClass = `${styles.sourceBadge} ${styles.badgeConnected}`;
                } else if (status === 'error') {
                  label = `${key} ERROR`;
                  badgeClass = `${styles.sourceBadge} ${styles.badgeError}`;
                } else {
                  label = `${key} OFFLINE`;
                  badgeClass = `${styles.sourceBadge} ${styles.badgeOffline}`;
                }

                return <span key={key} className={badgeClass}>{label}</span>;
              })}
              {isLive && (
                <span className={styles.connectedCount}>
                  {connectedCount}/{exchangeStatuses.length} LIVE
                </span>
              )}
            </div>
            
            <button 
              onClick={handleRefresh}
              className={styles.refreshButton}
              title="Refresh Data"
              disabled={isLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? styles.spinning : ''}>
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>

            <span className={styles.timestamp} suppressHydrationWarning>
              {mounted ? formattedUpdate : '--:--:-- UTC'}
            </span>
          </div>
        </div>

        {/* Metrics Overview */}
        <MetricsBar metrics={metrics} isLoading={isLoading} />

        {/* Primary Dashboard Grid */}
        <div className={styles.dashboardGrid}>
          {/* Main Liquidation Matrix */}
          <div className={`${styles.section} ${styles.matrixArea}`}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Liquidation Matrix</h3>
              <span className={styles.sectionSubtitle}>Intensity scaled by 24h volume</span>
            </div>
            <LiquidationMatrix 
              data={matrixData} 
              exchanges={uniqueExchanges} 
              symbols={uniqueSymbols} 
              isLoading={isLoading}
            />
          </div>

          {/* Live Feed and Search */}
          <div className={`${styles.section} ${styles.feedArea}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.feedHeaderGroup}>
                <div className={styles.feedTitleGroup}>
                  <h3 className={styles.sectionTitle}>Real-Time Liquidations</h3>
                  <p className={styles.sectionStats}>
                    {filteredEvents.length.toLocaleString()} events 
                    {searchQuery ? ' (1 filter)' : ''}
                  </p>
                </div>
                <input 
                  type="text" 
                  placeholder="Search symbol..." 
                  className={styles.miniSearch}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.tableArea}>
              <DataTable events={filteredEvents} isLoading={isLoading} />
            </div>
          </div>
        </div>

        {/* Distribution Maps Row (Matching Screenshot) */}
        <div className={styles.secondaryGrid}>
          <div className={`${styles.section} ${styles.treemapArea}`}>
            <Treemap 
              data={symbolsTreemapData} 
              title="Symbols Liquidation Distribution"
              isLoading={isLoading} 
            />
          </div>

          <div className={`${styles.section} ${styles.treemapArea}`}>
            <Treemap 
              data={exchangesTreemapData} 
              title="Exchanges Liquidation Distribution"
              isLoading={isLoading} 
            />
          </div>

          <div className={`${styles.section} ${styles.treemapArea}`}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Exchange Breakdown</h3>
              <span className={styles.sectionSubtitle}>24h volume & event frequency</span>
            </div>
            <ExchangeBreakdown 
              data={exchangesTreemapData} 
              isLoading={isLoading} 
            />
          </div>
        </div>
      </main>
    </div>
  );
}
