import { create } from 'zustand';
import { LiquidationEvent } from '@/lib/liquidations/types';

export interface LiquidationsFeedMetrics {
  totalVolume: number;
  totalLongUsd: number;
  totalShortUsd: number;
  longRatio: number;
  shortRatio: number;
  avgSize: number;
  largestSingle: number;
  topAsset: string;
  eventCount24h: number;
  whaleCount: number;
}

export interface LiquidationsChartData {
  time: number;
  long: number;
  short: number;
}

interface LiquidationsState {
  events: LiquidationEvent[];
  metrics: LiquidationsFeedMetrics;
  chartData: LiquidationsChartData[];
  isLive: boolean;
  isLoading: boolean;
  isHydrated: boolean; // New flag
  lastUpdate: number | null;
  assetVolumeMap: Record<string, number>;

  // Actions
  addEvent: (event: LiquidationEvent) => void;
  addEvents: (events: LiquidationEvent[]) => void;
  setInitialData: (events: LiquidationEvent[], metrics: LiquidationsFeedMetrics) => void;
  setIsLoading: (loading: boolean) => void;
  setIsLive: (live: boolean) => void;
  setIsHydrated: (hydrated: boolean) => void;
  toggleLive: () => void;
}

const WHALE_THRESHOLD = 500000;

const INITIAL_METRICS: LiquidationsFeedMetrics = {
  totalVolume: 0,
  totalLongUsd: 0,
  totalShortUsd: 0,
  longRatio: 0,
  shortRatio: 0,
  avgSize: 0,
  largestSingle: 0,
  topAsset: '---',
  eventCount24h: 0,
  whaleCount: 0
};

