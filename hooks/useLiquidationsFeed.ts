import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { LiquidationEvent } from '@/lib/liquidations/types';
import { generateUniqueId } from '@/lib/liquidations/utils';
import { BinanceFeed, FeedStatus } from '@/lib/liquidations/binanceFeed';
import { HyperliquidFeed } from '@/lib/liquidations/hyperliquidFeed';
import { OkxFeed } from '@/lib/liquidations/okxFeed';
import { BybitFeed } from '@/lib/liquidations/bybitFeed';
import { BitgetFeed } from '@/lib/liquidations/bitgetFeed';
import { GateFeed } from '@/lib/liquidations/gateFeed';
import { HtxFeed } from '@/lib/liquidations/htxFeed';
import { useLiquidationsStore, LiquidationsFeedMetrics } from '@/store/useLiquidationsStore';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ExchangeKey = 'BINANCE' | 'OKX' | 'BYBIT' | 'BITGET' | 'GATE.IO' | 'HTX' | 'HYPERLIQUID';

export interface ExchangeConnectionStatus {
  key: ExchangeKey;
  status: FeedStatus | 'idle';
  eventCount: number;
}

// ─── Global singleton instances ────────────────────────────────────────────────
// (Prevents duplicate connections on React re-renders)
let globalBinance: BinanceFeed | null = null;
let globalHL: HyperliquidFeed | null = null;
let globalOkx: OkxFeed | null = null;
let globalBybit: BybitFeed | null = null;
let globalBitget: BitgetFeed | null = null;
let globalGate: GateFeed | null = null;
let globalHtx: HtxFeed | null = null;

const EXCHANGE_KEYS: ExchangeKey[] = ['BINANCE', 'OKX', 'BYBIT', 'BITGET', 'GATE.IO', 'HTX', 'HYPERLIQUID'];

