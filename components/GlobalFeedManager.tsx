'use client';

import { useEffect } from 'react';
import { useLiquidationsFeed } from '@/hooks/useLiquidationsFeed';
import { useVolumeFeed } from '@/hooks/useVolumeFeed';

/**
 * GlobalFeedManager
 * Runs long-lived client feeds app-wide (not tied to a single route).
 * Liquidations + aggregated volume WS start here so data is already flowing
 * before you open /volume (session buckets / “24h” style totals accumulate).
 */
export function GlobalFeedManager() {
  const { isLive, isHydrated, events } = useLiquidationsFeed();
  useVolumeFeed();
  
  useEffect(() => {
    console.log('[GlobalFeedManager] Initialized', { 
      isLive, 
      isHydrated, 
      eventsCount: events.length 
    });
  }, [isLive, isHydrated, events.length]);
  
  return null;
}
