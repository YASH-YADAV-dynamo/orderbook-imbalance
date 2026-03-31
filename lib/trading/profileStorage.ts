'use client';

import type { ExecutionExchange, ExecutionSide } from '@/types/trading';

const SESSION_KEY = 'trading_sessions_v1';
const ORDER_KEY = 'trading_order_history_v1';

export interface TradingSessionRecord {
  id: string;
  exchange: ExecutionExchange;
  walletAddress: string;
  agentName: string;
  apiWalletAddress: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface TradingOrderRecord {
  id: string;
  exchange: ExecutionExchange;
  walletAddress: string;
  apiWalletAddress: string;
  symbol: string;
  side: ExecutionSide;
  sizeUsd: string;
  status: string;
  exchangeTxHash?: string;
  message?: string;
  createdAt: number;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

function readJson<T>(key: string): T[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, data: T[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(data));
}

export function readTradingSessions(): TradingSessionRecord[] {
  return readJson<TradingSessionRecord>(SESSION_KEY);
}

export function readTradingOrders(): TradingOrderRecord[] {
  return readJson<TradingOrderRecord>(ORDER_KEY);
}

export function upsertTradingSession(
  session: Omit<TradingSessionRecord, 'id' | 'createdAt' | 'lastActiveAt'>,
): TradingSessionRecord {
  const existing = readTradingSessions();
  const now = Date.now();
  const match = existing.find(
    s => s.exchange === session.exchange
      && s.walletAddress.toLowerCase() === session.walletAddress.toLowerCase()
      && s.apiWalletAddress.toLowerCase() === session.apiWalletAddress.toLowerCase(),
  );

  const nextRecord: TradingSessionRecord = match
    ? { ...match, agentName: session.agentName, lastActiveAt: now }
    : {
      id: crypto.randomUUID(),
      createdAt: now,
      lastActiveAt: now,
      ...session,
    };

  const filtered = existing.filter(s => s.id !== nextRecord.id);
  writeJson(SESSION_KEY, [nextRecord, ...filtered].slice(0, 200));
  return nextRecord;
}

export function appendTradingOrder(
  order: Omit<TradingOrderRecord, 'id' | 'createdAt'>,
): TradingOrderRecord {
  const existing = readTradingOrders();
  const next: TradingOrderRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...order,
  };
  writeJson(ORDER_KEY, [next, ...existing].slice(0, 500));
  return next;
}
