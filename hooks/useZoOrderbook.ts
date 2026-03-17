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

// 01 Exchange — Mainnet only
const WS_BASE = 'wss://zo-mainnet.n1.xyz/ws/deltas@';

const HISTORY_DURATION_MS = 60_000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RETRIES = 5;

interface DeltaMessage {
  delta: {
    market_symbol: string;
    update_id: number;
    bids: [number, number][];
    asks: [number, number][];
  };
}

const defaultState = (symbol: string): OrderbookState => ({
  bids: [],
  asks: [],
  symbol,
  timestamp: 0,
  imbalance: 0,
  totalBidVol: 0,
  totalAskVol: 0,
  spread: 0,
  connected: false,
  connecting: false,
  error: null,
});

/**
 * WebSocket hook for 01 Exchange mainnet delta feed.
 * symbol — WS-format symbol, e.g. "BTCUSD". Pass "" to skip connecting.
 */
export function useZoOrderbook(
  symbol: string,
  formula: FormulaType,
  params: FormulaParams,
) {
  const [state, setState] = useState<OrderbookState>(() => defaultState(symbol));
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bidMapRef = useRef(new Map<number, number>());
  const askMapRef = useRef(new Map<number, number>());
  const prevBidsRef = useRef<Level[]>([]);
  const prevAsksRef = useRef<Level[]>([]);

  const formulaRef = useRef(formula);
  const paramsRef = useRef(params);
  formulaRef.current = formula;
  paramsRef.current = params;

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!symbol) return;
    disconnect();
    bidMapRef.current.clear();
    askMapRef.current.clear();
    prevBidsRef.current = [];
    prevAsksRef.current = [];
    setState(s => ({ ...s, connecting: true, connected: false, error: null }));

    const ws = new WebSocket(`${WS_BASE}${symbol}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setState(s => ({ ...s, connected: true, connecting: false, error: null }));
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: DeltaMessage;
      try {
        msg = JSON.parse(event.data as string) as DeltaMessage;
      } catch {
        return;
      }
      if (!msg.delta) return;

      const { delta } = msg;

      // Apply delta updates to local orderbook maps
      delta.bids.forEach(([price, size]) => {
        size === 0 ? bidMapRef.current.delete(price) : bidMapRef.current.set(price, size);
      });
      delta.asks.forEach(([price, size]) => {
        size === 0 ? askMapRef.current.delete(price) : askMapRef.current.set(price, size);
      });

      // Convert sorted maps to Level arrays (top 50 levels)
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
        bids,
        asks,
        prevBidsRef.current,
        prevAsksRef.current,
      );

      prevBidsRef.current = bids;
      prevAsksRef.current = asks;

      const totalBidVol = bids.reduce((sum, l) => sum + parseFloat(l.a), 0);
      const totalAskVol = asks.reduce((sum, l) => sum + parseFloat(l.a), 0);
      const bestBid = bids[0] ? parseFloat(bids[0].p) : 0;
      const bestAsk = asks[0] ? parseFloat(asks[0].p) : 0;
      const spread = bestBid && bestAsk ? Math.max(0, bestAsk - bestBid) : 0;
      const now = Date.now();

      setState({
        bids,
        asks,
        symbol,
        timestamp: now,
        imbalance,
        totalBidVol,
        totalAskVol,
        spread,
        connected: true,
        connecting: false,
        error: null,
      });

      setHistory(prev => {
        const cutoff = now - HISTORY_DURATION_MS;
        const next = prev.filter(p => p.t >= cutoff);
        next.push({ t: now, imbalance, bidVol: totalBidVol, askVol: totalAskVol });
        return next;
      });
    };

    ws.onerror = () => {
      setState(s => ({ ...s, error: 'WebSocket error', connecting: false }));
    };

    ws.onclose = () => {
      setState(s => ({ ...s, connected: false, connecting: false }));
      if (retryRef.current < MAX_RETRIES) {
        retryRef.current += 1;
        retryTimerRef.current = setTimeout(() => connect(), RECONNECT_DELAY_MS);
      } else {
        setState(s => ({ ...s, error: 'Max reconnect attempts reached' }));
      }
    };
  }, [symbol, disconnect]);

  useEffect(() => {
    if (symbol) connect();
    else setState(defaultState(''));
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return { state, history, reconnect: connect };
}

export { DEFAULT_FORMULA_PARAMS };
