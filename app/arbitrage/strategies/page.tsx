'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { deletePreset, readPresets, upsertPreset } from '@/lib/strategies/presetStorage';
import { MARKET_PAIRS } from '@/lib/pairs';
import type { FundingApiResponse } from '@/types/funding';
import type { StrategyPreset, StrategyRunResult } from '@/types/strategyPreset';
import styles from './page.module.css';

const DEFAULT_SYMBOLS = MARKET_PAIRS.slice(0, 3).map(p => p.id);

function makePreset(name: string): StrategyPreset {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    kind: 'funding_basis',
    symbols: DEFAULT_SYMBOLS,
    params: { minSpreadBps: 3, maxNotionalUsd: 1_000, maxOpenPositions: 2 },
    createdAt: now,
    updatedAt: now,
  };
}

function computeRunMetrics(data: FundingApiResponse, preset: StrategyPreset): StrategyRunResult {
  const rows = data.pairs.filter(p => preset.symbols.includes(p.symbol) && p.maxArbRate != null);
  const spreads = rows.map(r => (r.maxArbRate ?? 0) * 10_000);
  const averageSpreadBps = spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0;
  const bestSpreadBps = spreads.length ? Math.max(...spreads) : 0;
  const opportunities = spreads.filter(v => v >= preset.params.minSpreadBps).length;
  return {
    runId: crypto.randomUUID(),
    presetId: preset.id,
    createdAt: Date.now(),
    symbolsAnalyzed: rows.length,
    averageSpreadBps,
    bestSpreadBps,
    opportunities,
    note: 'Paper metrics only. Real PnL requires live executions and fills.',
  };
}

export default function StrategiesPage() {
  const [presets, setPresets] = useState<StrategyPreset[]>([]);
  const [name, setName] = useState('Momentum Funding');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [run, setRun] = useState<StrategyRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPresets(readPresets()), []);

  const selected = useMemo(() => presets.find(p => p.id === selectedId) ?? null, [presets, selectedId]);

  const createPreset = () => {
    const preset = makePreset(name.trim() || 'Unnamed preset');
    setPresets(upsertPreset(preset));
    setSelectedId(preset.id);
  };

  const duplicatePreset = (preset: StrategyPreset) => {
    const now = Date.now();
    const copy: StrategyPreset = {
      ...preset,
      id: crypto.randomUUID(),
      name: `${preset.name} Copy`,
      createdAt: now,
      updatedAt: now,
    };
    setPresets(upsertPreset(copy));
  };

  const removePreset = (id: string) => {
    setPresets(deletePreset(id));
    if (selectedId === id) setSelectedId(null);
  };

  const runPreset = async (preset: StrategyPreset) => {
    setError(null);
    setRun(null);
    try {
      const params = new URLSearchParams({ symbols: preset.symbols.join(',') });
      const res = await fetch(`/api/funding?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as FundingApiResponse | { error: string };
      if (!res.ok || 'error' in json) throw new Error('error' in json ? json.error : `HTTP ${res.status}`);
      setRun(computeRunMetrics(json, preset));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <h1>Strategy presets</h1>
        <Link href="/arbitrage" className={styles.link}>Back to arbitrage</Link>
      </nav>

      <section className={styles.newPreset}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Preset name" />
        <button type="button" onClick={createPreset}>Create preset</button>
      </section>

      <section className={styles.grid}>
        <div className={styles.list}>
          {presets.length === 0 && <p className={styles.empty}>No presets yet.</p>}
          {presets.map(preset => (
            <article key={preset.id} className={styles.card} data-selected={selectedId === preset.id || undefined}>
              <button type="button" className={styles.titleBtn} onClick={() => setSelectedId(preset.id)}>
                {preset.name}
              </button>
              <p>{preset.symbols.join(', ')}</p>
              <div className={styles.actions}>
                <button type="button" onClick={() => void runPreset(preset)}>Run</button>
                <button type="button" onClick={() => duplicatePreset(preset)}>Duplicate</button>
                <button type="button" onClick={() => removePreset(preset.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.panel}>
          {selected ? (
            <>
              <h2>{selected.name}</h2>
              <p>Kind: {selected.kind}</p>
              <p>Min spread: {selected.params.minSpreadBps} bps</p>
              <p>Max notional: ${selected.params.maxNotionalUsd}</p>
              <p>Max open positions: {selected.params.maxOpenPositions}</p>
              <p className={styles.note}>Run uses current `/api/funding` snapshot as paper backtest input.</p>
            </>
          ) : (
            <p className={styles.empty}>Select a preset to inspect.</p>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {run && (
            <div className={styles.metrics}>
              <h3>Latest run</h3>
              <p>Symbols analyzed: {run.symbolsAnalyzed}</p>
              <p>Avg spread: {run.averageSpreadBps.toFixed(2)} bps</p>
              <p>Best spread: {run.bestSpreadBps.toFixed(2)} bps</p>
              <p>Opportunities: {run.opportunities}</p>
              <p className={styles.note}>{run.note}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
