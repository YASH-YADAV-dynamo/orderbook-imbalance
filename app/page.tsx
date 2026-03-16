'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AggLevel, DEFAULT_FORMULA_PARAMS, FormulaParams, FormulaType } from '@/types/orderbook';
import { useOrderbook } from '@/hooks/useOrderbook';
import Header from '@/components/Header';
import FormulaSelector from '@/components/FormulaSelector';
import ImbalanceGauge from '@/components/ImbalanceGauge';
import StatsRow from '@/components/StatsRow';
import DepthBars from '@/components/DepthBars';
import styles from './page.module.css';

const ImbalanceChart = dynamic(() => import('@/components/ImbalanceChart'), { ssr: false });
const VolumeChart = dynamic(() => import('@/components/VolumeChart'), { ssr: false });

export default function Home() {
  const [symbol, setSymbol] = useState('SOL');
  const [aggLevel, setAggLevel] = useState<AggLevel>(1);
  const [formula, setFormula] = useState<FormulaType>('distanceWeighted');
  const [params, setParams] = useState<FormulaParams>(DEFAULT_FORMULA_PARAMS);

  const { state, history, reconnect } = useOrderbook(symbol, aggLevel, formula, params);

  function handleParamsChange(patch: Partial<FormulaParams>) {
    setParams(prev => ({ ...prev, ...patch }));
  }

  return (
    <div className={styles.shell}>
      <Header
        symbol={symbol}
        aggLevel={aggLevel}
        connected={state.connected}
        connecting={state.connecting}
        error={state.error}
        onSymbolChange={setSymbol}
        onAggChange={setAggLevel}
        onReconnect={reconnect}
      />

      <main className={styles.main}>
        <FormulaSelector
          formula={formula}
          params={params}
          onFormulaChange={setFormula}
          onParamsChange={handleParamsChange}
        />

        <ImbalanceGauge imbalance={state.imbalance} symbol={state.symbol || symbol} />

        <StatsRow
          totalBidVol={state.totalBidVol}
          totalAskVol={state.totalAskVol}
          spread={state.spread}
          imbalance={state.imbalance}
          numBidLevels={state.bids.length}
          numAskLevels={state.asks.length}
          timestamp={state.timestamp}
        />

        <DepthBars bids={state.bids} asks={state.asks} />

        <ImbalanceChart history={history} />
        <VolumeChart history={history} />
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
