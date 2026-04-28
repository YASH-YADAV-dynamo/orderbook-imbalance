import React from 'react';
import { NormalizedTrade } from '@/lib/volume/types';
import styles from './LiveVolumeFeed.module.css';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveVolumeFeedProps {
  trades: NormalizedTrade[];
}

export const LiveVolumeFeed: React.FC<LiveVolumeFeedProps> = ({ trades }) => {
  const formatUSD = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className={styles.feed}>
      <div className={styles.header}>
        <span>TIME</span>
        <span>SYMBOL</span>
        <span>EXCHANGE</span>
        <span className={styles.right}>SIDE</span>
        <span className={styles.right}>SIZE</span>
      </div>
      <div className={styles.rows}>
        <AnimatePresence initial={false}>
          {trades.map((trade, i) => (
            <motion.div 
              key={`${trade.exchange}-${trade.timestamp}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={styles.row}
            >
              <span className={styles.time}>{formatTime(trade.timestamp)}</span>
              <span className={styles.symbol}>{trade.symbol}</span>
              <span className={styles.exchange}>{trade.exchange}</span>
              <span className={`${styles.side} ${trade.tradeSide === 'buy' ? styles.buy : styles.sell}`}>
                {trade.tradeSide.toUpperCase()}
              </span>
              <span className={`${styles.size} ${styles.right}`}>
                {formatUSD(trade.notionalUSD)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
