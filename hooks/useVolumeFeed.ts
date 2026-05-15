import { useEffect, useCallback, useRef } from 'react';
import { NormalizedTrade } from '@/lib/volume/types';
import { VolumeFeedManager } from '@/lib/volume/VolumeFeedManager';
import { useVolumeStore } from '@/store/useVolumeStore';
import { MARKET_PAIRS } from '@/lib/pairs';

/** Live feed list: batch UI updates so rows are readable (charts use real-time ingest). */
const FEED_UI_FLUSH_MS = 1200;

// Global singleton instance
let globalVolumeManager: VolumeFeedManager | null = null;

export function useVolumeFeed() {
  const trades = useVolumeStore(s => s.trades);
  const stats = useVolumeStore(s => s.stats);
  const buckets = useVolumeStore(s => s.buckets);
  const isLive = useVolumeStore(s => s.isLive);
  const isLoading = useVolumeStore(s => s.isLoading);
  const exchangeVolumeMap = useVolumeStore(s => s.exchangeVolumeMap);
  const assetVolumeMap = useVolumeStore(s => s.assetVolumeMap);
  const exchangeSymbolVolumeMap = useVolumeStore(s => s.exchangeSymbolVolumeMap);
  const lastUpdate = useVolumeStore(s => s.lastUpdate);
  const exchangeStatuses = useVolumeStore(s => s.exchangeStatuses);
  const setExchangeStatus = useVolumeStore(s => s.setExchangeStatus);

  const ingestTrades = useVolumeStore(s => s.ingestTrades);
  const prependFeedTrades = useVolumeStore(s => s.prependFeedTrades);
  const setIsLoading = useVolumeStore(s => s.setIsLoading);
  const toggleLive = () => useVolumeStore.getState().setIsLive(!isLive);

  const aggPending = useRef<NormalizedTrade[]>([]);
  const feedPending = useRef<NormalizedTrade[]>([]);
  const aggRafId = useRef<number | null>(null);
  const feedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushAggregation = useCallback(() => {
    aggRafId.current = null;
    const batch = aggPending.current;
    aggPending.current = [];
    if (batch.length > 0) ingestTrades(batch);
  }, [ingestTrades]);

  const scheduleAggregationFlush = useCallback(() => {
    if (aggRafId.current != null) return;
    aggRafId.current = requestAnimationFrame(flushAggregation);
  }, [flushAggregation]);

  const flushFeedUI = useCallback(() => {
    const batch = [...feedPending.current];
    feedPending.current = [];
    if (batch.length > 0) prependFeedTrades(batch);
  }, [prependFeedTrades]);

  const handleNewTrade = useCallback(
    (trade: NormalizedTrade) => {
      aggPending.current.push(trade);
      feedPending.current.push(trade);
      scheduleAggregationFlush();
    },
    [scheduleAggregationFlush]
  );

  const handleStatusChange = useCallback(
    (exchange: string, status: string) => {
      setExchangeStatus(exchange, status);
    },
    [setExchangeStatus]
  );

  useEffect(() => {
    if (!isLive) {
      globalVolumeManager?.stop();
      globalVolumeManager = null;
      return;
    }

    if (globalVolumeManager) return;

    const symbols = MARKET_PAIRS.map(p => p.id);

    globalVolumeManager = new VolumeFeedManager(symbols, handleNewTrade, handleStatusChange);

    feedIntervalRef.current = setInterval(flushFeedUI, FEED_UI_FLUSH_MS);

    setIsLoading(true);
    globalVolumeManager.start();

    setTimeout(() => setIsLoading(false), 1500);

    return () => {
      if (aggRafId.current != null) {
        cancelAnimationFrame(aggRafId.current);
        aggRafId.current = null;
      }
      const aggBatch = [...aggPending.current];
      aggPending.current = [];
      if (aggBatch.length > 0) useVolumeStore.getState().ingestTrades(aggBatch);

      if (feedIntervalRef.current != null) {
        clearInterval(feedIntervalRef.current);
        feedIntervalRef.current = null;
      }
      const feedBatch = [...feedPending.current];
      feedPending.current = [];
      if (feedBatch.length > 0) useVolumeStore.getState().prependFeedTrades(feedBatch);
    };
  }, [isLive, handleNewTrade, handleStatusChange, setIsLoading, flushFeedUI]);

  return {
    trades,
    stats,
    buckets,
    isLive,
    isLoading,
    lastUpdate,
    exchangeStatuses,
    toggleLive,
    exchangeVolumeMap,
    assetVolumeMap,
    exchangeSymbolVolumeMap
  };
}
