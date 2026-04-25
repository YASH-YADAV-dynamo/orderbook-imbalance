import React from 'react';
import styles from './ExchangeBreakdown.module.css';
import { PremiumLoader } from '@/components/ui/PremiumLoader';

interface ExchangeData {
  name: string;
  value: number;
  longValue: number;
  shortValue: number;
  count: number;
}

interface ExchangeBreakdownProps {
  data: ExchangeData[];
  isLoading: boolean;
}

export function ExchangeBreakdown({ data, isLoading }: ExchangeBreakdownProps) {
  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <PremiumLoader compact text="FETCHING EXCHANGE STATS" />
      </div>
    );
  }

  // Sort by total volume
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Exchange</th>
              <th className={styles.right}>Volume</th>
              <th className={styles.right}>Long/Short</th>
              <th className={styles.right}>Count</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((ex) => {
              const longRatio = ex.value > 0 ? (ex.longValue / ex.value) * 100 : 0;
              const shortRatio = 100 - longRatio;

              return (
                <tr key={ex.name} className={styles.row}>
                  <td className={styles.nameCell}>
                    <div className={styles.exchangeInfo}>
                      <span className={styles.name}>{ex.name}</span>
                      <div className={styles.statusGroup}>
                        <span className={styles.pulseDot} />
                        <span className={styles.statusText}>LIVE</span>
                      </div>
                    </div>
                  </td>
                  <td className={`${styles.right} ${styles.valueCell}`}>
                    {formatCurrency(ex.value)}
                  </td>
                  <td className={styles.right}>
                    <div className={styles.ratioBar}>
                      <div 
                        className={styles.longPart} 
                        style={{ width: `${longRatio}%` }}
                        title={`Long: ${longRatio.toFixed(1)}%`}
                      />
                      <div 
                        className={styles.shortPart} 
                        style={{ width: `${shortRatio}%` }}
                        title={`Short: ${shortRatio.toFixed(1)}%`}
                      />
                    </div>
                    <div className={styles.ratioLabels}>
                      <span className={styles.redText}>{longRatio.toFixed(0)}%</span>
                      <span className={styles.divider}>/</span>
                      <span className={styles.greenText}>{shortRatio.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className={`${styles.right} ${styles.countCell}`}>
                    {ex.count.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
