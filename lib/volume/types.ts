export type TradeSide = 'buy' | 'sell' | 'unknown';
export type MarketType = 'spot' | 'perp' | 'future';

export interface NormalizedTrade {
  timestamp: number;     // unix ms
  exchange: string;      // "BINANCE", "BYBIT", etc.
  symbol: string;        // "BTC", "ETH", etc.
  marketType: MarketType;
  quoteAsset: string;    // "USDT", "USDC", etc.
  price: number;
  quantity: number;
  notionalUSD: number;
  tradeSide: TradeSide;
  latency?: number;      // ms from exchange timestamp to local arrival
  source: 'ws' | 'rest';
}

export interface VolumeBucket {
  time: number;          // start of bucket unix ms
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  exchangeVolumes: Record<string, number>; // exchange -> total volume
  symbolVolumes: Record<string, number>;   // symbol -> total volume
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d';

export interface VolumeStats {
  total24h: number;
  change24h: number;     // percentage
  dominantExchange: string;
  marketShare: Record<string, number>; // exchange -> percentage
  largestSpike: {
    exchange: string;
    amount: number;
    time: number;
  };
  concentrationScore: number; // 0-100
}
