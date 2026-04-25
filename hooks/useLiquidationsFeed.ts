import { useEffect, useCallback, useMemo } from 'react';
import { LiquidationEvent } from '@/lib/liquidations/types';
import { BinanceFeed } from '@/lib/liquidations/binanceFeed';
import { HyperliquidFeed } from '@/lib/liquidations/hyperliquidFeed';
import { OkxFeed } from '@/lib/liquidations/okxFeed';
import { BybitFeed } from '@/lib/liquidations/bybitFeed';
import { BitgetFeed } from '@/lib/liquidations/bitgetFeed';
import { GateFeed } from '@/lib/liquidations/gateFeed';
import { HtxFeed } from '@/lib/liquidations/htxFeed';
import { useLiquidationsStore, LiquidationsFeedMetrics } from '@/store/useLiquidationsStore';

// Global singleton instances to prevent duplicate connections
let globalBinance: BinanceFeed | null = null;
let globalHL: HyperliquidFeed | null = null;
let globalOkx: OkxFeed | null = null;
let globalBybit: BybitFeed | null = null;
let globalBitget: BitgetFeed | null = null;
let globalGate: GateFeed | null = null;
let globalHtx: HtxFeed | null = null;

export function useLiquidationsFeed() {
  const {
    events,
    metrics,
    isLive,
    isLoading,
    isHydrated,
    lastUpdate,
    addEvent,
    setInitialData,
    setIsLoading,
    setIsHydrated,
    toggleLive
  } = useLiquidationsStore();

  const handleNewEvent = useCallback((event: LiquidationEvent) => {
    addEvent(event);
  }, [addEvent]);

  // Background Hydration logic
  useEffect(() => {
    const hydrate = async () => {
      if (isHydrated) return;

      try {
        setIsLoading(true);
        console.log('[useLiquidationsFeed] Fetching historical data...');
        const resp = await fetch('/api/liquidations');
        const json = await resp.json();
        
        console.log('[useLiquidationsFeed] Hydration response:', {
          success: json.success,
          count: json.data?.events?.length || 0
        });

        if (json.success && json.data.events && json.data.events.length > 0) {
          const combined = json.data.events;
          
          let vol = 0;
          let long = 0;
          let short = 0;
          let maxSingle = 0;
          let topAsset = '---';
          let maxAssetVol = 0;
          const tempAssetMap: Record<string, number> = {};
          
          let whaleCount = 0;
          combined.forEach((e: LiquidationEvent) => {
            const usd = e.notional_usd || 0;
            vol += usd;
            if (e.side === 'long') long += usd; else short += usd;
            if (usd > maxSingle) maxSingle = usd;
            if (usd >= 500000) whaleCount++;
            
            tempAssetMap[e.symbol] = (tempAssetMap[e.symbol] || 0) + usd;
            if (tempAssetMap[e.symbol] > maxAssetVol) {
              maxAssetVol = tempAssetMap[e.symbol];
              topAsset = e.symbol;
            }
          });

          const initialMetrics: LiquidationsFeedMetrics = {
            totalVolume: vol,
            totalLongUsd: long,
            totalShortUsd: short,
            longRatio: vol > 0 ? long / vol : 0,
            shortRatio: vol > 0 ? short / vol : 0,
            avgSize: combined.length > 0 ? vol / combined.length : 0,
            largestSingle: maxSingle,
            topAsset,
            eventCount24h: combined.length,
            whaleCount,
          };

          setInitialData(combined, initialMetrics);
        } else {
          console.warn('[useLiquidationsFeed] No historical data received');
          setIsLoading(false);
          setIsHydrated(true);
        }
      } catch (err) {
        console.error('[useLiquidationsFeed] Hydration error:', err);
        setIsLoading(false);
        setIsHydrated(true);
      }
    };

    hydrate();
  }, [isHydrated, setInitialData, setIsLoading, setIsHydrated]);

  // WebSocket lifecycle
  useEffect(() => {
    if (isLive && !isLoading) {
      if (!globalBinance) {
        console.log('[useLiquidationsFeed] Starting Multi-Exchange Feeds');
        globalBinance = new BinanceFeed(handleNewEvent);
        globalHL = new HyperliquidFeed(handleNewEvent);
        globalOkx = new OkxFeed(handleNewEvent);
        globalBybit = new BybitFeed(handleNewEvent);
        globalBitget = new BitgetFeed(handleNewEvent);
        globalGate = new GateFeed(handleNewEvent);
        globalHtx = new HtxFeed(handleNewEvent);

        globalBinance.connect();
        globalHL.connect();
        globalOkx.connect();
        globalBybit.connect();
        globalBitget.connect();
        globalGate.connect();
        globalHtx.connect();
      }
    } else if (!isLive) {
      globalBinance?.disconnect();
      globalHL?.disconnect();
      globalOkx?.disconnect();
      globalBybit?.disconnect();
      globalBitget?.disconnect();
      globalGate?.disconnect();
      globalHtx?.disconnect();
      
      globalBinance = null;
      globalHL = null;
      globalOkx = null;
      globalBybit = null;
      globalBitget = null;
      globalGate = null;
      globalHtx = null;
    }
  }, [isLive, handleNewEvent, isLoading]);

  const derivedData = useMemo(() => {
    const symMap = new Map<string, { v: number, l: number, s: number }>();
    const exMap = new Map<string, { v: number, l: number, s: number, c: number }>();
    const matMap = new Map<string, { v: number, l: number, s: number }>();

    events.forEach(e => {
      const isLong = e.side === 'long';
      const usd = Number(e.notional_usd) || 0;
      
      const symName = e.symbol.toUpperCase().replace('USDT', '').replace('-USDT-SWAP', '').replace('-USDT', '').replace('_USDT', '');
      const dexName = e.dex.toUpperCase();
      
      // Symbol Map
      const sym = symMap.get(symName) || { v: 0, l: 0, s: 0 };
      sym.v += usd;
      if (isLong) sym.l += usd; else sym.s += usd;
      symMap.set(symName, sym);

      // Exchange Map
      const ex = exMap.get(dexName) || { v: 0, l: 0, s: 0, c: 0 };
      ex.v += usd;
      ex.c += 1;
      if (isLong) ex.l += usd; else ex.s += usd;
      exMap.set(dexName, ex);

      // Matrix Map
      const matKey = `${symName}-${dexName}`;
      const mat = matMap.get(matKey) || { v: 0, l: 0, s: 0 };
      mat.v += usd;
      if (isLong) mat.l += usd; else mat.s += usd;
      matMap.set(matKey, mat);
    });

    const exchangesTreemapData = Array.from(exMap.entries()).map(([name, data]) => ({
      name: name.toUpperCase(),
      value: data.v,
      longValue: data.l,
      shortValue: data.s,
      count: data.c
    }));

    const symbolsTreemapData = Array.from(symMap.entries())
      .map(([name, data]) => ({ name, value: data.v, longValue: data.l, shortValue: data.s }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 40);

    const matrixData = Array.from(matMap.entries()).map(([key, data]) => {
      const [symbol, exchange] = key.split('-');
      return {
        symbol,
        exchange: exchange.toUpperCase(),
        value: data.v,
        longValue: data.l,
        shortValue: data.s
      };
    });

    const CORE_EXCHANGES = ['BINANCE', 'OKX', 'BYBIT', 'BITGET', 'GATE.IO', 'HTX', 'HYPERLIQUID'];
    
    const uniqueSymbols = Array.from(symMap.keys()).sort();
    
    const activeExchanges = Array.from(exMap.keys()).map(k => k.toUpperCase());
    const uniqueExchanges = Array.from(new Set([...CORE_EXCHANGES, ...activeExchanges])).sort();

    return {
      symbolsTreemapData,
      exchangesTreemapData,
      matrixData,
      uniqueSymbols,
      uniqueExchanges,
      activeExchanges
    };
  }, [events]);

  return {
    events,
    metrics,
    isLive,
    isLoading,
    isHydrated,
    setIsLoading,
    setIsHydrated,
    toggleLive,
    error: null,
    lastUpdate,
    ...derivedData
  };
}
