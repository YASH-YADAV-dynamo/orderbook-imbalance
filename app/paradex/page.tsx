'use client';

import { useState } from 'react';
import { DEFAULT_FORMULA_PARAMS, FormulaParams, FormulaType } from '@/types/orderbook';
import { useDexOrderbook } from '@/hooks/useDexOrderbook';
import DashboardLayout from '@/components/DashboardLayout';
import { ADAPTERS } from '@/lib/dexAdapters';
import { useAppStore } from '@/store/useAppStore';

export default function ParadexDashboard() {
  const darkMode       = useAppStore(s => s.darkMode);
  const toggleDarkMode = useAppStore(s => s.toggleDarkMode);

  const [symbol,  setSymbol]  = useState('BTC');
  const [formula, setFormula] = useState<FormulaType>('distanceWeighted');
  const [params,  setParams]  = useState<FormulaParams>(DEFAULT_FORMULA_PARAMS);

  const { state, history, reconnect } = useDexOrderbook(
    ADAPTERS.paradex, symbol, formula, params,
  );

  return (
    <DashboardLayout
      brandName="PARADEX"
      supportedSymbols={ADAPTERS.paradex.supportedSymbols}
      backHref="/"
      state={state} history={history} reconnect={reconnect}
      symbol={symbol} onSymbolChange={setSymbol}
      formula={formula} params={params}
      onFormulaChange={setFormula}
      onParamsChange={p => setParams(prev => ({ ...prev, ...p }))}
      darkMode={darkMode} onToggleTheme={toggleDarkMode}
    />
  );
}
