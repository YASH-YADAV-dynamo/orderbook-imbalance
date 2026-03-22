'use client';

import { useState } from 'react';
import styles from './IntegrateButton.module.css';

const INSTALL_CMD = '/plugin install orderbook-imbalance@claude-plugins-official';
const TOOLTIP_TEXT = 'Get Claude skills for this ability';

export default function IntegrateButton() {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={styles.wrap}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={handleCopy}
      >
        <span className={styles.triggerIcon}>{copied ? '✓' : '⎘'}</span>
        {copied ? 'Copied!' : 'Integrate'}
      </button>

      {showTooltip && !copied && (
        <div className={styles.tooltip} role="tooltip">
          {TOOLTIP_TEXT}
        </div>
      )}
    </div>
  );
}
