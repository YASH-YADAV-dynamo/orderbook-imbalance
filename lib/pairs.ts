export interface MarketPair {
  id:          string;   // "BTC/USD" — primary key used throughout
  base:        string;   // "BTC"
  quote:       string;   // "USD"
  type:        'perp';
  displayName: string;   // "BTC / USD"
  searchTerms: string[];
}

export const MARKET_PAIRS: MarketPair[] = [
  { id: 'BTC/USD',   base: 'BTC',   quote: 'USD',  type: 'perp', displayName: 'BTC / USD',   searchTerms: ['btc', 'bitcoin'] },
  { id: 'ETH/USD',   base: 'ETH',   quote: 'USD',  type: 'perp', displayName: 'ETH / USD',   searchTerms: ['eth', 'ethereum'] },
  { id: 'SOL/USD',   base: 'SOL',   quote: 'USD',  type: 'perp', displayName: 'SOL / USD',   searchTerms: ['sol', 'solana'] },
  { id: 'AVAX/USD',  base: 'AVAX',  quote: 'USD',  type: 'perp', displayName: 'AVAX / USD',  searchTerms: ['avax', 'avalanche'] },
  { id: 'MATIC/USD', base: 'MATIC', quote: 'USD',  type: 'perp', displayName: 'MATIC / USD', searchTerms: ['matic', 'polygon'] },
  { id: 'SUI/USD',   base: 'SUI',   quote: 'USD',  type: 'perp', displayName: 'SUI / USD',   searchTerms: ['sui'] },
  { id: 'XRP/USD',   base: 'XRP',   quote: 'USD',  type: 'perp', displayName: 'XRP / USD',   searchTerms: ['xrp', 'ripple'] },
  { id: 'BNB/USD',   base: 'BNB',   quote: 'USD',  type: 'perp', displayName: 'BNB / USD',   searchTerms: ['bnb', 'binance'] },
  { id: 'HYPE/USD',  base: 'HYPE',  quote: 'USD',  type: 'perp', displayName: 'HYPE / USD',  searchTerms: ['hype'] },
];

const NATIVE_SYMBOLS: Record<string, Record<string, string>> = {
  pacifica: { 'BTC/USD': 'BTC', 'ETH/USD': 'ETH', 'SOL/USD': 'SOL', 'AVAX/USD': 'AVAX', 'MATIC/USD': 'MATIC' },
  '01':     { 'BTC/USD': 'BTCUSD', 'ETH/USD': 'ETHUSD', 'SOL/USD': 'SOLUSD' },
  hotstuff: {
    'BTC/USD': 'BTC-PERP', 'ETH/USD': 'ETH-PERP', 'SOL/USD': 'SOL-PERP',
    'XRP/USD': 'XRP-PERP', 'HYPE/USD': 'HYPE-PERP',
  },
  paradex:  { 'BTC/USD': 'BTC-USD-PERP', 'ETH/USD': 'ETH-USD-PERP', 'SOL/USD': 'SOL-USD-PERP' },
  hibachi:  {
    'BTC/USD': 'BTC/USDT-P', 'ETH/USD': 'ETH/USDT-P', 'SOL/USD': 'SOL/USDT-P',
    'SUI/USD': 'SUI/USDT-P', 'XRP/USD': 'XRP/USDT-P', 'BNB/USD': 'BNB/USDT-P',
    'HYPE/USD': 'HYPE/USDT-P',
  },
  hyperliquid: {
    'BTC/USD': 'BTC', 'ETH/USD': 'ETH', 'SOL/USD': 'SOL', 'AVAX/USD': 'AVAX',
    'MATIC/USD': 'MATIC', 'SUI/USD': 'SUI', 'XRP/USD': 'XRP', 'BNB/USD': 'BNB',
    'HYPE/USD': 'HYPE',
  },
  extended: {
    'BTC/USD': 'BTC-USD', 'ETH/USD': 'ETH-USD', 'SOL/USD': 'SOL-USD',
    'AVAX/USD': 'AVAX-USD',
  },
  aster: {
    'BTC/USD': 'btcusdt', 'ETH/USD': 'ethusdt', 'SOL/USD': 'solusdt',
    'AVAX/USD': 'avaxusdt', 'SUI/USD': 'suiusdt', 'XRP/USD': 'xrpusdt',
    'BNB/USD': 'bnbusdt', 'HYPE/USD': 'hypeusdt',
  },
};

export function resolvePair(pairId: string, adapterId: string): string {
  return NATIVE_SYMBOLS[adapterId]?.[pairId] ?? '';
}

export function getPairsForAdapter(adapterId: string): MarketPair[] {
  const map = NATIVE_SYMBOLS[adapterId];
  if (!map) return [];
  return MARKET_PAIRS.filter(p => p.id in map);
}

export function getAllPairs(): MarketPair[] {
  return MARKET_PAIRS;
}

export function getAdaptersForPair(pairId: string): string[] {
  return Object.entries(NATIVE_SYMBOLS)
    .filter(([, map]) => pairId in map)
    .map(([id]) => id);
}

export function searchPairs(query: string, pairs: MarketPair[]): MarketPair[] {
  const q = query.toLowerCase().trim();
  if (!q) return pairs;
  return pairs.filter(p =>
    p.id.toLowerCase().includes(q) ||
    p.base.toLowerCase().includes(q) ||
    p.quote.toLowerCase().includes(q) ||
    p.searchTerms.some(t => t.includes(q))
  );
}

export const MAJOR_BASES = new Set(['BTC', 'ETH', 'SOL']);
