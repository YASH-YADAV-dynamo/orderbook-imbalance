import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LiquidationEvent } from '@/lib/liquidations/types';

export interface LiquidationsFeedMetrics {
  totalVolume: number;
  totalLongUsd: number;
  totalShortUsd: number;
  longRatio: number;
  shortRatio: number;
  avgSize: number;
  maxLiqUsd: number;
  backstopUsd: number;
  eventCount24h: number;
}

export interface LiquidationsChartData {
  time: number;
  long: number;
  short: number;
}

export function useLiquidationsFeed(symbol: string = 'BTC') {
  const [events, setEvents] = useState<LiquidationEvent[]>([]);
  const [metrics, setMetrics] = useState<LiquidationsFeedMetrics | null>(null);
  const [chartData, setChartData] = useState<LiquidationsChartData[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/liquidations?symbol=${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch liquidations');
      const json = await res.json();
      
      if (json.success) {
        setEvents(prev => {
          // Merge and deduplicate events based on raw_order_id
          const existingIds = new Set(prev.map(e => e.raw_order_id));
          const newEvents = json.data.events.filter((e: LiquidationEvent) => !existingIds.has(e.raw_order_id));
          
          if (newEvents.length === 0) return prev;
          
          // Add new events to the top, limit to 200 items to prevent memory leaks
          const merged = [...newEvents, ...prev].sort((a, b) => b.timestamp_ms - a.timestamp_ms);
          return merged.slice(0, 200);
        });
        
        setMetrics(json.data.metrics);
        setChartData(json.data.chartData);
        setLastUpdate(Date.now());
        setError(null);
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchData(); // Initial load
    
    let intervalId: NodeJS.Timeout;
    
    if (isLive) {
      intervalId = setInterval(() => {
        fetchData();
      }, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLive, fetchData]);

  const derivedData = useMemo(() => {
    const symMap = new Map<string, { v: number, l: number, s: number }>();
    const exMap = new Map<string, { v: number, l: number, s: number }>();
    const matMap = new Map<string, { v: number, l: number, s: number }>();

    events.forEach(e => {
      const isLong = e.side === 'long';
      
      // Symbol aggregation
      const sym = symMap.get(e.symbol) || { v: 0, l: 0, s: 0 };
      sym.v += e.notional_usd;
      if (isLong) sym.l += e.notional_usd; else sym.s += e.notional_usd;
      symMap.set(e.symbol, sym);

      // Exchange aggregation
      const ex = exMap.get(e.dex) || { v: 0, l: 0, s: 0 };
      ex.v += e.notional_usd;
      if (isLong) ex.l += e.notional_usd; else ex.s += e.notional_usd;
      exMap.set(e.dex, ex);

      // Matrix aggregation
      const matKey = `${e.symbol}-${e.dex}`;
      const mat = matMap.get(matKey) || { v: 0, l: 0, s: 0 };
      mat.v += e.notional_usd;
      if (isLong) mat.l += e.notional_usd; else mat.s += e.notional_usd;
      matMap.set(matKey, mat);
    });

    const symbolsTreemapData = Array.from(symMap.entries()).map(([name, data]) => ({
      name,
      value: data.v,
      longValue: data.l,
      shortValue: data.s
    }));

    const exchangesTreemapData = Array.from(exMap.entries()).map(([name, data]) => ({
      name: name.toUpperCase(),
      value: data.v,
      longValue: data.l,
      shortValue: data.s
    }));

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

    // Unique arrays for Matrix headers
    const uniqueSymbols = Array.from(symMap.keys()).sort();
    const uniqueExchanges = Array.from(exMap.keys()).map(k => k.toUpperCase()).sort();

    return {
      symbolsTreemapData,
      exchangesTreemapData,
      matrixData,
      uniqueSymbols,
      uniqueExchanges
    };
  }, [events]);

  return {
    events,
    metrics,
    chartData,
    isLive,
    isLoading,
    error,
    lastUpdate,
    ...derivedData,
    toggleLive: () => setIsLive(prev => !prev),
    setSymbol: (sym: string) => { /* Hook can be extended to handle symbol change */ }
  };
}
