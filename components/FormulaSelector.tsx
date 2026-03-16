'use client';

import { FormulaParams, FormulaType, FORMULA_META } from '@/types/orderbook';
import styles from './FormulaSelector.module.css';

const FORMULA_ORDER: FormulaType[] = [
  'distanceWeighted',
  'nearMid',
  'ofi',
  'microprice',
  'powerLaw',
];

// Human-readable formula expressions
const FORMULA_EXPR: Record<FormulaType, string> = {
  distanceWeighted: 'Σ Bᵢ·e^(-λdᵢ) vs Σ Aᵢ·e^(-λdᵢ)',
  nearMid:          'B±x% vs A±x%',
  ofi:              'Σ(ΔBᵢ - ΔAᵢ) / DepthN',
  microprice:       '(MP - Mid) / Spread',
  powerLaw:         'Σ Bᵢ/dᵢ^α vs Σ Aᵢ/dᵢ^α',
};

interface FormulaSelectorProps {
  formula: FormulaType;
  params: FormulaParams;
  onFormulaChange: (f: FormulaType) => void;
  onParamsChange: (p: Partial<FormulaParams>) => void;
}

export default function FormulaSelector({
  formula,
  params,
  onFormulaChange,
  onParamsChange,
}: FormulaSelectorProps) {
  const meta = FORMULA_META[formula];

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <label className={styles.label}>FORMULA</label>
        <select
          className={styles.select}
          value={formula}
          onChange={e => onFormulaChange(e.target.value as FormulaType)}
        >
          {FORMULA_ORDER.map((f, i) => (
            <option key={f} value={f}>
              [{i + 1}] {FORMULA_META[f].label}
            </option>
          ))}
        </select>

        {/* Lambda slider — formula 1 */}
        {formula === 'distanceWeighted' && (
          <div className={styles.paramGroup}>
            <label className={styles.paramLabel}>λ</label>
            <input
              type="range"
              className={styles.slider}
              min={0.1}
              max={100}
              step={0.1}
              value={params.lambda}
              onChange={e => onParamsChange({ lambda: parseFloat(e.target.value) })}
            />
            <span className={styles.paramValue}>{params.lambda.toFixed(1)}</span>
          </div>
        )}

        {/* xPct slider — formula 2 */}
        {formula === 'nearMid' && (
          <div className={styles.paramGroup}>
            <label className={styles.paramLabel}>x%</label>
            <input
              type="range"
              className={styles.slider}
              min={0.1}
              max={5}
              step={0.1}
              value={params.xPct}
              onChange={e => onParamsChange({ xPct: parseFloat(e.target.value) })}
            />
            <span className={styles.paramValue}>{params.xPct.toFixed(1)}%</span>
          </div>
        )}

        {/* Alpha slider — formula 5 */}
        {formula === 'powerLaw' && (
          <div className={styles.paramGroup}>
            <label className={styles.paramLabel}>α</label>
            <input
              type="range"
              className={styles.slider}
              min={0.5}
              max={3}
              step={0.1}
              value={params.alpha}
              onChange={e => onParamsChange({ alpha: parseFloat(e.target.value) })}
            />
            <span className={styles.paramValue}>{params.alpha.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className={styles.desc}>
        <span className={styles.badge}>{meta.short}</span>
        <span className={styles.expr}>{FORMULA_EXPR[formula]}</span>
        <span className={styles.descText}>{meta.description}</span>
      </div>
    </div>
  );
}
