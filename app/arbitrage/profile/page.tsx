'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  readTradingOrders,
  readTradingSessions,
  type TradingOrderRecord,
  type TradingSessionRecord,
} from '@/lib/trading/profileStorage';
import styles from './page.module.css';

function groupSessionsByExchange(sessions: TradingSessionRecord[]): Record<string, TradingSessionRecord[]> {
  return sessions.reduce<Record<string, TradingSessionRecord[]>>((acc, session) => {
    const key = session.exchange;
    acc[key] = acc[key] ?? [];
    acc[key].push(session);
    return acc;
  }, {});
}

function groupOrdersByExchange(orders: TradingOrderRecord[]): Record<string, TradingOrderRecord[]> {
  return orders.reduce<Record<string, TradingOrderRecord[]>>((acc, order) => {
    const key = order.exchange;
    acc[key] = acc[key] ?? [];
    acc[key].push(order);
    return acc;
  }, {});
}

export default function TradingProfilePage() {
  const [sessions] = useState<TradingSessionRecord[]>(() => readTradingSessions());
  const [orders] = useState<TradingOrderRecord[]>(() => readTradingOrders());

  const sessionsByExchange = useMemo(() => groupSessionsByExchange(sessions), [sessions]);
  const ordersByExchange = useMemo(() => groupOrdersByExchange(orders), [orders]);
  const exchanges = useMemo(
    () => Array.from(new Set([...Object.keys(sessionsByExchange), ...Object.keys(ordersByExchange)])),
    [ordersByExchange, sessionsByExchange],
  );

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <h1>Trading Profile</h1>
        <Link href="/arbitrage" className={styles.link}>Back to arbitrage</Link>
      </nav>

      {exchanges.length === 0 && (
        <div className={styles.empty}>No sessions or order history yet.</div>
      )}

      {exchanges.map(exchange => (
        <section key={exchange} className={styles.section}>
          <h2>{exchange.toUpperCase()}</h2>

          <div className={styles.block}>
            <h3>API Wallet Sessions</h3>
            {(sessionsByExchange[exchange] ?? []).length === 0 && <p className={styles.muted}>No sessions.</p>}
            {(sessionsByExchange[exchange] ?? []).map(session => (
              <div key={session.id} className={styles.card}>
                <p>Wallet: {session.walletAddress}</p>
                <p>Agent Name: {session.agentName}</p>
                <p>API Wallet: {session.apiWalletAddress}</p>
                <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
                <p>Last Active: {new Date(session.lastActiveAt).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className={styles.block}>
            <h3>Order History</h3>
            {(ordersByExchange[exchange] ?? []).length === 0 && <p className={styles.muted}>No orders.</p>}
            {(ordersByExchange[exchange] ?? []).map(order => (
              <div key={order.id} className={styles.card}>
                <p>{order.symbol} {order.side.toUpperCase()} ${order.sizeUsd}</p>
                <p>Status: {order.status}</p>
                <p>Wallet: {order.walletAddress}</p>
                <p>API Wallet: {order.apiWalletAddress}</p>
                {order.exchangeTxHash && <p>Tx: {order.exchangeTxHash}</p>}
                <p>Time: {new Date(order.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
