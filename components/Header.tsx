'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AggLevel } from '@/types/orderbook';
import styles from './Header.module.css';

const AGG_LEVELS: AggLevel[] = [1, 10, 100, 1000, 10000];
const SYMBOLS = ['SOL', 'BTC', 'ETH', 'AVAX', 'MATIC'];

interface HeaderProps {
  symbol: string;
  aggLevel: AggLevel;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  darkMode: boolean;
  onSymbolChange: (s: string) => void;
  onAggChange: (a: AggLevel) => void;
  onReconnect: () => void;
  onToggleTheme: () => void;
  // Optional overrides
  brandName?: string;
  brandMetric?: string;
  symbols?: string[];
  showAgg?: boolean;
  backHref?: string;
}

export default function Header({
  symbol, aggLevel, connected, connecting, error,
  darkMode, onSymbolChange, onAggChange, onReconnect, onToggleTheme,
  brandName = 'PACIFICA',
  brandMetric = 'ORDERBOOK IMBALANCE',
  symbols = SYMBOLS,
  showAgg = true,
  backHref,
}: HeaderProps) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const statusLabel = connecting ? 'CONNECTING' : connected ? 'LIVE' : error ? 'ERROR' : 'OFFLINE';
  const statusClass = connecting ? styles.connecting : connected ? styles.live : styles.offline;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        {backHref && (
          <Link href={backHref} className={styles.backBtn} title="Back to Home">
            ←
          </Link>
        )}
        <span className={styles.brandName}>{brandName}</span>
        <span className={styles.divider}>/</span>
        <span className={styles.metric}>{brandMetric}</span>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label className={styles.label}>SYMBOL</label>
          <select
            className={styles.select}
            value={symbol}
            onChange={e => onSymbolChange(e.target.value)}
          >
            {symbols.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {showAgg && (
          <div className={styles.controlGroup}>
            <label className={styles.label}>AGG</label>
            <select
              className={styles.select}
              value={aggLevel}
              onChange={e => onAggChange(Number(e.target.value) as AggLevel)}
            >
              {AGG_LEVELS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        <button className={styles.reconnectBtn} onClick={onReconnect} title="Reconnect">
          ↺
        </button>

        <button
          className={styles.themeToggle}
          onClick={onToggleTheme}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? '☀ LIGHT' : '◑ DARK'}
        </button>
      </div>

      <div className={styles.statusGroup}>
        <span className={`${styles.statusDot} ${statusClass}`} />
        <span className={`${styles.statusLabel} ${statusClass}`}>{statusLabel}</span>
        <span className={styles.clock}>{clock}</span>
      </div>
    </header>
  );
}
