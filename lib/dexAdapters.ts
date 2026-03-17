import type { Level } from '@/types/orderbook';
import { resolvePair, getPairsForAdapter } from '@/lib/pairs';

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
  supportedSymbols: getPairsForAdapter('pacifica').map(p => p.id),

  toWsSymbol: (s) => resolvePair(s, 'pacifica'),
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

export const zoAdapter: DexAdapter = {
  id:               '01',
  name:             '01 Exchange',
  route:            '/01',
  color:            '#6366f1',
  supportedSymbols: getPairsForAdapter('01').map(p => p.id),

  toWsSymbol:        (s) => resolvePair(s, '01'),
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

interface HsLevel { price: number; size: number }

export const hotstuffAdapter: DexAdapter = {
  id:               'hotstuff',
  name:             'HotStuff',
  route:            '/hotstuff',
  color:            '#f97316',
  supportedSymbols: getPairsForAdapter('hotstuff').map(p => p.id),

  toWsSymbol:        (s) => resolvePair(s, 'hotstuff'),
  getWsUrl:          () => 'wss://api.hotstuff.trade/ws/',

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

interface ParadexLevel { price: string; side: 'BUY' | 'SELL'; size: string }

export const paradexAdapter: DexAdapter = {
  id:               'paradex',
  name:             'Paradex',
  route:            '/paradex',
  color:            '#a855f7',
  supportedSymbols: getPairsForAdapter('paradex').map(p => p.id),

  toWsSymbol:       (s) => resolvePair(s, 'paradex'),
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

// ── Hibachi ──────────────────────────────────────────────────────────────────
// WebSocket subscribe feed. Snapshot first, then incremental Updates.
// Levels: { price: string, quantity: string }

interface HibachiLevel { price: string; quantity: string }

export const hibachiAdapter: DexAdapter = {
  id:               'hibachi',
  name:             'Hibachi',
  route:            '/hibachi',
  color:            '#ef4444',
  supportedSymbols: getPairsForAdapter('hibachi').map(p => p.id),

  toWsSymbol:       (s) => resolvePair(s, 'hibachi'),
  getWsUrl:         () => 'wss://data-api.hibachi.xyz/ws/market',

  buildSubscribeMsg: (sym) => ({
    method: 'subscribe',
    parameters: {
      subscriptions: [{ symbol: sym, topic: 'orderbook' }],
    },
  }),

  processMessage: (raw, bidMap, askMap) => {
    const msg = raw as {
      topic?:       string;
      messageType?: 'Snapshot' | 'Update';
      data?: {
        bid?: { levels?: HibachiLevel[] };
        ask?: { levels?: HibachiLevel[] };
      };
    };

    if (msg.topic !== 'orderbook' || !msg.data) return null;

    if (msg.messageType === 'Snapshot') {
      bidMap.clear();
      askMap.clear();
    }

    const applyLevels = (levels: HibachiLevel[] | undefined, map: Map<string, number>) => {
      if (!levels) return;
      levels.forEach(({ price, quantity }) => {
        const q = parseFloat(quantity);
        q === 0 ? map.delete(price) : map.set(price, q);
      });
    };

    applyLevels(msg.data.bid?.levels, bidMap);
    applyLevels(msg.data.ask?.levels, askMap);

    return { mode: 'map' };
  },
};

// ── Hyperliquid ──────────────────────────────────────────────────────────────
// Full L2 book snapshots pushed every ~0.5 s.
// levels: [bids[], asks[]], each { px: string, sz: string, n: number }

export const hyperliquidAdapter: DexAdapter = {
  id:               'hyperliquid',
  name:             'Hyperliquid',
  route:            '/hyperliquid',
  color:            '#84cc16',
  supportedSymbols: getPairsForAdapter('hyperliquid').map(p => p.id),

  toWsSymbol:       (s) => resolvePair(s, 'hyperliquid'),
  getWsUrl:         () => 'wss://api.hyperliquid.xyz/ws',

  buildSubscribeMsg: (sym) => ({
    method: 'subscribe',
    subscription: { type: 'l2Book', coin: sym },
  }),

  processMessage: (raw) => {
    const msg = raw as {
      channel?: string;
      data?: {
        coin?: string;
        time?: number;
        levels?: [Array<{ px: string; sz: string; n: number }>, Array<{ px: string; sz: string; n: number }>];
      };
    };

    if (msg.channel !== 'l2Book' || !msg.data?.levels) return null;

    const [rawBids, rawAsks] = msg.data.levels;
    const bids: Level[] = rawBids.map(l => ({ p: l.px, a: l.sz, n: l.n }));
    const asks: Level[] = rawAsks.map(l => ({ p: l.px, a: l.sz, n: l.n }));

    return { mode: 'direct', bids, asks };
  },
};

// ── Extended ─────────────────────────────────────────────────────────────────
// Snapshot + delta feed. Symbol embedded in URL — no subscribe message.
// Snapshot levels have { p, q } where q = absolute size.
// Delta levels have { p, q, c } where q = change, c = new absolute size.

interface ExtendedLevel { p: string; q: string; c?: string }

export const extendedAdapter: DexAdapter = {
  id:               'extended',
  name:             'Extended',
  route:            '/extended',
  color:            '#06b6d4',
  supportedSymbols: getPairsForAdapter('extended').map(p => p.id),

  toWsSymbol:        (s) => resolvePair(s, 'extended'),
  getWsUrl:          (sym) =>
    `wss://api.starknet.extended.exchange/stream.extended.exchange/v1/orderbooks/${sym}`,
  buildSubscribeMsg: null,

  processMessage: (raw, bidMap, askMap) => {
    const msg = raw as {
      type?: 'SNAPSHOT' | 'DELTA';
      data?: {
        t?: string;
        m?: string;
        b?: ExtendedLevel[];
        a?: ExtendedLevel[];
      };
    };

    if (!msg.data || !msg.type) return null;
    const isSnapshot = msg.type === 'SNAPSHOT';

    if (isSnapshot) {
      bidMap.clear();
      askMap.clear();
    }

    const apply = (levels: ExtendedLevel[] | undefined, map: Map<string, number>) => {
      if (!levels) return;
      levels.forEach((lv) => {
        const size = parseFloat(isSnapshot ? lv.q : (lv.c ?? lv.q));
        size === 0 ? map.delete(lv.p) : map.set(lv.p, size);
      });
    };

    apply(msg.data.b, bidMap);
    apply(msg.data.a, askMap);

    return { mode: 'map' };
  },
};

// ── Aster ────────────────────────────────────────────────────────────────────
// Binance-compatible partial depth stream. Symbol embedded in URL.
// Levels are [price, quantity] tuples. Full snapshot each push.

export const asterAdapter: DexAdapter = {
  id:               'aster',
  name:             'Aster',
  route:            '/aster',
  color:            '#f59e0b',
  supportedSymbols: getPairsForAdapter('aster').map(p => p.id),

  toWsSymbol:        (s) => resolvePair(s, 'aster'),
  getWsUrl:          (sym) => `wss://fstream.asterdex.com/ws/${sym}@depth20@100ms`,
  buildSubscribeMsg: null,

  processMessage: (raw) => {
    const msg = raw as {
      e?: string;
      b?: [string, string][];
      a?: [string, string][];
    };

    if (msg.e !== 'depthUpdate' || !msg.b || !msg.a) return null;

    const bids: Level[] = msg.b.map(([p, a]) => ({ p, a, n: 0 }));
    const asks: Level[] = msg.a.map(([p, a]) => ({ p, a, n: 0 }));

    return { mode: 'direct', bids, asks };
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const ADAPTERS = {
  pacifica:     pacificaAdapter,
  '01':         zoAdapter,
  hotstuff:     hotstuffAdapter,
  paradex:      paradexAdapter,
  hibachi:      hibachiAdapter,
  hyperliquid:  hyperliquidAdapter,
  extended:     extendedAdapter,
  aster:        asterAdapter,
} as const;

export type AdapterId = keyof typeof ADAPTERS;
