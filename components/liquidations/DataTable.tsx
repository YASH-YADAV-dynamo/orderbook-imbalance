import React from 'react';
import styles from './DataTable.module.css';
import { LiquidationEvent } from '@/lib/liquidations/types';
import { PremiumLoader } from '@/components/ui/PremiumLoader';

interface DataTableProps {
  events: LiquidationEvent[];
  isLoading: boolean;
}

const ExchangeIcon = ({ dex }: { dex: string }) => {
  switch (dex.toLowerCase()) {
    case 'binance':
      return (
        <svg viewBox="0 0 24 24" className={styles.dexIcon} fill="#F3BA2F">
          <path d="M12 0l3.12 4.675h-6.24l3.12-4.675zm-3.86 5.78l-3.12 4.675h-3.12l4.68-7.012 1.56 2.337zm7.72 0l1.56-2.337 4.68 7.012h-3.12l-3.12-4.675zm-11.58 5.78l-1.56 2.337-1.56-2.337 3.12-4.675v4.675zm15.44 0v-4.675l3.12 4.675-1.56 2.337-1.56-2.337zm-13.88 1.112l3.12 4.675h-6.24l3.12-4.675zm12.32 0l3.12 4.675h-6.24l3.12-4.675zm-10.76 1.113l-1.56 2.337-4.68-7.012h3.12l3.12 4.675zm9.2 0l3.12-4.675h3.12l-4.68 7.012-1.56-2.337zm-7.64 5.78l-3.12-4.675h6.24l-3.12 4.675z" />
        </svg>
      );
    case 'hyperliquid':
      return (
        <div className={`${styles.dexIcon} ${styles.hlIcon}`}>
          <div className={styles.hlInner} />
        </div>
      );
    case 'okx':
      return (
        <div className={`${styles.dexIcon} ${styles.okxIcon}`}>
          <div className={styles.okxDot} />
          <div className={styles.okxDot} />
          <div className={styles.okxDot} />
          <div className={styles.okxDot} />
        </div>
      );
    default:
      return <div className={styles.dexIconPlaceholder} />;
  }
};

export function DataTable({ events, isLoading }: DataTableProps) {
  if (isLoading && events.length === 0) {
    return (
      <div className={styles.loadingWrapper}>
        <PremiumLoader compact text="LOADING EVENTS" />
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
  };

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colSymbol}>Symbol</th>
              <th className={styles.colPrice}>Price</th>
              <th className={styles.colValue}>Value</th>
              <th className={styles.colTime}>Time</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.emptyState}>
                  Waiting for market liquidations...
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr 
                  key={event.raw_order_id} 
                  className={`${styles.row} ${event.side === 'long' ? styles.longRow : styles.shortRow}`}
                >
                  <td className={styles.colSymbol}>
                    <div className={styles.symbolCell}>
                      <ExchangeIcon dex={event.dex} />
                      <div className={styles.symbolInfo}>
                        <span className={styles.symbolName}>{event.symbol}</span>
                        <span className={styles.dexName}>{event.dex}</span>
                        <span className={`${styles.sideBadge} ${event.side === 'long' ? styles.sideLong : styles.sideShort}`}>
                          {event.side.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.colPrice}>
                    <span className={styles.priceText}>
                      ${event.price_usd.toLocaleString(undefined, { 
                        minimumFractionDigits: event.price_usd < 1 ? 6 : 2,
                        maximumFractionDigits: event.price_usd < 1 ? 6 : 2 
                      })}
                    </span>
                  </td>
                  <td className={styles.colValue}>
                    <span className={styles.valueText}>
                      ${formatValue(event.notional_usd)}
                    </span>
                  </td>
                  <td className={styles.colTime}>
                    <span className={styles.timeText}>{formatTime(event.timestamp_ms)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
