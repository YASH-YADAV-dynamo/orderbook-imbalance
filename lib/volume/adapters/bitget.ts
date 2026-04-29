import { VolumeAdapter } from '../volumeAdapters';
import { NormalizedTrade } from '../types';

export const bitgetAdapter: VolumeAdapter = {
  id: 'BITGET',
  name: 'Bitget',
  
  getWsUrl: (_symbols: string[]) => 'wss://ws.bitget.com/v2/ws/public',
  
  getSubscribeMsgs: (symbols: string[]) => {
    return [{
      op: 'subscribe',
      args: symbols.map(s => ({
        instType: 'USDT-FUTURES',
        channel: 'trade',
        instId: `${s.split('/')[0]}USDT`
      }))
    }];
  },
  
  parseTrade: (msg: any): NormalizedTrade[] | null => {
    if (msg.arg?.channel !== 'trade' || !msg.data) return null;
    
    return msg.data.map((trade: any) => {
      const price = parseFloat(trade.price || trade.p);
      const quantity = parseFloat(trade.size || trade.sz || trade.v);
      const ts = parseInt(trade.ts);
      
      return {
        timestamp: ts,
        exchange: 'BITGET',
        symbol: msg.arg.instId.replace('USDT', ''),
        marketType: 'perp',
        quoteAsset: 'USDT',
        price: price,
        quantity: quantity,
        notionalUSD: price * quantity,
        tradeSide: trade.side.toLowerCase() === 'buy' ? 'buy' : 'sell',
        latency: Date.now() - ts,
        source: 'ws'
      };
    });
  },
  
  getPingMsg: () => 'ping',
  pingIntervalMs: 30000
};
