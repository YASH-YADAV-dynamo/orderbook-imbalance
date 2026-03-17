'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DEFAULT_FORMULA_PARAMS,
  FormulaParams,
  FormulaType,
  HistoryPoint,
  Level,
  OrderbookState,
} from '@/types/orderbook';
import { computeImbalance } from '@/lib/formulas';

// HotStuff — Mainnet only
const WS_URL = 'wss://api.hotstuff.trade/ws';

const HISTORY_DURATION_MS = 60_000;
const RECONNECT_DELAY_MS  = 3_000;
const MAX_RETRIES         = 5;

interface BookLevel {
  price: number;
  size:  number;
}

// Books payload — can arrive either nested under `.books` or flat at `.data` level
interface BooksPayload {
  instrument_name?: string;
  bids:             BookLevel[];
  asks:             BookLevel[];
  sequence_number?: number;
  timestamp?:       number;
}

interface HotstuffData {
  update_type: 'snapshot' | 'delta';
  books?:      BooksPayload;   // docs say it's nested here …
  // … but some servers send it flat:
  bids?:       BookLevel[];
  asks?:       BookLevel[];
  instrument_name?: string;
  sequence_number?: number;
  timestamp?:       number;
}

interface HotstuffMessage {
  jsonrpc?: string;
  method?:  string;
  id?:      string | number;
  result?:  unknown;
  error?:   { code: number; message: string };
  params?:  {
    channel: string;
    data:    HotstuffData;
  };
}

const defaultState = (symbol: string): OrderbookState => ({
  bids: [], asks: [],
  symbol,
  timestamp:    0,
  imbalance:    0,
  totalBidVol:  0,
  totalAskVol:  0,
  spread:       0,
  connected:    false,
  connecting:   false,
  error:        null,
});

/**
 * WebSocket hook for HotStuff mainnet orderbook feed.
 * symbol — perp-format symbol, e.g. "BTC-PERP". Pass "" to skip.
 */
