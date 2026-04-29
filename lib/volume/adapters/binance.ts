import { VolumeAdapter } from '../volumeAdapters';
import { NormalizedTrade } from '../types';

export const binanceAdapter: VolumeAdapter = {
  id: 'BINANCE',
  name: 'Binance',
  
  getWsUrl: (symbols: string[]) => {
    // We connect to a raw stream first to establish connection
    return 'wss://fstream.binance.com/ws/btcusdt@aggTrade';
  },
  
  getSubscribeMsgs: (symbols: string[]) => {
    // We already connected to BTC in the URL, so filter out BTC and HYPE (not supported)
    const validSymbols = (symbols || [])
      .filter(s => !s.includes('HYPE') && !s.includes('BTC'));
      
    const params = validSymbols
      .map(s => `${s.split('/')[0].toLowerCase()}usdt@aggTrade`);
      
    if (params.length === 0) return [];
    
    return [{
      method: 'SUBSCRIBE',
      params: params,
      id: 1
    }];
  },
  
  parseTrade: (msg: any): NormalizedTrade[] | null => {
    // When using raw streams and standard SUBSCRIBE, the payload is NOT wrapped in a "data" object
    if (msg.e !== 'aggTrade') return null;
    
    const price = parseFloat(msg.p);
    const quantity = parseFloat(msg.q);
    
    return [{
      timestamp: msg.T, // Transaction time
      exchange: 'BINANCE',
      symbol: msg.s.replace('USDT', ''),
      marketType: 'perp',
      quoteAsset: 'USDT',
      price: price,
      quantity: quantity,
      notionalUSD: price * quantity,
      tradeSide: msg.m ? 'sell' : 'buy', // m: true means buyer was maker -> Sell
      latency: Date.now() - msg.T,
      source: 'ws'
    }];
  },
  
  getPingMsg: () => undefined,
  pingIntervalMs: undefined
};
