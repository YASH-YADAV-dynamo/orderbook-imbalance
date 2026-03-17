'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AggLevel, DEFAULT_FORMULA_PARAMS, FormulaParams, FormulaType } from '@/types/orderbook';
import { useZoOrderbook } from '@/hooks/useZoOrderbook';
import Header from '@/components/Header';
import FormulaSelector from '@/components/FormulaSelector';
import ImbalanceGauge from '@/components/ImbalanceGauge';
import StatsRow from '@/components/StatsRow';
import DepthBars from '@/components/DepthBars';
import styles from './page.module.css';

const ImbalanceChart = dynamic(() => import('@/components/ImbalanceChart'), { ssr: false });
const VolumeChart = dynamic(() => import('@/components/VolumeChart'), { ssr: false });

// Display symbols → WebSocket symbols
const DISPLAY_SYMBOLS = ['BTC', 'ETH', 'SOL'];
const toWsSymbol = (s: string) => `${s}USD`;

// Dummy aggLevel for Header compatibility — 01 Exchange doesn't use aggregation
const AGG_DUMMY: AggLevel = 1;

export default function ZoDashboard() {
  const [symbol, setSymbol] = useState('BTC');
  const [formula, setFormula] = useState<FormulaType>('distanceWeighted');
  const [params, setParams] = useState<FormulaParams>(DEFAULT_FORMULA_PARAMS);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const wsSymbol = toWsSymbol(symbol);
  const { state, history, reconnect } = useZoOrderbook(wsSymbol, formula, params);

  function handleParamsChange(patch: Partial<FormulaParams>) {
    setParams(prev => ({ ...prev, ...patch }));
  }

  return (
    <div className={styles.shell}>
      <Header
        symbol={symbol}
        aggLevel={AGG_DUMMY}
        connected={state.connected}
        connecting={state.connecting}
        error={state.error}
        darkMode={darkMode}
        onSymbolChange={setSymbol}
        onAggChange={() => {}}
        onReconnect={reconnect}
        onToggleTheme={() => setDarkMode(d => !d)}
        brandName="01 EXCHANGE"
        brandMetric="ORDERBOOK IMBALANCE · MAINNET"
        symbols={DISPLAY_SYMBOLS}
        showAgg={false}
        backHref="/"
      />

      <main className={styles.main}>
        <div className={styles.bentoGrid}>

          <div className={`${styles.card} ${styles.formulaCard}`}>
            <FormulaSelector
              formula={formula}
              params={params}
              onFormulaChange={setFormula}
              onParamsChange={handleParamsChange}
            />
          </div>

          <div className={`${styles.card} ${styles.gaugeCard}`}>
            <ImbalanceGauge imbalance={state.imbalance} symbol={`${symbol} · 01 EXCHANGE`} />
          </div>

          <div className={`${styles.card} ${styles.statsCard}`}>
            <StatsRow
              totalBidVol={state.totalBidVol}
              totalAskVol={state.totalAskVol}
              spread={state.spread}
              imbalance={state.imbalance}
              numBidLevels={state.bids.length}
              numAskLevels={state.asks.length}
              timestamp={state.timestamp}
            />
          </div>

          <div className={`${styles.card} ${styles.depthCard}`}>
            <DepthBars bids={state.bids} asks={state.asks} />
          </div>

          <div className={`${styles.card} ${styles.imbalanceChartCard}`}>
            <ImbalanceChart history={history} darkMode={darkMode} />
          </div>

          <div className={`${styles.card} ${styles.volumeChartCard}`}>
            <VolumeChart history={history} darkMode={darkMode} />
          </div>

        </div>
      </main>

      {state.error && (
        <div className={styles.errorBar}>
          <span className={styles.errorDot} />
          {state.error}
        </div>
      )}
    </div>
  );
}
