import { VolumeAdapter } from '../volumeAdapters';
import { NormalizedTrade } from '../types';

export const bybitAdapter: VolumeAdapter = {
  id: 'BYBIT',
  name: 'Bybit',
  
  getWsUrl: (_symbols: string[]) => 'wss://stream.bybit.com/v5/public/linear',
  
  getSubscribeMsgs: (symbols: string[]) => {
    const args = symbols.map(s => `publicTrade.${s.split('/')[0]}USDT`);
    return [{
      op: 'subscribe',
      args: args
    }];
  },
  
  parseTrade: (msg: any): NormalizedTrade[] | null => {
    if (!msg.topic?.startsWith('publicTrade.') || !msg.data) return null;
    
    return msg.data.map((trade: any) => ({
      timestamp: trade.T,
      exchange: 'BYBIT',
      symbol: trade.s.replace('USDT', ''),
      marketType: 'perp',
      quoteAsset: 'USDT',
      price: parseFloat(trade.p),
      quantity: parseFloat(trade.v),
      notionalUSD: parseFloat(trade.p) * parseFloat(trade.v),
      tradeSide: trade.S.toLowerCase() === 'buy' ? 'buy' : 'sell',
      latency: Date.now() - trade.T,
      source: 'ws'
    }));
  },
  
  getPingMsg: () => ({ op: 'ping' }),
  pingIntervalMs: 20000
};
