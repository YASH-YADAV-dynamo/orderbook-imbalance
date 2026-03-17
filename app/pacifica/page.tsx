'use client';

import { useState } from 'react';
import { AggLevel, DEFAULT_FORMULA_PARAMS, FormulaParams, FormulaType } from '@/types/orderbook';
import { useDexOrderbook } from '@/hooks/useDexOrderbook';
import DashboardLayout from '@/components/DashboardLayout';
import { ADAPTERS } from '@/lib/dexAdapters';
import { useAppStore } from '@/store/useAppStore';

export default function PacificaDashboard() {
  const darkMode       = useAppStore(s => s.darkMode);
  const toggleDarkMode = useAppStore(s => s.toggleDarkMode);

  const [symbol,   setSymbol]   = useState('SOL');
  const [aggLevel, setAggLevel] = useState<AggLevel>(1);
  const [formula,  setFormula]  = useState<FormulaType>('distanceWeighted');
  const [params,   setParams]   = useState<FormulaParams>(DEFAULT_FORMULA_PARAMS);

  const { state, history, reconnect } = useDexOrderbook(
    ADAPTERS.pacifica, symbol, formula, params, aggLevel,
  );

  return (
    <DashboardLayout
      brandName="PACIFICA"
      supportedSymbols={ADAPTERS.pacifica.supportedSymbols}
      showAgg
      backHref="/"
      state={state} history={history} reconnect={reconnect}
      symbol={symbol} onSymbolChange={setSymbol}
      formula={formula} params={params}
      onFormulaChange={setFormula}
      onParamsChange={p => setParams(prev => ({ ...prev, ...p }))}
      aggLevel={aggLevel} onAggChange={setAggLevel}
      darkMode={darkMode} onToggleTheme={toggleDarkMode}
    />
  );
}
