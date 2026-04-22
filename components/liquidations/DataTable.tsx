import React from 'react';
import styles from './DataTable.module.css';
import { LiquidationEvent } from '@/lib/liquidations/types';
import { ExternalLink } from 'lucide-react';

interface DataTableProps {
  events: LiquidationEvent[];
  isLoading: boolean;
}

export function DataTable({ events, isLoading }: DataTableProps) {
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TIME</th>
                <th>SYMBOL</th>
                <th>SIDE</th>
                <th>TYPE</th>
                <th className={styles.rightAlign}>PRICE</th>
                <th className={styles.rightAlign}>SIZE</th>
                <th className={styles.rightAlign}>NOTIONAL</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(10)].map((_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  <td><div className={styles.skeletonCell} /></td>
                  <td><div className={styles.skeletonCell} /></td>
                  <td><div className={styles.skeletonCell} /></td>
                  <td><div className={styles.skeletonCell} /></td>
                  <td><div className={styles.skeletonCell} /></td>
                  <td><div className={styles.skeletonCell} /></td>
                  <td><div className={styles.skeletonCell} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(val);
  };

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>TIME</th>
              <th>SYMBOL</th>
              <th>SIDE</th>
              <th>TYPE</th>
              <th className={styles.rightAlign}>PRICE</th>
              <th className={styles.rightAlign}>SIZE</th>
              <th className={styles.rightAlign}>NOTIONAL</th>
              <th className={styles.rightAlign}>TX</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyState}>
                  No liquidations found for the current filters.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.raw_order_id} className={styles.row}>
                  <td className={styles.timeCell}>{formatTime(event.timestamp_ms)}</td>
                  <td className={styles.symbolCell}>{event.symbol}</td>
                  <td>
                    <span className={`${styles.badge} ${event.side === 'long' ? styles.badgeError : styles.badgeSuccess}`}>
                      {event.side.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={styles.typeText}>
                      {event.liq_type.toUpperCase()}
                    </span>
                  </td>
                  <td className={`${styles.rightAlign} ${styles.mono}`}>{formatCurrency(event.price_usd)}</td>
                  <td className={`${styles.rightAlign} ${styles.mono}`}>{formatNumber(event.amount_token)}</td>
                  <td className={`${styles.rightAlign} ${styles.mono} ${styles.highlight}`}>
                    {formatCurrency(event.notional_usd)}
                  </td>
                  <td className={styles.rightAlign}>
                    <a 
                      href={`https://pacifica.fi/explorer/trade/${event.raw_order_id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.txLink}
                    >
                      <ExternalLink className={styles.txIcon} />
                    </a>
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
