import { VolumeAdapter } from '../volumeAdapters';
import { NormalizedTrade } from '../types';

export const okxAdapter: VolumeAdapter = {
  id: 'OKX',
  name: 'OKX',
  
  getWsUrl: (_symbols: string[]) => 'wss://ws.okx.com:8443/ws/v5/public',
  
  getSubscribeMsgs: (symbols: string[]) => {
    return [{
      op: 'subscribe',
      args: symbols.map(s => ({
        channel: 'trades',
        instId: `${s.split('/')[0]}-USDT-SWAP`
      }))
    }];
  },
  
  parseTrade: (msg: any): NormalizedTrade[] | null => {
    if (msg.channel !== 'trades' && msg.arg?.channel !== 'trades') return null;
    if (!msg.data || !Array.isArray(msg.data)) return null;
    
    return msg.data.map((trade: any) => {
      const price = parseFloat(trade.px);
      let quantity = parseFloat(trade.sz);
      const ts = parseInt(trade.ts);
      
      // OKX sz is in contracts. We need to convert to base asset quantity.
      // Contract values: BTC=0.01, ETH=0.1, others vary.
      if (trade.instId.startsWith('BTC')) quantity *= 0.01;
      else if (trade.instId.startsWith('ETH')) quantity *= 0.1;
      else if (trade.instId.startsWith('SOL')) quantity *= 1; 
      // For others, we assume 1 for now or could add more mappings.
      
      return {
        timestamp: ts,
        exchange: 'OKX',
        symbol: trade.instId.replace('-USDT-SWAP', '').replace('-', '/'),
        marketType: 'perp', // Assuming perp for now based on SkewX focus
        quoteAsset: 'USDT',
        price: price,
        quantity: quantity,
        notionalUSD: price * quantity,
        tradeSide: trade.side === 'buy' ? 'buy' : 'sell',
        latency: Date.now() - ts,
        source: 'ws'
      };
    });
  },
  
  getPingMsg: () => 'ping', // OKX just expects "ping" as a string or a JSON
  pingIntervalMs: 25000
};
