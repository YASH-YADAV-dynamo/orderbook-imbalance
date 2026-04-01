'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTradingFlow } from '@/hooks/useTradingFlow';
import type { ExecutionExchange } from '@/types/trading';
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
  const searchParams = useSearchParams();
  const [showSetupModal, setShowSetupModal] = useState(() => searchParams.get('setup') === '1');
  const [copied, setCopied] = useState(false);
  const [sessions, setSessions] = useState<TradingSessionRecord[]>(() => readTradingSessions());
  const [orders, setOrders] = useState<TradingOrderRecord[]>(() => readTradingOrders());
  const flow = useTradingFlow(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSessions(readTradingSessions());
      setOrders(readTradingOrders());
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(id);
  }, [copied]);

  const sessionsByExchange = useMemo(() => groupSessionsByExchange(sessions), [sessions]);
  const ordersByExchange = useMemo(() => groupOrdersByExchange(orders), [orders]);
  const exchanges = useMemo(
    () => Array.from(new Set([...Object.keys(sessionsByExchange), ...Object.keys(ordersByExchange)])),
    [ordersByExchange, sessionsByExchange],
  );
  const setupExchange = (searchParams.get('exchange') ?? 'hotstuff') as ExecutionExchange;
  const setupSymbol = searchParams.get('symbol');
  const setupSide = searchParams.get('side');

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <h1>Portfolio</h1>
        <Link href="/arbitrage" className={styles.link}>Back to arbitrage</Link>
      </nav>

      <section className={styles.section}>
        <div className={styles.headerRow}>
          <div>
            <h2>Order tracker</h2>
            <p className={styles.muted}>Track active API sessions and recent order activity.</p>
          </div>
          <button type="button" className={styles.cta} onClick={() => setShowSetupModal(true)}>
            Setup API Agent
          </button>
        </div>

        {exchanges.length === 0 && (
          <div className={styles.empty}>No sessions or order history yet.</div>
        )}

        {exchanges.map(exchange => (
          <div key={exchange} className={styles.block}>
            <h3>{exchange.toUpperCase()}</h3>
            <div className={styles.grid}>
              <div>
                <h4>API Agent Sessions</h4>
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
              <div>
                <h4>Order History</h4>
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
            </div>
          </div>
        ))}
      </section>

      {showSetupModal && (
        <div className={styles.overlay} onClick={() => setShowSetupModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>API Agent Setup</h2>
              <button type="button" className={styles.linkLike} onClick={() => setShowSetupModal(false)}>
                Close
              </button>
            </div>
            {(setupSymbol && setupSide) && (
              <p className={styles.info}>
                Continue setup for {setupSide.toUpperCase()} {setupSymbol} on {setupExchange.toUpperCase()}.
              </p>
            )}
            <section className={styles.modalStep}>
              <h3>1. Connect wallet</h3>
              <p>{flow.walletAddress ? `Connected: ${flow.walletAddress}` : 'Connect your EOA wallet to continue.'}</p>
              {!flow.walletAddress && (
                <button type="button" className={styles.cta} disabled={flow.busy} onClick={() => void flow.connectWallet(false)}>
                  Connect wallet
                </button>
              )}
              {flow.walletAddress && (
                <div className={styles.row}>
                  <button type="button" className={styles.secondary} disabled={flow.busy} onClick={flow.disconnectWallet}>
                    Disconnect
                  </button>
                  <button type="button" className={styles.secondary} disabled={flow.busy} onClick={() => void flow.changeWallet()}>
                    Change wallet
                  </button>
                </div>
              )}
            </section>

            {flow.walletAddress && (
              <section className={styles.modalStep}>
                <h3>2. Activate API agent</h3>
                {flow.account?.hasApiAgent ? (
                  <>
                    <p>API agent is already active for this exchange.</p>
                    <p className={styles.muted}>New orders from screener now use size + one-click sign.</p>
                  </>
                ) : (
                  <>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Agent name"
                      value={flow.agentName}
                      onChange={e => flow.setAgentName(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.cta}
                      disabled={flow.busy || !flow.agentName.trim()}
                      onClick={() => void flow.generateAndActivateAgent()}
                    >
                      Activate API agent
                    </button>
                  </>
                )}

                {flow.agentPrivateKey && (
                  <div className={styles.warning}>
                    <p>Private key (generated once): keep this secure. Anyone with this key can sign orders.</p>
                    <div className={styles.copyRow}>
                      <code>{flow.agentPrivateKey}</code>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={async () => {
                          await navigator.clipboard.writeText(flow.agentPrivateKey);
                          setCopied(true);
                        }}
                      >
                        Copy key
                      </button>
                    </div>
                    {copied && <p className={styles.muted}>Copied.</p>}
                  </div>
                )}
              </section>
            )}

            {flow.error && <p className={styles.error}>{flow.error}</p>}
            {flow.success && <p className={styles.success}>{flow.success}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
