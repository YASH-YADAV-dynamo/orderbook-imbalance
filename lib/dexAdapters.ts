import type { Level } from '@/types/orderbook';

// ── Result types ────────────────────────────────────────────────────────────

/**
 * Returned by processMessage().
 * 'direct' — adapter provides Level[] arrays directly (e.g. snapshot-only feeds).
 * 'map'    — adapter mutated bidMap/askMap; caller converts them to Level[].
 * null     — ignore this message.
 */
export type ProcessResult =
  | { mode: 'direct'; bids: Level[]; asks: Level[] }
  | { mode: 'map' }
  | null;

// ── Adapter interface ───────────────────────────────────────────────────────

export interface DexAdapter {
  /** Unique string key, matches ADAPTERS record key and public/exchanges/<id>.png */
  id:               string;
  name:             string;
  route:            string;
  color:            string;
  supportedSymbols: string[];

  /** Map display symbol (e.g. "BTC") → WS symbol. Return '' if unsupported. */
  toWsSymbol: (displaySymbol: string) => string;

  /** Full WebSocket URL; may embed the WS symbol for URL-based subscriptions. */
  getWsUrl: (wsSymbol: string) => string;

  /**
   * JSON message to send on open.
   * null = no subscribe message needed (symbol is embedded in the URL).
   * aggLevel is optional and only used by Pacifica.
   */
  buildSubscribeMsg: ((wsSymbol: string, aggLevel?: number) => unknown) | null;

  /** Optional ping to keep the connection alive. */
  pingMsg?:        unknown;
  pingIntervalMs?: number;

  /**
   * Parse one raw WebSocket message.
   * For 'map' mode: mutate bidMap/askMap in-place then return { mode:'map' }.
   * For 'direct' mode: return { mode:'direct', bids, asks } to bypass maps.
   * Return null to skip the message.
   */
  processMessage: (
    raw:    unknown,
    bidMap: Map<string, number>,
    askMap: Map<string, number>,
  ) => ProcessResult;
}

// ── Pacifica ─────────────────────────────────────────────────────────────────
// Full snapshot each tick — preserve `n` (order-count) by using 'direct' mode.

export const pacificaAdapter: DexAdapter = {
  id:               'pacifica',
  name:             'Pacifica',
  route:            '/pacifica',
  color:            '#00ff88',
  supportedSymbols: ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'],

  toWsSymbol: (s) => s,
  getWsUrl:   () => 'wss://ws.pacifica.fi/ws',

  buildSubscribeMsg: (sym, agg = 1) => ({
    method: 'subscribe',
    params: { source: 'book', symbol: sym, agg_level: agg },
  }),

  pingMsg:         { method: 'ping' },
  pingIntervalMs:  30_000,

  processMessage: (raw) => {
    const msg = raw as { channel?: string; data?: { l?: [Level[], Level[]] } };
    if (msg.channel !== 'book' || !msg.data?.l) return null;
    const [bids, asks] = msg.data.l;
    return { mode: 'direct', bids, asks };
  },
};

// ── 01 Exchange ───────────────────────────────────────────────────────────────
// Delta feed — symbol is embedded in the WebSocket URL; no subscribe message.

const ZO_MAP: Record<string, string> = {
  BTC: 'BTCUSD', ETH: 'ETHUSD', SOL: 'SOLUSD',
};

export const zoAdapter: DexAdapter = {
  id:               '01',
  name:             '01 Exchange',
  route:            '/01',
  color:            '#6366f1',
  supportedSymbols: ['BTC', 'ETH', 'SOL'],

  toWsSymbol:        (s) => ZO_MAP[s] ?? '',
  getWsUrl:          (sym) => `wss://zo-mainnet.n1.xyz/ws/deltas@${sym}`,
  buildSubscribeMsg: null,

  processMessage: (raw, bidMap, askMap) => {
    const msg = raw as {
      delta?: { bids: [number, number][]; asks: [number, number][] };
    };
    if (!msg.delta) return null;

    msg.delta.bids.forEach(([price, size]) => {
      const k = price.toString();
      size === 0 ? bidMap.delete(k) : bidMap.set(k, size);
    });
    msg.delta.asks.forEach(([price, size]) => {
      const k = price.toString();
      size === 0 ? askMap.delete(k) : askMap.set(k, size);
    });
    return { mode: 'map' };
  },
};

// ── HotStuff ──────────────────────────────────────────────────────────────────
// JSON-RPC subscribe + snapshot/delta feed.

const HOTSTUFF_MAP: Record<string, string> = {
  ETH: 'ETH-PERP', SOL: 'SOL-PERP',
};

