import { create } from 'zustand';
import { NormalizedTrade, VolumeStats, VolumeBucket } from '@/lib/volume/types';

interface VolumeState {
  trades: NormalizedTrade[];
  stats: VolumeStats;
  buckets: VolumeBucket[];
  exchangeVolumeMap: Record<string, number>;
  assetVolumeMap: Record<string, number>;
  exchangeSymbolVolumeMap: Record<string, number>;
  isLive: boolean;
  isLoading: boolean;
  lastUpdate: number | null;
  exchangeStatuses: Record<string, string>;

  // Actions
  addTrade: (trade: NormalizedTrade) => void;
  addTrades: (trades: NormalizedTrade[]) => void;
  setInitialData: (buckets: VolumeBucket[], stats: VolumeStats) => void;
  setIsLoading: (loading: boolean) => void;
  setIsLive: (live: boolean) => void;
  setExchangeStatus: (exchange: string, status: string) => void;
}

const INITIAL_STATS: VolumeStats = {
  total24h: 0,
  change24h: 0,
  dominantExchange: '---',
  marketShare: {},
  largestSpike: { exchange: '---', amount: 0, time: 0 },
  concentrationScore: 0
};

export const useVolumeStore = create<VolumeState>()((set, get) => ({
  trades: [],
  stats: INITIAL_STATS,
  buckets: [],
  exchangeVolumeMap: {},
  assetVolumeMap: {},
  exchangeSymbolVolumeMap: {},
  isLive: true,
  isLoading: true,
  lastUpdate: null,
  exchangeStatuses: {},

  addTrade: (trade) => {
    const state = get();
    const usd = trade.notionalUSD || 0;
    if (usd <= 0) return;

    const newExchangeVolumeMap = { ...state.exchangeVolumeMap };
    newExchangeVolumeMap[trade.exchange] = (newExchangeVolumeMap[trade.exchange] || 0) + usd;

    const newAssetVolumeMap = { ...state.assetVolumeMap };
    newAssetVolumeMap[trade.symbol] = (newAssetVolumeMap[trade.symbol] || 0) + usd;

    const newExSymMap = { ...state.exchangeSymbolVolumeMap };
    const exSymKey = `${trade.exchange}-${trade.symbol}`;
    newExSymMap[exSymKey] = (newExSymMap[exSymKey] || 0) + usd;

    // Update buckets
    const bucketTime = Math.floor(trade.timestamp / 60000) * 60000; // 1m buckets
    const newBuckets = [...state.buckets];
    let bucket = newBuckets.find(b => b.time === bucketTime);
    
    if (!bucket) {
      bucket = {
        time: bucketTime,
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        exchangeVolumes: {},
        symbolVolumes: {}
      };
      newBuckets.push(bucket);
      // Keep only last 1440 buckets (24h)
      if (newBuckets.length > 1440) newBuckets.shift();
    }

    bucket.totalVolume += usd;
    if (trade.tradeSide === 'buy') bucket.buyVolume += usd;
    if (trade.tradeSide === 'sell') bucket.sellVolume += usd;
    bucket.exchangeVolumes[trade.exchange] = (bucket.exchangeVolumes[trade.exchange] || 0) + usd;
    bucket.symbolVolumes[trade.symbol] = (bucket.symbolVolumes[trade.symbol] || 0) + usd;

    // Calculate dominant exchange
    let dominantExchange = state.stats.dominantExchange;
    let maxVol = newExchangeVolumeMap[dominantExchange] || 0;
    if (newExchangeVolumeMap[trade.exchange] > maxVol) {
      dominantExchange = trade.exchange;
    }

    // Market share
    const total24h = state.stats.total24h + usd;
    const marketShare: Record<string, number> = {};
    Object.entries(newExchangeVolumeMap).forEach(([ex, vol]) => {
      marketShare[ex] = (vol / total24h) * 100;
    });

    set({
      trades: [trade, ...state.trades].slice(0, 100), // Keep last 100 trades for live feed
      exchangeVolumeMap: newExchangeVolumeMap,
      assetVolumeMap: newAssetVolumeMap,
      exchangeSymbolVolumeMap: newExSymMap,
      buckets: newBuckets,
      stats: {
        ...state.stats,
        total24h,
        dominantExchange,
        marketShare,
        largestSpike: usd > state.stats.largestSpike.amount 
          ? { exchange: trade.exchange, amount: usd, time: trade.timestamp }
          : state.stats.largestSpike
      },
      lastUpdate: Date.now()
    });
  },

  addTrades: (newTrades) => {
    if (newTrades.length === 0) return;
    newTrades.forEach(t => get().addTrade(t));
  },

  setInitialData: (buckets, stats) => {
    // Rebuild maps from buckets if needed, or just set
    const exchangeVolumeMap: Record<string, number> = {};
    const assetVolumeMap: Record<string, number> = {};
    
    buckets.forEach(b => {
      Object.entries(b.exchangeVolumes).forEach(([ex, v]) => {
        exchangeVolumeMap[ex] = (exchangeVolumeMap[ex] || 0) + v;
      });
      Object.entries(b.symbolVolumes).forEach(([sym, v]) => {
        assetVolumeMap[sym] = (assetVolumeMap[sym] || 0) + v;
      });
    });

    set({
      buckets,
      stats,
      exchangeVolumeMap,
      assetVolumeMap,
      isLoading: false,
      lastUpdate: Date.now()
    });
  },

  setIsLoading: (isLoading) => set({ isLoading }),
  setIsLive: (isLive) => set({ isLive }),
  setExchangeStatus: (exchange, status) => set(s => ({
    exchangeStatuses: { ...s.exchangeStatuses, [exchange]: status }
  }))
}));