export const useLiquidationsStore = create<LiquidationsState>()((set, get) => ({
  events: [],
  metrics: INITIAL_METRICS,
  chartData: [],
  isLive: true,
  isLoading: true,
  isHydrated: false,
  lastUpdate: null,
  assetVolumeMap: {},

  addEvent: (event) => {
    const state = get();
    const usd = Number(event.notional_usd) || 0;
    if (usd <= 0) return;

    const isLong = event.side === 'long';
    const isWhale = usd >= WHALE_THRESHOLD;
    
    const newAssetVolumeMap = { ...state.assetVolumeMap };
    newAssetVolumeMap[event.symbol] = (newAssetVolumeMap[event.symbol] || 0) + usd;
    
    let topAsset = state.metrics.topAsset;
    let maxVol = newAssetVolumeMap[state.metrics.topAsset] || 0;
    if (newAssetVolumeMap[event.symbol] > maxVol) {
      topAsset = event.symbol;
    }

    const newTotalLong = isLong ? state.metrics.totalLongUsd + usd : state.metrics.totalLongUsd;
    const newTotalShort = !isLong ? state.metrics.totalShortUsd + usd : state.metrics.totalShortUsd;
    const newTotalVolume = newTotalLong + newTotalShort;

    set({
      events: [event, ...state.events].slice(0, 500), // Increased buffer
      metrics: {
        ...state.metrics,
        totalVolume: newTotalVolume,
        totalLongUsd: newTotalLong,
        totalShortUsd: newTotalShort,
        longRatio: newTotalVolume > 0 ? newTotalLong / newTotalVolume : 0,
        shortRatio: newTotalVolume > 0 ? newTotalShort / newTotalVolume : 0,
        avgSize: (state.metrics.avgSize * state.metrics.eventCount24h + usd) / (state.metrics.eventCount24h + 1),
        largestSingle: Math.max(state.metrics.largestSingle, usd),
        topAsset: topAsset,
        eventCount24h: state.metrics.eventCount24h + 1,
        whaleCount: state.metrics.whaleCount + (isWhale ? 1 : 0),
      },
      assetVolumeMap: newAssetVolumeMap,
      lastUpdate: Date.now()
    });
  },

  addEvents: (newEvents: LiquidationEvent[]) => {
    if (newEvents.length === 0) return;
    const state = get();
    
    let currentTotalLong = state.metrics.totalLongUsd;
    let currentTotalShort = state.metrics.totalShortUsd;
    let currentEventCount = state.metrics.eventCount24h;
    let currentLargestSingle = state.metrics.largestSingle;
    let currentWhaleCount = state.metrics.whaleCount;
    let currentTopAsset = state.metrics.topAsset;
    
    const newAssetVolumeMap = { ...state.assetVolumeMap };

    newEvents.forEach(event => {
      const usd = Number(event.notional_usd) || 0;
      if (usd <= 0) return;

      const isLong = event.side === 'long';
      const isWhale = usd >= WHALE_THRESHOLD;
      
      newAssetVolumeMap[event.symbol] = (newAssetVolumeMap[event.symbol] || 0) + usd;
      
      if (newAssetVolumeMap[event.symbol] > (newAssetVolumeMap[currentTopAsset] || 0)) {
        currentTopAsset = event.symbol;
      }

      if (isLong) currentTotalLong += usd; else currentTotalShort += usd;
      currentEventCount += 1;
      if (usd > currentLargestSingle) currentLargestSingle = usd;
      if (isWhale) currentWhaleCount += 1;
    });

    const newTotalVolume = currentTotalLong + currentTotalShort;

    set({
      events: [...newEvents, ...state.events].slice(0, 500),
      metrics: {
        ...state.metrics,
        totalVolume: newTotalVolume,
        totalLongUsd: currentTotalLong,
        totalShortUsd: currentTotalShort,
        longRatio: newTotalVolume > 0 ? currentTotalLong / newTotalVolume : 0,
        shortRatio: newTotalVolume > 0 ? currentTotalShort / newTotalVolume : 0,
        avgSize: currentEventCount > 0 ? newTotalVolume / currentEventCount : 0,
        largestSingle: currentLargestSingle,
        topAsset: currentTopAsset,
        eventCount24h: currentEventCount,
        whaleCount: currentWhaleCount,
      },
      assetVolumeMap: newAssetVolumeMap,
      lastUpdate: Date.now()
    });
  },

  setInitialData: (historicalEvents, metrics) => {
    const state = get();
    
    // Merge historical with any live events that arrived while loading
    // Deduplicate by raw_order_id
    const existingIds = new Set(state.events.map(e => e.raw_order_id));
    const uniqueHistorical = historicalEvents.filter(e => !existingIds.has(e.raw_order_id));
    
    const combinedEvents = [...state.events, ...uniqueHistorical]
      .sort((a, b) => b.timestamp_ms - a.timestamp_ms)
      .slice(0, 500);

    const assetVolumeMap: Record<string, number> = {};
    combinedEvents.forEach(e => {
      assetVolumeMap[e.symbol] = (assetVolumeMap[e.symbol] || 0) + (e.notional_usd || 0);
    });

    // Re-calculate metrics for the combined set
    let vol = 0;
    let long = 0;
    let short = 0;
    let maxSingle = 0;
    let whaleCount = 0;
    let topAsset = '---';
    let maxAssetVol = 0;

    combinedEvents.forEach(e => {
      const usd = e.notional_usd || 0;
      vol += usd;
      if (e.side === 'long') long += usd; else short += usd;
      if (usd > maxSingle) maxSingle = usd;
      if (usd >= WHALE_THRESHOLD) whaleCount++;
    });

    // Find top asset from map
    Object.entries(assetVolumeMap).forEach(([sym, v]) => {
      if (v > maxAssetVol) {
        maxAssetVol = v;
        topAsset = sym;
      }
    });

    set({ 
      events: combinedEvents, 
      metrics: {
        totalVolume: vol,
        totalLongUsd: long,
        totalShortUsd: short,
        longRatio: vol > 0 ? long / vol : 0,
        shortRatio: vol > 0 ? short / vol : 0,
        avgSize: combinedEvents.length > 0 ? vol / combinedEvents.length : 0,
        largestSingle: maxSingle,
        topAsset,
        eventCount24h: combinedEvents.length,
        whaleCount,
      },
      assetVolumeMap,
      isLoading: false,
      isHydrated: true,
      lastUpdate: Date.now()
    });
  },

  setIsLoading: (isLoading) => set({ isLoading }),
  setIsLive: (isLive) => set({ isLive }),
  setIsHydrated: (isHydrated) => set({ isHydrated }),
  toggleLive: () => set(state => ({ isLive: !state.isLive }))
}));
