'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AggLevel } from '@/types/orderbook';
import { MarketPair } from '@/lib/pairs';
import MarketSelector from '@/components/MarketSelector';
import { ThemeSwitcher } from './ui/apple-liquid-glass-switcher';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import styles from './Header.module.css';

const AGG_LEVELS: AggLevel[] = [1, 10, 100, 1000, 10000];

interface HeaderProps {
  symbol: string;
  aggLevel: AggLevel;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  darkMode: boolean;
  theme?: 'light' | 'dark' | 'dim';
  onSymbolChange: (s: string) => void;
  onAggChange: (a: AggLevel) => void;
  onReconnect: () => void;
  onToggleTheme: () => void;
  onSetTheme?: (t: 'light' | 'dark' | 'dim') => void;
  brandName?: string;
  brandMetric?: string;
  pairs?: MarketPair[];
  showAgg?: boolean;
  backHref?: string;
}

export default function Header({
  symbol, aggLevel, connected, connecting, error,
  darkMode, theme = 'dark', onSymbolChange, onAggChange, onReconnect, onToggleTheme, onSetTheme,
  brandName = 'PACIFICA',
  brandMetric = 'ORDERBOOK IMBALANCE',
  pairs,
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
          <label className={styles.label}>MARKET</label>
          {pairs ? (
            <MarketSelector
              pairs={pairs}
              selected={symbol}
              onSelect={onSymbolChange}
            />
          ) : (
            <span className={styles.select}>{symbol}</span>
          )}
        </div>

        {showAgg && (
          <div className={styles.controlGroup}>
            <label className={styles.label}>AGG</label>
            <Select
              value={String(aggLevel)}
              onValueChange={val => onAggChange(Number(val) as AggLevel)}
            >
              <SelectTrigger className="w-24 h-8 font-mono text-xs border border-white/10 bg-white/5 backdrop-blur-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGG_LEVELS.map(a => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <button className={styles.reconnectBtn} onClick={onReconnect} title="Reconnect">
          ↺
        </button>

        <ThemeSwitcher 
          value={theme}
          onValueChange={(val) => {
            if (onSetTheme) onSetTheme(val);
          }}
        />
      </div>

      <div className={styles.statusGroup}>
        <span className={`${styles.statusDot} ${statusClass}`} />
        <span className={`${styles.statusLabel} ${statusClass}`}>{statusLabel}</span>
        <span className={styles.clock}>{clock}</span>
      </div>
    </header>
  );
}