export function useHotstuffOrderbook(
  symbol:  string,
  formula: FormulaType,
  params:  FormulaParams,
) {
  const [state,   setState]   = useState<OrderbookState>(() => defaultState(symbol));
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const wsRef         = useRef<WebSocket | null>(null);
  const retryRef      = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bidMapRef     = useRef(new Map<number, number>());
  const askMapRef     = useRef(new Map<number, number>());
  const prevBidsRef   = useRef<Level[]>([]);
  const prevAsksRef   = useRef<Level[]>([]);

  // Keep stable refs so closures always read the latest values
  const formulaRef = useRef(formula);
  const paramsRef  = useRef(params);
  const symbolRef  = useRef(symbol);
  formulaRef.current = formula;
  paramsRef.current  = params;
  symbolRef.current  = symbol;

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Use a ref to always call the latest connect — avoids stale closure in onclose
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    const sym = symbolRef.current;
    if (!sym) return;
    disconnect();
    bidMapRef.current.clear();
    askMapRef.current.clear();
    prevBidsRef.current = [];
    prevAsksRef.current = [];
    setState(s => ({ ...s, connecting: true, connected: false, error: null }));

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.error('[HotStuff] Failed to create WebSocket:', err);
      setState(s => ({ ...s, connecting: false, error: 'Failed to connect' }));
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setState(s => ({ ...s, connected: true, connecting: false, error: null }));
      const sub = JSON.stringify({
        jsonrpc: '2.0',
        id:      '1',
        method:  'subscribe',
        params:  { channel: 'orderbook', symbol: sym },
      });
      console.debug('[HotStuff] Connected, subscribing to', sym);
      ws.send(sub);
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: HotstuffMessage;
      try {
        msg = JSON.parse(event.data as string) as HotstuffMessage;
      } catch {
        return;
      }

      // Subscription confirmation / error responses
      if (msg.error) {
        console.error('[HotStuff] API error:', msg.error);
        setState(s => ({ ...s, error: `API: ${msg.error!.message}` }));
        return;
      }
      if (msg.result !== undefined) {
        console.debug('[HotStuff] Subscription confirmed:', msg.result);
        return;
      }

      // Regular event messages
      if (msg.method !== 'event' || !msg.params?.data) return;

      const data = msg.params.data;

      // Resolve bids/asks — handle both nested (.books) and flat layouts
      const books: BooksPayload | null =
        data.books ?? (data.bids && data.asks ? { bids: data.bids, asks: data.asks, timestamp: data.timestamp } : null);

      if (!books) {
        console.warn('[HotStuff] Unrecognised data shape:', data);
        return;
      }

      if (data.update_type === 'snapshot') {
        bidMapRef.current.clear();
        askMapRef.current.clear();
        books.bids.forEach(({ price, size }) => {
          if (size > 0) bidMapRef.current.set(price, size);
        });
        books.asks.forEach(({ price, size }) => {
          if (size > 0) askMapRef.current.set(price, size);
        });
      } else {
        books.bids.forEach(({ price, size }) => {
          size === 0 ? bidMapRef.current.delete(price) : bidMapRef.current.set(price, size);
        });
        books.asks.forEach(({ price, size }) => {
          size === 0 ? askMapRef.current.delete(price) : askMapRef.current.set(price, size);
        });
      }

      const bids: Level[] = [...bidMapRef.current.entries()]
        .sort((a, b) => b[0] - a[0])
        .slice(0, 50)
        .map(([price, size]) => ({ p: price.toString(), a: size.toString(), n: 0 }));

      const asks: Level[] = [...askMapRef.current.entries()]
        .sort((a, b) => a[0] - b[0])
        .slice(0, 50)
        .map(([price, size]) => ({ p: price.toString(), a: size.toString(), n: 0 }));

      const imbalance = computeImbalance(
        formulaRef.current,
        paramsRef.current,
        bids, asks,
        prevBidsRef.current,
        prevAsksRef.current,
      );

      prevBidsRef.current = bids;
      prevAsksRef.current = asks;

      const totalBidVol = bids.reduce((sum, l) => sum + parseFloat(l.a), 0);
      const totalAskVol = asks.reduce((sum, l) => sum + parseFloat(l.a), 0);
      const bestBid = bids[0] ? parseFloat(bids[0].p) : 0;
      const bestAsk = asks[0] ? parseFloat(asks[0].p) : 0;
      const spread  = bestBid && bestAsk ? Math.max(0, bestAsk - bestBid) : 0;
      const now     = books.timestamp ?? Date.now();

      setState({
        bids, asks,
        symbol: sym,
        timestamp:   now,
        imbalance,
        totalBidVol,
        totalAskVol,
        spread,
        connected:   true,
        connecting:  false,
        error:       null,
      });

      setHistory(prev => {
        const t      = Date.now();
        const cutoff = t - HISTORY_DURATION_MS;
        const next   = prev.filter(p => p.t >= cutoff);
        next.push({ t, imbalance, bidVol: totalBidVol, askVol: totalAskVol });
        return next;
      });
    };

    ws.onerror = (e) => {
      console.error('[HotStuff] WebSocket error', e);
      setState(s => ({ ...s, error: 'WebSocket error', connecting: false }));
    };

    ws.onclose = (e) => {
      console.debug('[HotStuff] WebSocket closed', e.code, e.reason);
      setState(s => ({ ...s, connected: false, connecting: false }));
      if (retryRef.current < MAX_RETRIES) {
        retryRef.current += 1;
        // Always call the latest connect via ref — avoids stale closure
        retryTimerRef.current = setTimeout(() => connectRef.current(), RECONNECT_DELAY_MS);
      } else {
        setState(s => ({ ...s, error: 'Max reconnect attempts reached' }));
      }
    };
  }, [disconnect]);

  // Keep connectRef in sync
  connectRef.current = connect;

  useEffect(() => {
    if (symbol) connect();
    else setState(defaultState(''));
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return { state, history, reconnect: connect };
}

export { DEFAULT_FORMULA_PARAMS };
