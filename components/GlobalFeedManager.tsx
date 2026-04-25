'use client';

import { useEffect } from 'react';
import { useLiquidationsFeed } from '@/hooks/useLiquidationsFeed';

/**
 * GlobalFeedManager
 * This component runs the liquidations feed in the background.
 */
export function GlobalFeedManager() {
  // Call the hook to initialize hydration and WebSockets
  const { isLive, isHydrated, events } = useLiquidationsFeed();
  
  useEffect(() => {
    console.log('[GlobalFeedManager] Initialized', { 
      isLive, 
      isHydrated, 
      eventsCount: events.length 
    });
  }, [isLive, isHydrated, events.length]);
  
  return null;
}
