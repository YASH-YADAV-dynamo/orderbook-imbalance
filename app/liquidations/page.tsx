'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { NavTabs } from '@/components/ui/NavTabs';
import { ThemeSwitcher } from '@/components/ui/apple-liquid-glass-switcher';
import { useLiquidationsFeed } from '@/hooks/useLiquidationsFeed';
import { MetricsBar, VolumeChart, FilterBar, DataTable, Treemap, LiquidationMatrix } from '@/components/liquidations';
import styles from './page.module.css';

export default function LiquidationsPage() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const { 
    events, 
    metrics, 
    chartData, 
    symbolsTreemapData,
    exchangesTreemapData,
    matrixData,
    uniqueSymbols,
    uniqueExchanges,
    isLoading, 
    isLive, 
    toggleLive,
    lastUpdate 
  } = useLiquidationsFeed('BTC');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((e: any) => {
      if (searchQuery && !e.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (typeFilter !== 'all' && e.liq_type !== typeFilter) return false;
      if (sideFilter !== 'all' && e.side !== sideFilter) return false;
      return true;
    });
  }, [events, searchQuery, typeFilter, sideFilter]);

  const formattedUpdate = useMemo(() => {
    if (!lastUpdate) return '--:--:-- UTC';
    const d = new Date(lastUpdate);
    return d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
  }, [lastUpdate]);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navDot} />
          <span className={styles.navTitle}>skewX</span>
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
        {/* Zone A: Header Strip */}
        <div className={styles.headerStrip}>
          <h1 className={styles.pageTitle}>Liquidations</h1>
          <div className={styles.liveStatus}>
            <button 
              onClick={toggleLive}
              className={`${styles.liveBadge} ${isLive ? styles.liveBadgeActive : styles.liveBadgePaused}`}
            >
              <span className={styles.pulseDot} />
              {isLive ? 'LIVE' : 'PAUSED'}
            </button>
            <span className={styles.timestamp} suppressHydrationWarning>
              Updated: {mounted ? formattedUpdate : '--:--:-- UTC'}
            </span>
          </div>
        </div>

        {/* Zone B: Metrics Bar */}
        <div className={styles.section}>
          <MetricsBar metrics={metrics} isLoading={isLoading} />
        </div>

        {/* Zone C: Side-by-Side Treemaps */}
        <div className={styles.treemapSection}>
          <div className={styles.treemapWrapper}>
            <Treemap 
              data={symbolsTreemapData} 
              title="Symbols Liquidation Distribution" 
              subtitle="24h liquidation volume" 
              height={360} 
            />
          </div>
          <div className={styles.treemapWrapper}>
            <Treemap 
              data={exchangesTreemapData} 
              title="Exchanges Liquidation Distribution" 
              subtitle="24h liquidation volume" 
              height={360} 
            />
          </div>
        </div>

        {/* Zone D: Heatmap Matrix */}
        <div className={styles.section}>
          <h3 className={styles.matrixTitle}>Liquidations Matrix</h3>
          <LiquidationMatrix 
            data={matrixData} 
            exchanges={uniqueExchanges} 
            symbols={uniqueSymbols} 
          />
        </div>

        {/* Zone E: Real-time Event Stream and Filters */}
        <div className={styles.feedAndChartSection}>
          <div className={styles.eventFeedColumn}>
            <div className={styles.section}>
              <FilterBar 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                sideFilter={sideFilter}
                setSideFilter={setSideFilter}
              />
            </div>
            <div className={styles.tableSection}>
              <DataTable events={filteredEvents} isLoading={isLoading} />
            </div>
          </div>
          
          <div className={styles.chartColumn}>
            <div className={styles.chartArea}>
              <VolumeChart data={chartData} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
