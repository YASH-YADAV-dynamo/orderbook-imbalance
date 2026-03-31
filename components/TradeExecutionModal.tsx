'use client';

import { useMemo, useState } from 'react';
import { useTradingFlow } from '@/hooks/useTradingFlow';
import type { TradeIntent } from '@/types/trading';
import styles from './TradeExecutionModal.module.css';

interface TradeExecutionModalProps {
  intent: TradeIntent | null;
  onClose: () => void;
}

function ConnectStep({
  connected,
  walletAddress,
  onConnect,
  onDisconnect,
  onChangeWallet,
  busy,
}: {
  connected: boolean;
  walletAddress: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onChangeWallet: () => Promise<void>;
  busy: boolean;
}) {
  return (
    <section className={styles.step}>
      <h3>1. Connect wallet</h3>
      <p>{connected ? `Connected: ${walletAddress}` : 'Connect an EVM wallet to continue.'}</p>
      {!connected && (
        <button type="button" disabled={busy} className={styles.cta} onClick={() => void onConnect()}>
          Connect wallet
        </button>
      )}
      {connected && (
        <div className={styles.row}>
          <button type="button" disabled={busy} className={styles.secondary} onClick={onDisconnect}>
            Disconnect
          </button>
          <button type="button" disabled={busy} className={styles.cta} onClick={() => void onChangeWallet()}>
            Change wallet
          </button>
        </div>
      )}
    </section>
  );
}

function AgentStep({
  hasAgent,
  agentName,
  onAgentNameChange,
  agentWalletAddress,
  onAgentWalletAddressChange,
  agentPrivateKey,
  onGenerateApiWallet,
  onGenerateAndActivateAgent,
  onUseExistingAgent,
  busy,
}: {
  hasAgent: boolean;
  agentName: string;
  onAgentNameChange: (value: string) => void;
  agentWalletAddress: string;
  onAgentWalletAddressChange: (value: string) => void;
  agentPrivateKey: string;
  onGenerateApiWallet: () => void;
  onGenerateAndActivateAgent: () => Promise<void>;
  onUseExistingAgent: () => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<'generate' | 'existing' | null>(null);

  return (
    <section className={styles.step}>
      <h3>2. API wallet</h3>
      <p>{hasAgent ? 'API wallet is active.' : 'Create an API wallet and sign with your connected EOA.'}</p>
      <div className={styles.row}>
        <button
          type="button"
          disabled={busy}
          className={styles.cta}
          onClick={() => {
            setMode('generate');
          }}
        >
          Generate API wallet
        </button>
        <button
          type="button"
          disabled={busy}
          className={styles.secondary}
          onClick={() => setMode('existing')}
        >
          Use existing API wallet
        </button>
      </div>

      {mode === 'generate' && (
        <>
          <input
            className={styles.input}
            type="text"
            value={agentName}
            onChange={e => onAgentNameChange(e.target.value)}
            placeholder="Agent name"
          />
          <input
            className={styles.input}
            type="text"
            value={agentWalletAddress}
            readOnly
            placeholder="Generated agent wallet address"
          />
          <input
            className={styles.input}
            type="text"
            value={agentPrivateKey}
            readOnly
            placeholder="Generated agent private key"
          />
          <p className={styles.hint}>Copy and securely store this private key before continuing.</p>
          <div className={styles.row}>
            <button type="button" disabled={busy} className={styles.secondary} onClick={onGenerateApiWallet}>
              OK: Generate wallet
            </button>
            <button type="button" disabled={busy || !agentPrivateKey} className={styles.cta} onClick={() => void onGenerateAndActivateAgent()}>
              Sign with EOA and activate
            </button>
          </div>
        </>
      )}

      {mode === 'existing' && (
        <>
          <input
            className={styles.input}
            type="text"
            value={agentWalletAddress}
            onChange={e => onAgentWalletAddressChange(e.target.value)}
            placeholder="Existing agent wallet address (0x...)"
          />
          <button type="button" disabled={busy} className={styles.secondary} onClick={onUseExistingAgent}>
            Activate existing API wallet
          </button>
        </>
      )}
    </section>
  );
}

function SizeStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <section className={styles.step}>
      <h3>4. Position size (USD)</h3>
      <input
        className={styles.input}
        min="10"
        max="5000"
        step="10"
        value={value}
        onChange={e => onChange(e.target.value)}
        type="number"
      />
      <input
        className={styles.slider}
        min="10"
        max="5000"
        step="10"
        value={value}
        onChange={e => onChange(e.target.value)}
        type="range"
      />
    </section>
  );
}

export default function TradeExecutionModal({ intent, onClose }: TradeExecutionModalProps) {
  const flow = useTradingFlow(intent);
  const heading = useMemo(() => {
    if (!intent) return '';
    return `${intent.side.toUpperCase()} ${intent.symbol} on ${intent.exchange}`;
  }, [intent]);

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
        <header className={styles.header}>
          <h2>{heading}</h2>
          <button type="button" onClick={onClose} className={styles.close}>Close</button>
        </header>

        <ConnectStep
          connected={Boolean(flow.walletAddress)}
          walletAddress={flow.walletAddress}
          onConnect={() => flow.connectWallet(false)}
          onDisconnect={flow.disconnectWallet}
          onChangeWallet={flow.changeWallet}
          busy={flow.busy}
        />

        {flow.walletAddress && (
          <AgentStep
            hasAgent={Boolean(flow.account?.hasApiAgent)}
            agentName={flow.agentName}
            onAgentNameChange={flow.setAgentName}
            agentWalletAddress={flow.agentWalletAddress}
            onAgentWalletAddressChange={flow.setAgentWalletAddress}
            agentPrivateKey={flow.agentPrivateKey}
            onGenerateApiWallet={flow.generateAgentCredentials}
            onGenerateAndActivateAgent={flow.generateAndActivateAgent}
            onUseExistingAgent={flow.useExistingAgent}
            busy={flow.busy}
          />
        )}

        {flow.walletAddress && flow.account?.hasApiAgent && (
          <>
            <section className={styles.step}>
              <h3>3. Approve broker</h3>
              <button type="button" className={styles.secondary} disabled={flow.busy} onClick={() => void flow.approve()}>
                Approve broker
              </button>
            </section>

            <SizeStep value={flow.sizeUsd} onChange={flow.setSizeUsd} />
            <section className={styles.step}>
              <h3>5. Sign and place order</h3>
              <button type="button" className={styles.cta} disabled={flow.busy} onClick={() => void flow.submitIntent()}>
                Sign and place trade
              </button>
            </section>
          </>
        )}

        {flow.error && (
          <p className={styles.error}>
            {flow.error}
            {flow.error.includes('code:-32002') || flow.error.includes('code:-32001')
              ? ' Check your wallet extension popup and approve the pending request.'
              : ''}
          </p>
        )}
        {flow.success && <p className={styles.success}>{flow.success}</p>}
      </div>
    </div>
  );
}
