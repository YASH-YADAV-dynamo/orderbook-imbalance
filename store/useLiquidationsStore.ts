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

  setInitialData: (events, metrics) => {
    const assetVolumeMap: Record<string, number> = {};
    events.forEach(e => {
      assetVolumeMap[e.symbol] = (assetVolumeMap[e.symbol] || 0) + (e.notional_usd || 0);
    });

    set({ 
      events: events.slice(0, 500), 
      metrics,
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
