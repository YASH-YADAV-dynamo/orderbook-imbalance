import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  /** Buckets / maps / stats only — real-time aggregation for charts */
  ingestTrades: (trades: NormalizedTrade[]) => void;
  /** Live feed panel only — call on a slow timer with batched rows */
  prependFeedTrades: (trades: NormalizedTrade[]) => void;
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

const DAY_MS = 24 * 60 * 60 * 1000;

function pruneBucketsTo24h(buckets: VolumeBucket[], nowMs: number): VolumeBucket[] {
  const cutoff = nowMs - DAY_MS;
  return buckets.filter(b => b.time >= cutoff);
}

function rebuildMapsAndStatsFromBuckets(buckets: VolumeBucket[], prevStats: VolumeStats): {
  exchangeVolumeMap: Record<string, number>;
  assetVolumeMap: Record<string, number>;
  exchangeSymbolVolumeMap: Record<string, number>;
  stats: VolumeStats;
} {
  const exchangeVolumeMap: Record<string, number> = {};
  const assetVolumeMap: Record<string, number> = {};
  const exchangeSymbolVolumeMap: Record<string, number> = {};

  let total24h = 0;
  for (const b of buckets) {
    total24h += b.totalVolume || 0;
    for (const [ex, v] of Object.entries(b.exchangeVolumes || {})) {
      exchangeVolumeMap[ex] = (exchangeVolumeMap[ex] || 0) + (v || 0);
    }
    for (const [sym, v] of Object.entries(b.symbolVolumes || {})) {
      assetVolumeMap[sym] = (assetVolumeMap[sym] || 0) + (v || 0);
    }
  }

  const marketShare: Record<string, number> = {};
  let dominantExchange = '---';
  let maxExVol = 0;
  if (total24h > 0) {
    for (const [ex, vol] of Object.entries(exchangeVolumeMap)) {
      marketShare[ex] = (vol / total24h) * 100;
      if (vol > maxExVol) {
        maxExVol = vol;
        dominantExchange = ex;
      }
    }
  }

  return {
    exchangeVolumeMap,
    assetVolumeMap,
    exchangeSymbolVolumeMap,
    stats: {
      ...prevStats,
      total24h,
      dominantExchange,
      marketShare,
    },
  };
}

export const useVolumeStore = create<VolumeState>()(
  persist(
    (set, get) => ({
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

      ingestTrades: (newTrades) => {
        if (newTrades.length === 0) return;
        const state = get();

        let buckets = [...state.buckets];
        let largestSpike = { ...state.stats.largestSpike };

        for (const trade of newTrades) {
          const usd = trade.notionalUSD || 0;
          if (usd <= 0) continue;

          const bucketTime = Math.floor(trade.timestamp / 60000) * 60000;
          let bucket = buckets.find(b => b.time === bucketTime);

          if (!bucket) {
            bucket = {
              time: bucketTime,
              totalVolume: 0,
              buyVolume: 0,
              sellVolume: 0,
              exchangeVolumes: {},
              symbolVolumes: {},
            };
            buckets.push(bucket);
          }

          bucket.totalVolume += usd;
          if (trade.tradeSide === 'buy') bucket.buyVolume += usd;
          if (trade.tradeSide === 'sell') bucket.sellVolume += usd;
          bucket.exchangeVolumes[trade.exchange] = (bucket.exchangeVolumes[trade.exchange] || 0) + usd;
          bucket.symbolVolumes[trade.symbol] = (bucket.symbolVolumes[trade.symbol] || 0) + usd;

          if (usd > largestSpike.amount) {
            largestSpike = { exchange: trade.exchange, amount: usd, time: trade.timestamp };
          }
        }

        // Keep buckets within the last 24h window (rolling) and sorted.
        const nowMs = Date.now();
        buckets = pruneBucketsTo24h(buckets, nowMs).sort((a, b) => a.time - b.time).slice(-1440);

        const rebuilt = rebuildMapsAndStatsFromBuckets(buckets, state.stats);

        set({
          buckets,
          exchangeVolumeMap: rebuilt.exchangeVolumeMap,
          assetVolumeMap: rebuilt.assetVolumeMap,
          exchangeSymbolVolumeMap: rebuilt.exchangeSymbolVolumeMap,
          stats: { ...rebuilt.stats, largestSpike },
          lastUpdate: nowMs,
        });
      },

      prependFeedTrades: (batch) => {
        if (batch.length === 0) return;
        const state = get();
        const newestFirst = [...batch].reverse();
        set({
          trades: [...newestFirst, ...state.trades].slice(0, 100)
        });
      },

      addTrade: (trade) => {
        get().ingestTrades([trade]);
        get().prependFeedTrades([trade]);
      },

      addTrades: (newTrades) => {
        if (newTrades.length === 0) return;
        get().ingestTrades(newTrades);
        get().prependFeedTrades(newTrades);
      },

      setInitialData: (buckets, stats) => {
        const nowMs = Date.now();
        const pruned = pruneBucketsTo24h(buckets, nowMs).sort((a, b) => a.time - b.time).slice(-1440);
        const rebuilt = rebuildMapsAndStatsFromBuckets(pruned, stats);

        set({
          buckets: pruned,
          stats: rebuilt.stats,
          exchangeVolumeMap: rebuilt.exchangeVolumeMap,
          assetVolumeMap: rebuilt.assetVolumeMap,
          exchangeSymbolVolumeMap: rebuilt.exchangeSymbolVolumeMap,
          isLoading: false,
          lastUpdate: nowMs,
        });
      },

      setIsLoading: (isLoading) => set({ isLoading }),
      setIsLive: (isLive) => set({ isLive }),
      setExchangeStatus: (exchange, status) => set(s => ({
        exchangeStatuses: { ...s.exchangeStatuses, [exchange]: status }
      }))
    }),
    {
      name: 'obi-volume',
      version: 1,
      partialize: (s) => ({
        buckets: s.buckets,
        stats: s.stats,
        exchangeVolumeMap: s.exchangeVolumeMap,
        assetVolumeMap: s.assetVolumeMap,
        exchangeSymbolVolumeMap: s.exchangeSymbolVolumeMap,
        isLive: s.isLive,
        lastUpdate: s.lastUpdate,
      }),
      onRehydrateStorage: () => (state) => {
        // Prune persisted buckets to a rolling 24h window on startup.
        if (!state) return;
        const nowMs = Date.now();
        const pruned = pruneBucketsTo24h(state.buckets || [], nowMs).sort((a, b) => a.time - b.time).slice(-1440);
        const rebuilt = rebuildMapsAndStatsFromBuckets(pruned, state.stats || INITIAL_STATS);
        state.buckets = pruned;
        state.exchangeVolumeMap = rebuilt.exchangeVolumeMap;
        state.assetVolumeMap = rebuilt.assetVolumeMap;
        state.exchangeSymbolVolumeMap = rebuilt.exchangeSymbolVolumeMap;
        state.stats = rebuilt.stats;
        state.trades = []; // never persist the live feed rows
      },
    },
  ),
);
