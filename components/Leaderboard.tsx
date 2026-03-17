'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './Leaderboard.module.css';

export interface LeaderboardEntry {
  id: string;
  name: string;
  route: string;
  color: string;
  symbol: string;
  imbalance: number;
  bidVol: number;
  askVol: number;
  spread: number;
  connected: boolean;
  connecting: boolean;
  supported: boolean;
}

const ROW_H = 72; // px — must match CSS .dataRow height

function fv(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function ExchangeIcon({ id, name, color }: { id: string; name: string; color: string }) {
  const [errored, setErrored] = useState(false);

  return (
    <div className={styles.dexCell}>
      <span className={styles.iconWrap}>
        {errored ? (
          <span className={styles.dexDotFallback} style={{ background: color }} />
        ) : (
          <Image
            src={`/exchanges/${id}.png`}
            alt={name}
            width={36}
            height={36}
            className={styles.dexIcon}
            onError={() => setErrored(true)}
            unoptimized
          />
        )}
      </span>
      <span className={styles.dexName}>{name}</span>
    </div>
  );
}

export default function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const visible = entries.filter(e => e.supported);
  const [sortedIds, setSortedIds] = useState<string[]>(() => visible.map(e => e.id));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const sort = () =>
      setSortedIds(
        [...visible]
          .sort((a, b) => {
            if (a.connected !== b.connected) return a.connected ? -1 : 1;
            return Math.abs(a.imbalance) - Math.abs(b.imbalance);
          })
          .map(e => e.id)
      );

    sort();
    timerRef.current = setInterval(sort, 1500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  if (visible.length === 0) {
    return <div className={styles.empty}>No DEXes support the selected symbol.</div>;
  }

  return (
    <div className={styles.table}>
      {/* ── Header row ── */}
      <div className={`${styles.row} ${styles.headRow}`}>
        <div className={styles.col}>#</div>
        <div className={styles.col}>Exchange</div>
        <div className={`${styles.col} ${styles.numCol}`}>Imbalance</div>
        <div className={styles.col}>Direction</div>
        <div className={`${styles.col} ${styles.numCol}`}>Bid Vol</div>
        <div className={`${styles.col} ${styles.numCol}`}>Ask Vol</div>
        <div className={styles.col}>Status</div>
        <div className={styles.col} />
      </div>

      {/* ── Animated data rows ── */}
      <div
        className={styles.body}
        style={{ height: `${visible.length * ROW_H}px` }}
      >
        {visible.map(entry => {
          const rank = sortedIds.indexOf(entry.id);
          const r = rank === -1 ? visible.length - 1 : rank;
          const isBid = entry.imbalance >= 0;
          const absImb = Math.abs(entry.imbalance);
          const dir = absImb > 0.05 ? (isBid ? 'Bid pressure' : 'Ask pressure') : 'Balanced';
          const pct = entry.connected
            ? `${entry.imbalance >= 0 ? '+' : ''}${(entry.imbalance * 100).toFixed(2)}%`
            : '—';
          const statusKey = entry.connected ? 'live' : entry.connecting ? 'wait' : 'off';

          return (
            <div
              key={entry.id}
              className={styles.dataRow}
              style={{ transform: `translateY(${r * ROW_H}px)` }}
            >
              <div className={`${styles.col} ${styles.rankCol}`}>{r + 1}</div>

              <div className={`${styles.col} ${styles.dexCol}`}>
                <ExchangeIcon id={entry.id} name={entry.name} color={entry.color} />
              </div>

              <div
                className={`${styles.col} ${styles.numCol} ${styles.imbCol}`}
                data-dir={entry.connected ? (isBid ? 'bid' : 'ask') : 'none'}
              >
                {pct}
              </div>

              <div
                className={`${styles.col} ${styles.dirCol}`}
                data-dir={entry.connected ? (isBid ? 'bid' : 'ask') : 'none'}
              >
                {entry.connected ? dir : '—'}
              </div>

              <div className={`${styles.col} ${styles.numCol} ${styles.volCol}`}>
                {entry.connected ? fv(entry.bidVol) : '—'}
              </div>

              <div className={`${styles.col} ${styles.numCol} ${styles.volAskCol}`}>
                {entry.connected ? fv(entry.askVol) : '—'}
              </div>

              <div className={`${styles.col} ${styles.statusCol}`}>
                <span className={styles.statusDot} data-s={statusKey} />
                <span className={styles.statusText}>
                  {entry.connected ? 'Live' : entry.connecting ? 'Connecting' : 'Offline'}
                </span>
              </div>

              <div className={`${styles.col} ${styles.actionCol}`}>
                <Link href={entry.route} className={styles.openLink}>
                  Open ↗
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
