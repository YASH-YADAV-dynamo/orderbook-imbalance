'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { approveBroker, fetchAccountStatus, fetchOrderContext, placeTrade } from '@/lib/trading/executionClient';
import { placeHotstuffOrderWithSdk } from '@/lib/trading/hotstuff/placeOrderWithSdk';
import {
  connectEvmWalletWithOptions,
  disconnectEvmWalletSession,
  getConnectedEvmWalletAddress,
} from '@/lib/trading/wallet';
import {
  deriveHotstuffAgentAddress,
  getHotstuffAgentAddress,
  getHotstuffKnownAgentAddresses,
  getHotstuffAgentPrivateKey,
  setHotstuffActiveAgent,
} from '@/lib/trading/hotstuff/agentStorage';
import { generatePrivateKey } from 'viem/accounts';
import { useAgentRegistration } from './useAgentRegistration';
import type {
  AccountStatusResponse,
  ExecutionOrderType,
  ExecutionTif,
  PlaceIntentResponse,
  TradeIntent,
} from '@/types/trading';
import { appendTradingOrder, readTradingSessions, upsertTradingSession } from '@/lib/trading/profileStorage';

type FlowStep = 'connect' | 'agent' | 'size' | 'submit' | 'done';
export const TRADING_WALLET_STORAGE_KEY = 'trading_wallet_address_v1';
const TRADE_PREFS_STORAGE_KEY = 'trading_order_prefs_v1';

interface StoredTradePrefs {
  sizeUsd: string;
  orderType: ExecutionOrderType;
  timeInForce: ExecutionTif;
  slippagePct: string;
  limitPrice: string;
  rememberSettings: boolean;
}

