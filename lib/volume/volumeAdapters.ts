import { NormalizedTrade, MarketType } from './types';

export interface VolumeAdapter {
  id: string;           // "BINANCE", "BYBIT", etc.
  name: string;
  getWsUrl: (symbols: string[]) => string;
  getSubscribeMsgs: (symbols: string[]) => any[];
  parseTrade: (msg: any) => NormalizedTrade | NormalizedTrade[] | null;
  getPingMsg?: () => any;
  pingIntervalMs?: number;
}