export function useLiquidationsFeed() {
  const events      = useLiquidationsStore(s => s.events);
  const metrics     = useLiquidationsStore(s => s.metrics);
  const isLive      = useLiquidationsStore(s => s.isLive);
  const isLoading   = useLiquidationsStore(s => s.isLoading);
  const isHydrated  = useLiquidationsStore(s => s.isHydrated);
  const lastUpdate  = useLiquidationsStore(s => s.lastUpdate);

  const addEvents       = useLiquidationsStore(s => s.addEvents);
  const setInitialData  = useLiquidationsStore(s => s.setInitialData);
  const setIsLoading    = useLiquidationsStore(s => s.setIsLoading);
  const setIsHydrated   = useLiquidationsStore(s => s.setIsHydrated);
  const toggleLive      = useLiquidationsStore(s => s.toggleLive);

  // ─── Per-exchange connection tracking ─────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<Record<ExchangeKey, FeedStatus | 'idle'>>({
    BINANCE:      'idle',
    OKX:          'idle',
    BYBIT:        'idle',
    BITGET:       'idle',
    'GATE.IO':    'idle',
    HTX:          'idle',
    HYPERLIQUID:  'idle',
  });
  const [eventCounts, setEventCounts] = useState<Record<ExchangeKey, number>>({
    BINANCE: 0, OKX: 0, BYBIT: 0, BITGET: 0, 'GATE.IO': 0, HTX: 0, HYPERLIQUID: 0,
  });

  const updateStatus = useCallback((key: ExchangeKey, status: FeedStatus) => {
    setConnectionStatus(prev => ({ ...prev, [key]: status }));
  }, []);

  // ─── Batch event processing ────────────────────────────────────────────────
  const eventBuffer = useRef<LiquidationEvent[]>([]);
  const batchTimer  = useRef<NodeJS.Timeout | null>(null);

  const processBatch = useCallback(() => {
    if (eventBuffer.current.length === 0) return;
    const batch = [...eventBuffer.current];
    eventBuffer.current = [];

    // Track event counts per exchange
    const counts: Partial<Record<ExchangeKey, number>> = {};
    batch.forEach(e => {
      const key = e.dex.toUpperCase() as ExchangeKey;
      counts[key] = (counts[key] || 0) + 1;
    });
    setEventCounts(prev => {
      const next = { ...prev };
      Object.entries(counts).forEach(([k, v]) => {
        if (EXCHANGE_KEYS.includes(k as ExchangeKey)) {
          next[k as ExchangeKey] = (next[k as ExchangeKey] || 0) + v;
        }
      });
      return next;
    });

    addEvents(batch);
  }, [addEvents]);

  const handleNewEvent = useCallback((event: LiquidationEvent) => {
    eventBuffer.current.push(event);
    if (!batchTimer.current) {
      batchTimer.current = setInterval(processBatch, 150);
    }
  }, [processBatch]);

  useEffect(() => {
    return () => { if (batchTimer.current) clearInterval(batchTimer.current); };
  }, []);

  // ─── Hydration (REST seed) ─────────────────────────────────────────────────
  useEffect(() => {
    if (isHydrated) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    setIsLoading(true);
    fetch('/api/liquidations', { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        clearTimeout(timeout);
        if (json.success && json.data?.events?.length > 0) {
          setInitialData(json.data.events, {} as any);
        } else {
          // No seed data — mark hydrated anyway so WS can take over
          setIsLoading(false);
          setIsHydrated(true);
        }
      })
      .catch(() => {
        setIsLoading(false);
        setIsHydrated(true);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [isHydrated, setInitialData, setIsLoading, setIsHydrated]);

  // Use a ref so callbacks are always fresh (avoids stale closure in singleton classes)
  const updateStatusRef = useRef(updateStatus);
  useEffect(() => { updateStatusRef.current = updateStatus; }, [updateStatus]);

  // ─── WebSocket lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isLive) {
      globalBinance?.disconnect();
      globalHL?.disconnect();
      globalOkx?.disconnect();
      globalBybit?.disconnect();
      globalBitget?.disconnect();
      globalGate?.disconnect();
      globalHtx?.disconnect();
      globalBinance = globalHL = globalOkx = globalBybit = globalBitget = globalGate = globalHtx = null;
      EXCHANGE_KEYS.forEach(k => updateStatusRef.current(k, 'disconnected'));
      return;
    }

    if (globalBinance) return; // Already started

    console.log('[Feeds] Starting all WebSocket connections...');

    const s = (key: ExchangeKey) => (st: FeedStatus) => updateStatusRef.current(key, st);

    globalBinance = new BinanceFeed(handleNewEvent, s('BINANCE'));
    globalOkx     = new OkxFeed(handleNewEvent, s('OKX'));
    globalBybit   = new BybitFeed(handleNewEvent, s('BYBIT'));
    globalBitget  = new BitgetFeed(handleNewEvent, s('BITGET'));
    globalGate    = new GateFeed(handleNewEvent, s('GATE.IO'));
    globalHtx     = new HtxFeed(handleNewEvent, s('HTX'));
    globalHL      = new HyperliquidFeed(handleNewEvent, s('HYPERLIQUID'));

    globalBinance.connect();
    globalOkx.connect();
    globalBybit.connect();
    globalBitget.connect();
    globalGate.connect();
    globalHtx.connect();
    globalHL.connect();
  }, [isLive, handleNewEvent]);

  // ─── Derived dashboard data ────────────────────────────────────────────────
  const derivedData = useMemo(() => {
    const symMap = new Map<string, { v: number, l: number, s: number }>();
    const exMap  = new Map<string, { v: number, l: number, s: number, c: number }>();
    const matMap = new Map<string, { v: number, l: number, s: number }>();

    events.forEach(e => {
      const isLong   = e.side === 'long';
      const usd      = Number(e.notional_usd) || 0;
      const symName  = e.symbol.toUpperCase()
        .replace('USDT', '').replace('-USDT-SWAP', '').replace('-USDT', '').replace('_USDT', '');
      const dexName  = e.dex.toUpperCase();

      const sym = symMap.get(symName) || { v: 0, l: 0, s: 0 };
      sym.v += usd; if (isLong) sym.l += usd; else sym.s += usd;
      symMap.set(symName, sym);

      const ex = exMap.get(dexName) || { v: 0, l: 0, s: 0, c: 0 };
      ex.v += usd; ex.c += 1; if (isLong) ex.l += usd; else ex.s += usd;
      exMap.set(dexName, ex);

      const matKey = `${symName}-${dexName}`;
      const mat = matMap.get(matKey) || { v: 0, l: 0, s: 0 };
      mat.v += usd; if (isLong) mat.l += usd; else mat.s += usd;
      matMap.set(matKey, mat);
    });

    const exchangesTreemapData = Array.from(exMap.entries()).map(([name, data]) => ({
      name: name.toUpperCase(), value: data.v, longValue: data.l, shortValue: data.s, count: data.c,
    }));

    const symbolsTreemapData = Array.from(symMap.entries())
      .map(([name, data]) => ({ name, value: data.v, longValue: data.l, shortValue: data.s }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 40);

    const matrixData = Array.from(matMap.entries()).map(([key, data]) => {
      const [symbol, exchange] = key.split('-');
      return { symbol, exchange: exchange.toUpperCase(), value: data.v, longValue: data.l, shortValue: data.s };
    });

    const uniqueSymbols   = Array.from(symMap.keys()).sort();
    const activeExchanges = Array.from(exMap.keys()).map(k => k.toUpperCase());
    const uniqueExchanges = Array.from(new Set([...EXCHANGE_KEYS, ...activeExchanges])).sort();

    return { symbolsTreemapData, exchangesTreemapData, matrixData, uniqueSymbols, uniqueExchanges, activeExchanges };
  }, [events]);

  // ─── Exchange status for UI ────────────────────────────────────────────────
  const exchangeStatuses: ExchangeConnectionStatus[] = EXCHANGE_KEYS.map(key => ({
    key,
    status:     connectionStatus[key],
    eventCount: eventCounts[key] || 0,
  }));

  const connectedCount = exchangeStatuses.filter(s => s.status === 'connected').length;

  return {
    events,
    metrics,
    isLive,
    isLoading,
    isHydrated,
    setIsLoading,
    setIsHydrated,
    toggleLive,
    error:          null,
    lastUpdate,
    exchangeStatuses,
    connectedCount,
    ...derivedData,
  };
}
