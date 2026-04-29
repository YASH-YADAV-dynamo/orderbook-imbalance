import { useEffect, useCallback, useRef, useState } from 'react';
import { NormalizedTrade } from '@/lib/volume/types';
import { VolumeFeedManager } from '@/lib/volume/VolumeFeedManager';
import { useVolumeStore } from '@/store/useVolumeStore';
import { MARKET_PAIRS } from '@/lib/pairs';

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
  
  const addTrades = useVolumeStore(s => s.addTrades);
  const setIsLoading = useVolumeStore(s => s.setIsLoading);
  const toggleLive = () => useVolumeStore.getState().setIsLive(!isLive);

  // Batch processing
  const tradeBuffer = useRef<NormalizedTrade[]>([]);
  const batchTimer = useRef<NodeJS.Timeout | null>(null);

  const processBatch = useCallback(() => {
    if (tradeBuffer.current.length === 0) return;
    const batch = [...tradeBuffer.current];
    tradeBuffer.current = [];
    addTrades(batch);
  }, [addTrades]);

  const handleNewTrade = useCallback((trade: NormalizedTrade) => {
    tradeBuffer.current.push(trade);
    if (!batchTimer.current) {
      batchTimer.current = setInterval(processBatch, 200);
    }
  }, [processBatch]);

  const handleStatusChange = useCallback((exchange: string, status: string) => {
    setExchangeStatus(exchange, status);
  }, [setExchangeStatus]);

  useEffect(() => {
    if (!isLive) {
      globalVolumeManager?.stop();
      globalVolumeManager = null;
      return;
    }

    if (globalVolumeManager) return;

    const symbols = MARKET_PAIRS.map(p => p.id);

    globalVolumeManager = new VolumeFeedManager(
      symbols,
      handleNewTrade,
      handleStatusChange
    );

    setIsLoading(true);
    globalVolumeManager.start();

    // Small delay to show connecting state
    setTimeout(() => setIsLoading(false), 1500);

    return () => {
      if (batchTimer.current) clearInterval(batchTimer.current);
    };
  }, [isLive, handleNewTrade, handleStatusChange, setIsLoading]);

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
