'use client';

import { useState } from 'react';
import styles from './IntegrateButton.module.css';

const MCP_CONFIG_PLACEHOLDER = '<path-to-this-project>';

function getMCPConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        'orderbook-signals': {
          command: 'npx',
          args: ['tsx', 'mcp-server/index.ts'],
          cwd: MCP_CONFIG_PLACEHOLDER,
        },
      },
    },
    null,
    2,
  );
}

const TOOLTIP_TEXT =
  'Copy MCP config for Cursor (or other clients). Replace cwd with the absolute path to this repo after git clone and npm install.';

export default function IntegrateButton() {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(getMCPConfig());
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
        onClick={handleClick}
        aria-label="Copy MCP server configuration"
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
