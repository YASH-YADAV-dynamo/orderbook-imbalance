'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AggLevel,
  BookMessage,
  DEFAULT_FORMULA_PARAMS,
  FormulaParams,
  FormulaType,
  HistoryPoint,
  Level,
  OrderbookState,
} from '@/types/orderbook';
import { computeImbalance } from '@/lib/formulas';

const WS_URL = 'wss://ws.pacifica.fi/ws';
const HISTORY_DURATION_MS = 60_000;
const PING_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RETRIES = 5;

function calcSpread(bids: Level[], asks: Level[]): number {
  if (!bids.length || !asks.length) return 0;
  const bestBid = parseFloat(bids[0].p);
  const bestAsk = parseFloat(asks[0].p);
  return Math.max(0, bestAsk - bestBid);
}

const defaultState: OrderbookState = {
  bids: [],
  asks: [],
  symbol: 'SOL',
  timestamp: 0,
  imbalance: 0,
  totalBidVol: 0,
  totalAskVol: 0,
  spread: 0,
  connected: false,
  connecting: false,
  error: null,
};

export function useOrderbook(
  symbol: string,
  aggLevel: AggLevel,
  formula: FormulaType,
  params: FormulaParams,
) {
  const [state, setState] = useState<OrderbookState>(defaultState);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs so callbacks always see latest values without re-subscribing
  const symbolRef = useRef(symbol);
  const aggRef = useRef(aggLevel);
  const formulaRef = useRef(formula);
  const paramsRef = useRef(params);
  // Previous tick's book for OFI delta computation
  const prevBidsRef = useRef<Level[]>([]);
  const prevAsksRef = useRef<Level[]>([]);

  symbolRef.current = symbol;
  aggRef.current = aggLevel;
  formulaRef.current = formula;
  paramsRef.current = params;

  const disconnect = useCallback(() => {
    if (pingRef.current) clearInterval(pingRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    disconnect();
    prevBidsRef.current = [];
    prevAsksRef.current = [];
    setState(s => ({ ...s, connecting: true, error: null }));

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setState(s => ({ ...s, connected: true, connecting: false, error: null }));

      ws.send(JSON.stringify({
        method: 'subscribe',
        params: {
          source: 'book',
          symbol: symbolRef.current,
          agg_level: aggRef.current,
        },
      }));

      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: BookMessage;
      try {
        msg = JSON.parse(event.data as string) as BookMessage;
      } catch {
        return;
      }
      if (msg.channel !== 'book' || !msg.data) return;

      const { l, s, t } = msg.data;
      const [bids, asks] = l;

      const imbalance = computeImbalance(
        formulaRef.current,
        paramsRef.current,
        bids,
        asks,
        prevBidsRef.current,
        prevAsksRef.current,
      );

      // Store current tick as previous for next OFI delta
      prevBidsRef.current = bids;
      prevAsksRef.current = asks;

      const totalBidVol = bids.reduce((sum, lv) => sum + parseFloat(lv.a), 0);
      const totalAskVol = asks.reduce((sum, lv) => sum + parseFloat(lv.a), 0);
      const spread = calcSpread(bids, asks);

      setState({
        bids,
        asks,
        symbol: s,
        timestamp: t,
        imbalance,
        totalBidVol,
        totalAskVol,
        spread,
        connected: true,
        connecting: false,
        error: null,
      });

      setHistory(prev => {
        const cutoff = t - HISTORY_DURATION_MS;
        const next = prev.filter(p => p.t >= cutoff);
        next.push({ t, imbalance, bidVol: totalBidVol, askVol: totalAskVol });
        return next;
      });
    };

    ws.onerror = () => {
      setState(s => ({ ...s, error: 'WebSocket error', connecting: false }));
    };

    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
      setState(s => ({ ...s, connected: false, connecting: false }));
      if (retryRef.current < MAX_RETRIES) {
        retryRef.current += 1;
        retryTimerRef.current = setTimeout(() => connect(), RECONNECT_DELAY_MS);
      } else {
        setState(s => ({ ...s, error: 'Max reconnect attempts reached' }));
      }
    };
  }, [disconnect]);

  // Reconnect only when symbol or agg level changes (not formula/params — those use refs)
  useEffect(() => {
    connect();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, aggLevel]);

  return { state, history, reconnect: connect };
}

export { DEFAULT_FORMULA_PARAMS };
