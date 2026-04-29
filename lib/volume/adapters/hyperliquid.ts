import { VolumeAdapter } from '../volumeAdapters';
import { NormalizedTrade } from '../types';

export const hyperliquidAdapter: VolumeAdapter = {
  id: 'HYPERLIQUID',
  name: 'Hyperliquid',
  
  getWsUrl: (_symbols: string[]) => 'wss://api.hyperliquid.xyz/ws',
  
  getSubscribeMsgs: (symbols: string[]) => {
    return symbols.map(s => ({
      method: 'subscribe',
      subscription: { type: 'trades', coin: s.split('/')[0] }
    }));
  },
  
  parseTrade: (msg: any): NormalizedTrade[] | null => {
    if (msg.channel !== 'trades' || !msg.data) return null;
    
    return msg.data.map((trade: any) => {
      const price = parseFloat(trade.px);
      const quantity = parseFloat(trade.sz);
      
      return {
        timestamp: trade.time,
        exchange: 'HYPERLIQUID',
        symbol: trade.coin,
        marketType: 'perp',
        quoteAsset: 'USD',
        price: price,
        quantity: quantity,
        notionalUSD: price * quantity,
        tradeSide: trade.side === 'B' ? 'buy' : 'sell',
        latency: Date.now() - trade.time,
        source: 'ws'
      };
    });
  }
};
