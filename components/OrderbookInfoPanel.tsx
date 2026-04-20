'use client';

import { FormulaParams, FormulaType } from '@/types/orderbook';
import { getFormulaGuide } from '@/lib/formulaGuide';
import { GlassStickyCard } from '@/components/ui/glass-sticky-card';
import { THEME } from '@/lib/theme-config';
import styles from './OrderbookInfoPanel.module.css';

interface OrderbookInfoPanelProps {
  formula: FormulaType;
  params: FormulaParams;
}

export default function OrderbookInfoPanel({ formula, params }: OrderbookInfoPanelProps) {
  const guide = getFormulaGuide(formula, params);

  return (
    <aside className={styles.panel}>
      <GlassStickyCard className={styles.glassCard} borderRadius="10px">
        <div className={styles.cardContent}>
          <p className={styles.kicker}>Orderbook imbalance values</p>
          <h2 className={styles.title}>Range: -1.00 to +1.00</h2>
          <ul className={styles.rangeList}>
            <li><span style={{ color: THEME.colors.bid }}>+0.20 to +1.00</span><span>Strong bid pressure</span></li>
            <li><span style={{ color: THEME.getAlpha(THEME.colors.bid, 0.6) }}>+0.05 to +0.20</span><span>Mild bid pressure</span></li>
            <li><span style={{ color: THEME.colors.foregroundMuted }}>-0.05 to +0.05</span><span>Balanced</span></li>
            <li><span style={{ color: THEME.getAlpha(THEME.colors.ask, 0.6) }}>-0.20 to -0.05</span><span>Mild ask pressure</span></li>
            <li><span style={{ color: THEME.colors.ask }}>-1.00 to -0.20</span><span>Strong ask pressure</span></li>
          </ul>
        </div>
      </GlassStickyCard>

      <GlassStickyCard className={styles.glassCard} borderRadius="10px">
        <div className={styles.cardContent}>
          <p className={styles.cardTitle}>Current formula: {guide.name}</p>
          <div className={styles.fraction}>
            <p className={styles.fracLabel}>Numerator</p>
            <p className={styles.numerator}>{guide.numerator}</p>
            <div className={styles.fractionBar} />
            <p className={styles.fracLabel}>Denominator</p>
            <p className={styles.denominator}>{guide.denominator}</p>
          </div>
          {guide.note && <p className={styles.note}>{guide.note}</p>}
          {guide.parameterHint && <p className={styles.paramHint}>{guide.parameterHint}</p>}
        </div>
      </GlassStickyCard>
    </aside>
  );
}