export function useTradingFlow(intent: TradeIntent | null) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountStatusResponse | null>(null);
  const [sizeUsd, setSizeUsd] = useState('100');
  const [orderType, setOrderType] = useState<ExecutionOrderType>('market');
  const [timeInForce, setTimeInForce] = useState<ExecutionTif>('IOC');
  const [slippagePct, setSlippagePct] = useState('0.5');
  const [limitPrice, setLimitPrice] = useState('');
  const [rememberSettings, setRememberSettings] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [agentWalletAddress, setAgentWalletAddress] = useState('');
  const [agentPrivateKey, setAgentPrivateKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tradeResult, setTradeResult] = useState<PlaceIntentResponse | null>(null);
  const [selectedApiAgentId, setSelectedApiAgentId] = useState('');

  const exchange = intent?.exchange ?? 'hotstuff';
  const agent = useAgentRegistration(exchange, walletAddress);

  const refreshAccount = useCallback(async (address: string) => {
    const status = await fetchAccountStatus({ exchange, walletAddress: address });

    // Backend dev state can reset; fall back to most recent local session for same exchange+wallet.
    let nextStatus = status;
    if (!status.hasApiAgent || !status.apiAgentId) {
      const localSession = readTradingSessions().find(
        s => s.exchange === exchange && s.walletAddress.toLowerCase() === address.toLowerCase(),
      );
      if (localSession) {
        nextStatus = {
          ...status,
          hasApiAgent: true,
          apiAgentId: localSession.apiWalletAddress,
          canTrade: true,
          message: 'API agent restored from local session',
        };
      }
    }

    setAccount(nextStatus);
    if (nextStatus.apiAgentId) agent.setAgentId(nextStatus.apiAgentId);
    return nextStatus;
  }, [agent, exchange]);

  const availableApiAgents = useMemo(() => {
    if (!walletAddress) return [] as string[];
    const merged = exchange === 'hotstuff'
      ? getHotstuffKnownAgentAddresses(walletAddress)
      : [
        agent.agentId,
        account?.apiAgentId,
        ...readTradingSessions()
          .filter(s => s.exchange === exchange && s.walletAddress.toLowerCase() === walletAddress.toLowerCase())
          .map(s => s.apiWalletAddress),
      ];
    const normalized = merged.filter((v): v is string => Boolean(v && /^0x[a-fA-F0-9]{40}$/.test(v)));
    if (normalized.length === 0) return [] as string[];
    return Array.from(new Set(normalized.map(v => v.toLowerCase()))).map(
      lc => normalized.find(v => v.toLowerCase() === lc)!,
    );
  }, [account?.apiAgentId, agent.agentId, exchange, walletAddress]);

  useEffect(() => {
    if (availableApiAgents.length === 0) {
      if (selectedApiAgentId) setSelectedApiAgentId('');
      return;
    }

    const signerAgent = walletAddress && exchange === 'hotstuff'
      ? getHotstuffAgentAddress(walletAddress)
      : null;
    const signerMatch = signerAgent
      ? availableApiAgents.find(id => id.toLowerCase() === signerAgent.toLowerCase())
      : null;

    if (selectedApiAgentId && availableApiAgents.some(id => id.toLowerCase() === selectedApiAgentId.toLowerCase())) {
      return;
    }
    const preferred = signerMatch ?? availableApiAgents[0];
    setSelectedApiAgentId(preferred);
  }, [availableApiAgents, exchange, selectedApiAgentId, walletAddress]);

  useEffect(() => {
    if (!walletAddress || exchange !== 'hotstuff' || !selectedApiAgentId) return;
    setHotstuffActiveAgent(walletAddress, selectedApiAgentId);
  }, [exchange, selectedApiAgentId, walletAddress]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${TRADE_PREFS_STORAGE_KEY}:${exchange}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredTradePrefs>;
      if (parsed.sizeUsd) setSizeUsd(parsed.sizeUsd);
      if (parsed.orderType === 'market' || parsed.orderType === 'limit') setOrderType(parsed.orderType);
      if (parsed.timeInForce === 'IOC' || parsed.timeInForce === 'GTC') setTimeInForce(parsed.timeInForce);
      if (parsed.slippagePct) setSlippagePct(parsed.slippagePct);
      if (typeof parsed.limitPrice === 'string') setLimitPrice(parsed.limitPrice);
      if (typeof parsed.rememberSettings === 'boolean') setRememberSettings(parsed.rememberSettings);
    } catch {
      // Ignore bad local preferences and continue with defaults.
    }
  }, [exchange]);

  const connectWallet = useCallback(async (forcePrompt = false) => {
    setError(null);
    setBusy(true);
    try {
      const address = await connectEvmWalletWithOptions({ forcePrompt });
      setWalletAddress(address);
      window.localStorage.setItem(TRADING_WALLET_STORAGE_KEY, address.toLowerCase());
      try {
        await refreshAccount(address);
      } catch (statusError) {
        // Keep wallet connected even if backend status fetch fails.
        setError(statusError instanceof Error ? statusError.message : String(statusError));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [refreshAccount]);

  const disconnectWallet = useCallback(() => {
    disconnectEvmWalletSession();
    setWalletAddress(null);
    setAccount(null);
    agent.setAgentId(null);
    setSuccess(null);
    setError(null);
    setAgentWalletAddress('');
    setAgentPrivateKey('');
    window.localStorage.removeItem(TRADING_WALLET_STORAGE_KEY);
  }, [agent]);

  const changeWallet = useCallback(async () => {
    await connectWallet(true);
  }, [connectWallet]);

  useEffect(() => {
    if (walletAddress || busy) return;
    const cached = window.localStorage.getItem(TRADING_WALLET_STORAGE_KEY);
    if (!cached) return;

    let cancelled = false;
    const run = async () => {
      const connected = await getConnectedEvmWalletAddress();
      if (!connected || cancelled) return;

      const connectedLc = connected.toLowerCase();
      const cachedLc = cached.toLowerCase();
      if (connectedLc !== cachedLc) {
        window.localStorage.setItem(TRADING_WALLET_STORAGE_KEY, connectedLc);
      }
      setWalletAddress(connected);
      try {
        await refreshAccount(connected);
      } catch (statusError) {
        if (!cancelled) {
          setError(statusError instanceof Error ? statusError.message : String(statusError));
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [busy, refreshAccount, walletAddress]);

  const registerAgent = useCallback(async () => {
    if (!walletAddress) return;
    setError(null);
    setBusy(true);
    try {
      const trimmedAgentName = agentName.trim();
      if (!trimmedAgentName) throw new Error('Agent name is required.');
      if (trimmedAgentName.toLowerCase() === 'browser-agent') {
        throw new Error('Please choose a custom agent name.');
      }
      const normalizedPrivateKey = /^0x[a-fA-F0-9]{64}$/.test(agentPrivateKey.trim())
        ? (agentPrivateKey.trim() as `0x${string}`)
        : undefined;
      const registeredAgentId = await agent.run({
        agentName: trimmedAgentName,
        agentPrivateKey: normalizedPrivateKey,
      });
      setAgentWalletAddress(registeredAgentId);
      setAccount(prev => ({
        hasExchangeAccount: prev?.hasExchangeAccount ?? true,
        hasApiAgent: true,
        apiAgentId: registeredAgentId,
        canTrade: true,
        createAccountUrl: prev?.createAccountUrl,
        connectAccountUrl: prev?.connectAccountUrl,
        brokerApproved: prev?.brokerApproved,
        message: 'API agent already active',
      }));
      upsertTradingSession({
        exchange,
        walletAddress,
        agentName: trimmedAgentName,
        apiWalletAddress: registeredAgentId,
      });
      await refreshAccount(walletAddress);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (
        message.toLowerCase().includes('signer key is missing')
        || message.toLowerCase().includes('does not match signer key')
      ) {
        setSelectedApiAgentId('');
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [agent, agentName, agentPrivateKey, exchange, refreshAccount, walletAddress]);

  const useExistingAgent = useCallback(() => {
    const trimmed = agentWalletAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError('Agent wallet address must be a valid 0x address.');
      return;
    }
    agent.setAgentId(trimmed);
    setAccount(prev => ({
      hasExchangeAccount: prev?.hasExchangeAccount ?? true,
      hasApiAgent: true,
      apiAgentId: trimmed,
      canTrade: true,
      createAccountUrl: prev?.createAccountUrl,
      connectAccountUrl: prev?.connectAccountUrl,
      brokerApproved: prev?.brokerApproved,
      message: 'Using existing API agent',
    }));
    setError(null);
  }, [agent, agentWalletAddress]);

  const generateAgentCredentials = useCallback(() => {
    const trimmedName = agentName.trim();
    if (!trimmedName) {
      setError('Please enter agent name first.');
      return false;
    }
    if (trimmedName.toLowerCase() === 'browser-agent') {
      setError('Default agent name is not allowed. Use a custom name.');
      return false;
    }
    const generatedPrivateKey = generatePrivateKey();
    const generatedAddress = deriveHotstuffAgentAddress(generatedPrivateKey);
    setAgentPrivateKey(generatedPrivateKey);
    setAgentWalletAddress(generatedAddress);
    setError(null);
    return true;
  }, [agentName]);

  const generateAndActivateAgent = useCallback(async () => {
    if (!walletAddress) {
      setError('Connect wallet first.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const trimmedName = agentName.trim();
      if (!trimmedName) throw new Error('Please enter agent name first.');
      if (trimmedName.toLowerCase() === 'browser-agent') {
        throw new Error('Default agent name is not allowed. Use a custom name.');
      }
      const preparedPrivateKey = /^0x[a-fA-F0-9]{64}$/.test(agentPrivateKey.trim())
        ? (agentPrivateKey.trim() as `0x${string}`)
        : generatePrivateKey();
      const preparedAddress = deriveHotstuffAgentAddress(preparedPrivateKey);
      setAgentPrivateKey(preparedPrivateKey);
      setAgentWalletAddress(preparedAddress);

      const registeredAgentId = await agent.run({
        agentName: trimmedName,
        agentPrivateKey: preparedPrivateKey,
      });
      setAgentWalletAddress(registeredAgentId);
      setAccount(prev => ({
        hasExchangeAccount: prev?.hasExchangeAccount ?? true,
        hasApiAgent: true,
        apiAgentId: registeredAgentId,
        canTrade: true,
        createAccountUrl: prev?.createAccountUrl,
        connectAccountUrl: prev?.connectAccountUrl,
        brokerApproved: prev?.brokerApproved,
        message: 'API agent already active',
      }));
      upsertTradingSession({
        exchange,
        walletAddress,
        agentName: trimmedName,
        apiWalletAddress: registeredAgentId,
      });
      await refreshAccount(walletAddress);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [agent, agentName, agentPrivateKey, exchange, refreshAccount, walletAddress]);

  const approve = useCallback(async () => {
    if (!walletAddress) return;
    setError(null);
    setBusy(true);
    try {
      await approveBroker({
        exchange,
        walletAddress,
        apiAgentId: agent.agentId ?? account?.apiAgentId ?? undefined,
      });
      await refreshAccount(walletAddress);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [account?.apiAgentId, agent.agentId, exchange, refreshAccount, walletAddress]);

  const submitIntent = useCallback(async () => {
    if (!walletAddress || !intent) return;
    setError(null);
    setSuccess(null);
    setTradeResult(null);
    setBusy(true);
    try {
      if (orderType === 'limit') {
        const px = Number(limitPrice);
        if (!Number.isFinite(px) || px <= 0) {
          throw new Error('Enter a valid limit price.');
        }
      }
      if (orderType === 'market') {
        const slippage = Number(slippagePct);
        if (!Number.isFinite(slippage) || slippage < 0) {
          throw new Error('Enter a valid slippage percent.');
        }
      }
      let effectiveApiAgentId = selectedApiAgentId
        || (exchange === 'hotstuff'
          ? getHotstuffAgentAddress(walletAddress) ?? undefined
          : (agent.agentId ?? account?.apiAgentId ?? undefined));
      if (!effectiveApiAgentId) {
        throw new Error('No active API agent signer available. Activate API agent once in setup.');
      }
      const executeTrade = async (apiAgentId: string): Promise<PlaceIntentResponse> => {
        if (exchange === 'hotstuff') {
          const context = await fetchOrderContext({
            exchange,
            symbol: intent.symbol,
          });
          const sdkOrder = await placeHotstuffOrderWithSdk({
            walletAddress,
            apiAgentId,
            instrumentId: context.instrumentId,
            markPrice: context.markPrice,
            sizeUsd,
            side: intent.side,
            orderType,
            tif: timeInForce,
            slippagePct,
            limitPrice,
          });
          return {
            intentId: `intent_hotstuff_${Date.now()}`,
            status: 'accepted',
            message: sdkOrder.txHash
              ? 'Trade submitted via SDK'
              : 'Trade submitted via SDK; tx hash pending.',
            exchangeTxHash: sdkOrder.txHash,
            exchangeOrderId: sdkOrder.orderId,
            exchangeAddress: sdkOrder.exchangeAddress,
          };
        }

        return placeTrade({
          exchange,
          walletAddress,
          symbol: intent.symbol,
          side: intent.side,
          sizeUsd,
          apiAgentId,
          autoApproveBroker: true,
          orderType,
          tif: timeInForce,
          slippagePct,
          limitPrice,
        });
      };

      let response: PlaceIntentResponse;
      try {
        response = await executeTrade(effectiveApiAgentId);
      } catch (firstError) {
        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
        const lower = firstMessage.toLowerCase();
        const signerOrAgentStateError = exchange === 'hotstuff' && (
          lower.includes('invalid order signer')
          || lower.includes('api agent')
          || lower.includes('apiagent')
          || lower.includes('mismatch')
          || lower.includes('not configured')
          || lower === 'http 400'
        );
        if (!signerOrAgentStateError) throw firstError;

        const localAgentKey = getHotstuffAgentPrivateKey(walletAddress, effectiveApiAgentId);
        if (!localAgentKey) {
          throw new Error(
            'Signer key is missing or expired for this API agent. Re-activate API agent once in setup.',
          );
        }

        // Self-heal: re-activate selected API agent with EOA signature, then retry once.
        try {
          const repairedAgentId = await agent.run({
            agentPrivateKey: localAgentKey,
            agentName: agentName.trim() || undefined,
          });
          setSelectedApiAgentId(repairedAgentId);
          await refreshAccount(walletAddress);
          response = await executeTrade(repairedAgentId);
          effectiveApiAgentId = repairedAgentId;
        } catch (repairError) {
          const repairMessage = repairError instanceof Error ? repairError.message : String(repairError);
          throw new Error(`Trade failed after signer repair attempt: ${repairMessage}`);
        }
      }
      setTradeResult(response);
      if (rememberSettings) {
        const prefs: StoredTradePrefs = {
          sizeUsd,
          orderType,
          timeInForce,
          slippagePct,
          limitPrice,
          rememberSettings: true,
        };
        window.localStorage.setItem(`${TRADE_PREFS_STORAGE_KEY}:${exchange}`, JSON.stringify(prefs));
      } else {
        window.localStorage.removeItem(`${TRADE_PREFS_STORAGE_KEY}:${exchange}`);
      }
      if (response.executed && response.exchangeTxHash) {
        setSuccess(
          `Trade filled: ${response.exchangeTxHash}`
          + (response.exchangeOrderId ? ` | oid ${response.exchangeOrderId}` : '')
          + (response.executionPrice ? ` | px ${response.executionPrice}` : ''),
        );
      } else if (response.exchangeTxHash) {
        setSuccess(
          `Trade submitted: ${response.exchangeTxHash}`
          + (response.exchangeOrderId ? ` | oid ${response.exchangeOrderId}` : '')
          + (response.exchangeAddress ? ` | addr ${response.exchangeAddress}` : '')
          + ' | no fill detected yet.',
        );
      } else {
        setSuccess(response.message ?? 'Accepted');
      }
      appendTradingOrder({
        exchange,
        walletAddress,
        apiWalletAddress: effectiveApiAgentId ?? 'unknown',
        symbol: intent.symbol,
        side: intent.side,
        sizeUsd,
        status: response.status,
        exchangeTxHash: response.exchangeTxHash,
        message: response.message,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    account?.apiAgentId,
    agent.agentId,
    exchange,
    intent,
    limitPrice,
    orderType,
    sizeUsd,
    slippagePct,
    timeInForce,
    walletAddress,
    selectedApiAgentId,
  ]);

  const hasActiveAgent = useMemo(() => {
    if (!walletAddress) return false;
    if (exchange === 'hotstuff') return availableApiAgents.length > 0;
    return Boolean(account?.hasApiAgent || agent.agentId || availableApiAgents.length > 0);
  }, [account?.hasApiAgent, agent.agentId, availableApiAgents.length, exchange, walletAddress]);

  const step: FlowStep = useMemo(() => {
    if (success) return 'done';
    if (!walletAddress) return 'connect';
    if (!hasActiveAgent) return 'agent';
    if (!sizeUsd || Number(sizeUsd) <= 0) return 'size';
    return 'submit';
  }, [hasActiveAgent, sizeUsd, success, walletAddress]);

  return {
    walletAddress,
    account,
    sizeUsd,
    setSizeUsd,
    orderType,
    setOrderType,
    timeInForce,
    setTimeInForce,
    slippagePct,
    setSlippagePct,
    limitPrice,
    setLimitPrice,
    availableApiAgents,
    selectedApiAgentId,
    setSelectedApiAgentId,
    rememberSettings,
    setRememberSettings,
    agentName,
    setAgentName,
    agentWalletAddress,
    setAgentWalletAddress,
    agentPrivateKey,
    setAgentPrivateKey,
    generateAgentCredentials,
    generateAndActivateAgent,
    busy: busy || agent.running,
    error,
    success,
    tradeResult,
    step,
    hasApiAgent: hasActiveAgent,
    connectWallet,
    disconnectWallet,
    changeWallet,
    registerAgent,
    useExistingAgent,
    approve,
    submitIntent,
  };
}
