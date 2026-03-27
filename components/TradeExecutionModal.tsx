'use client';

import type { TradeIntent } from '@/types/trading';
import styles from './TradeExecutionModal.module.css';

interface TradeExecutionModalProps {
  intent: TradeIntent | null;
  onClose: () => void;
}

export default function TradeExecutionModal({ intent, onClose }: TradeExecutionModalProps) {
  if (!intent) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Trade execution setup"
      >
        <p className={styles.message}>Execution setup coming soon.</p>
      </div>
    </div>
  );
}
