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

function OrderOptionsStep({
  orderType,
  onOrderTypeChange,
  timeInForce,
  onTimeInForceChange,
  slippagePct,
  onSlippagePctChange,
  limitPrice,
  onLimitPriceChange,
  rememberSettings,
  onRememberSettingsChange,
}: {
  orderType: 'market' | 'limit';
  onOrderTypeChange: (v: 'market' | 'limit') => void;
  timeInForce: 'IOC' | 'GTC';
  onTimeInForceChange: (v: 'IOC' | 'GTC') => void;
  slippagePct: string;
  onSlippagePctChange: (v: string) => void;
  limitPrice: string;
  onLimitPriceChange: (v: string) => void;
  rememberSettings: boolean;
  onRememberSettingsChange: (v: boolean) => void;
}) {
  return (
    <section className={styles.step}>
      <h3>2. Order options</h3>
      <div className={styles.row}>
        <select
          className={styles.input}
          value={orderType}
          onChange={e => onOrderTypeChange(e.target.value as 'market' | 'limit')}
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
        </select>

        <select
          className={styles.input}
          value={timeInForce}
          onChange={e => onTimeInForceChange(e.target.value as 'IOC' | 'GTC')}
          disabled={orderType === 'market'}
        >
          <option value="IOC">IOC</option>
          <option value="GTC">GTC</option>
        </select>
      </div>

      {orderType === 'market' ? (
        <input
          className={styles.input}
          type="number"
          min="0"
          step="0.1"
          placeholder="Slippage %"
          value={slippagePct}
          onChange={e => onSlippagePctChange(e.target.value)}
        />
      ) : (
        <input
          className={styles.input}
          type="number"
          min="0.0001"
          step="0.0001"
          placeholder="Limit price"
          value={limitPrice}
          onChange={e => onLimitPriceChange(e.target.value)}
        />
      )}

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={rememberSettings}
          onChange={e => onRememberSettingsChange(e.target.checked)}
        />
        <span>Remember settings for next trade</span>
      </label>
    </section>
  );
}

function AgentSelectorStep({
  agents,
  selectedAgent,
  onSelectedAgentChange,
}: {
  agents: string[];
  selectedAgent: string;
  onSelectedAgentChange: (v: string) => void;
}) {
  if (agents.length <= 1) return null;
  return (
    <section className={styles.step}>
      <h3>2. API agent</h3>
      <p>Multiple active agents found. Choose the one to trade with.</p>
      <select
        className={styles.input}
        value={selectedAgent}
        onChange={e => onSelectedAgentChange(e.target.value)}
      >
        {agents.map(id => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </section>
  );
}

function AgentSetupStep({
  agentName,
  onAgentNameChange,
  onActivate,
  busy,
  agentPrivateKey,
}: {
  agentName: string;
  onAgentNameChange: (v: string) => void;
  onActivate: () => Promise<void>;
  busy: boolean;
  agentPrivateKey: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <section className={styles.step}>
      <h3>2. Setup API agent</h3>
      <p>Create and activate your API agent here. No redirect needed.</p>
      <input
        className={styles.input}
        type="text"
        value={agentName}
        onChange={e => onAgentNameChange(e.target.value)}
        placeholder="Agent name"
      />
      <button
        type="button"
        className={styles.cta}
        disabled={busy || !agentName.trim()}
        onClick={() => void onActivate()}
      >
        Activate API agent
      </button>

      {agentPrivateKey && (
        <div className={styles.warning}>
          <p>Private key generated. Save it securely before placing trades.</p>
          <div className={styles.copyRow}>
            <code>{agentPrivateKey}</code>
            <button
              type="button"
              className={styles.secondary}
              onClick={async () => {
                await navigator.clipboard.writeText(agentPrivateKey);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              Copy key
            </button>
          </div>
          {copied && <p className={styles.hint}>Copied.</p>}
        </div>
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
      <h3>3. Position size (USD)</h3>
      <input
        className={styles.input}
        min="0.001"
        max="50000"
        step="0.001"
        value={value}
        onChange={e => onChange(e.target.value)}
        type="number"
      />
      <input
        className={styles.slider}
        min="0.001"
        max="50000"
        step="0.001"
        value={value}
        onChange={e => onChange(e.target.value)}
        type="range"
      />
    </section>
  );
}

export default function TradeExecutionModal({ intent, onClose }: TradeExecutionModalProps) {
  const flow = useTradingFlow(intent);
  const [showOrderSettings, setShowOrderSettings] = useState(false);
  const canTrade = Boolean(flow.walletAddress && flow.hasApiAgent);
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

        {flow.walletAddress && !flow.hasApiAgent && (
          <AgentSetupStep
            agentName={flow.agentName}
            onAgentNameChange={flow.setAgentName}
            onActivate={flow.generateAndActivateAgent}
            busy={flow.busy}
            agentPrivateKey={flow.agentPrivateKey}
          />
        )}

        {flow.walletAddress && (
          <>
            <AgentSelectorStep
              agents={flow.availableApiAgents}
              selectedAgent={flow.selectedApiAgentId}
              onSelectedAgentChange={flow.setSelectedApiAgentId}
            />
            <section className={styles.step}>
              <h3>{flow.availableApiAgents.length > 1 ? '3. Order' : '2. Order'}</h3>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setShowOrderSettings(prev => !prev)}
                disabled={!canTrade}
              >
                {showOrderSettings ? 'Hide settings' : 'Edit settings'}
              </button>
              {!canTrade && <p className={styles.hint}>Activate API agent to enable trading.</p>}
            </section>
            {showOrderSettings && (
              <OrderOptionsStep
                orderType={flow.orderType}
                onOrderTypeChange={flow.setOrderType}
                timeInForce={flow.timeInForce}
                onTimeInForceChange={flow.setTimeInForce}
                slippagePct={flow.slippagePct}
                onSlippagePctChange={flow.setSlippagePct}
                limitPrice={flow.limitPrice}
                onLimitPriceChange={flow.setLimitPrice}
                rememberSettings={flow.rememberSettings}
                onRememberSettingsChange={flow.setRememberSettings}
              />
            )}
            <SizeStep value={flow.sizeUsd} onChange={flow.setSizeUsd} />
            <section className={styles.step}>
              <h3>{flow.availableApiAgents.length > 1 ? '4. Trade' : '3. Trade'}</h3>
              <button type="button" className={styles.cta} disabled={flow.busy || !canTrade} onClick={() => void flow.submitIntent()}>
                Trade
              </button>
              <p className={styles.hint}>One tap trade with saved settings.</p>
              {flow.tradeResult?.exchangeTxHash && <p className={styles.hint}>Tx: {flow.tradeResult.exchangeTxHash}</p>}
              {flow.tradeResult?.exchangeOrderId && <p className={styles.hint}>Order ID: {flow.tradeResult.exchangeOrderId}</p>}
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