interface HsLevel { price: number; size: number }

export const hotstuffAdapter: DexAdapter = {
  id:               'hotstuff',
  name:             'HotStuff',
  route:            '/hotstuff',
  color:            '#f97316',
  supportedSymbols: ['ETH', 'SOL'],

  toWsSymbol:        (s) => HOTSTUFF_MAP[s] ?? '',
  getWsUrl:          () => 'wss://api.hotstuff.trade/ws',

  buildSubscribeMsg: (sym) => ({
    jsonrpc: '2.0', id: '1', method: 'subscribe',
    params:  { channel: 'orderbook', symbol: sym },
  }),

  processMessage: (raw, bidMap, askMap) => {
    const msg = raw as {
      method?:  string;
      result?:  unknown;
      error?:   unknown;
      params?:  {
        data?: {
          update_type?: string;
          books?: { bids: HsLevel[]; asks: HsLevel[] };
          bids?:  HsLevel[];
          asks?:  HsLevel[];
        };
      };
    };

    // Skip confirmations / errors
    if (msg.result !== undefined || msg.error !== undefined) return null;
    if (msg.method !== 'event' || !msg.params?.data) return null;

    const data = msg.params.data;
    // Handle both nested (.books) and flat layouts
    const bidsArr: HsLevel[] = data.books?.bids ?? data.bids ?? [];
    const asksArr: HsLevel[] = data.books?.asks ?? data.asks ?? [];

    if (data.update_type === 'snapshot') {
      bidMap.clear();
      askMap.clear();
    }
    bidsArr.forEach(({ price, size }) => {
      const k = price.toString();
      size === 0 ? bidMap.delete(k) : bidMap.set(k, size);
    });
    asksArr.forEach(({ price, size }) => {
      const k = price.toString();
      size === 0 ? askMap.delete(k) : askMap.set(k, size);
    });
    return { mode: 'map' };
  },
};

// ── Paradex ───────────────────────────────────────────────────────────────────
// JSON-RPC snapshot feed (depth 15, 50 ms).
// update_type 's' = full snapshot (in inserts), 'd' = incremental delta.

const PARADEX_MAP: Record<string, string> = {
  BTC: 'BTC-USD-PERP', ETH: 'ETH-USD-PERP', SOL: 'SOL-USD-PERP',
};

interface ParadexLevel { price: string; side: 'BUY' | 'SELL'; size: string }

export const paradexAdapter: DexAdapter = {
  id:               'paradex',
  name:             'Paradex',
  route:            '/paradex',
  color:            '#a855f7',
  supportedSymbols: ['BTC', 'ETH', 'SOL'],

  toWsSymbol:       (s) => PARADEX_MAP[s] ?? '',
  getWsUrl:         () => 'wss://ws.api.prod.paradex.trade/v1?',

  buildSubscribeMsg: (sym) => ({
    id: 1, jsonrpc: '2.0', method: 'subscribe',
    params: { channel: `order_book.${sym}.snapshot@15@50ms` },
  }),

  processMessage: (raw, bidMap, askMap) => {
    const msg = raw as {
      method?:  string;
      result?:  unknown;
      error?:   unknown;
      params?:  {
        data?: {
          update_type?: 's' | 'd';
          inserts?: ParadexLevel[];
          updates?: ParadexLevel[];
          deletes?: ParadexLevel[];
        };
      };
    };

    if (msg.result !== undefined || msg.error !== undefined) return null;
    if (msg.method !== 'subscription' || !msg.params?.data) return null;

    const { update_type, inserts = [], updates = [], deletes = [] } = msg.params.data;

    if (update_type === 's') {
      bidMap.clear();
      askMap.clear();
      inserts.forEach(({ price, side, size }) => {
        const map = side === 'BUY' ? bidMap : askMap;
        const s = parseFloat(size);
        s > 0 ? map.set(price, s) : map.delete(price);
      });
    } else {
      [...inserts, ...updates].forEach(({ price, side, size }) => {
        const map = side === 'BUY' ? bidMap : askMap;
        const s = parseFloat(size);
        s > 0 ? map.set(price, s) : map.delete(price);
      });
      deletes.forEach(({ price, side }) => {
        (side === 'BUY' ? bidMap : askMap).delete(price);
      });
    }
    return { mode: 'map' };
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const ADAPTERS = {
  pacifica: pacificaAdapter,
  '01':     zoAdapter,
  hotstuff: hotstuffAdapter,
  paradex:  paradexAdapter,
} as const;

export type AdapterId = keyof typeof ADAPTERS;
