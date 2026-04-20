'use client';

import { useState } from 'react';
import { AggLevel, DEFAULT_FORMULA_PARAMS, FormulaParams, FormulaType } from '@/types/orderbook';
import { useDexOrderbook } from '@/hooks/useDexOrderbook';
import { useBinancePrice } from '@/hooks/useBinancePrice';
import DashboardLayout from '@/components/DashboardLayout';
import { ADAPTERS } from '@/lib/dexAdapters';
import { getPairsForAdapter } from '@/lib/pairs';

const PAIRS = getPairsForAdapter('pacifica');

export default function PacificaDashboard() {
  const [symbol,   setSymbol]   = useState('SOL/USD');
  const [aggLevel, setAggLevel] = useState<AggLevel>(1);
  const [formula,  setFormula]  = useState<FormulaType>('distanceWeighted');
  const [params,   setParams]   = useState<FormulaParams>(DEFAULT_FORMULA_PARAMS);

  const refMid = useBinancePrice(symbol);

  const { state, history, reconnect } = useDexOrderbook(
    ADAPTERS.pacifica, symbol, formula, params, aggLevel, refMid,
  );

  return (
    <DashboardLayout
      brandName="PACIFICA"
      supportedPairs={PAIRS}
      showAgg
      backHref="/"
      state={state} history={history} reconnect={reconnect}
      symbol={symbol} onSymbolChange={setSymbol}
      formula={formula} params={params}
      onFormulaChange={setFormula}
      onParamsChange={p => setParams(prev => ({ ...prev, ...p }))}
      aggLevel={aggLevel} onAggChange={setAggLevel}
    />
  );
}
