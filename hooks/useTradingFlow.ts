'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { approveBroker, fetchAccountStatus, fetchOrderContext, placeTradeIntent } from '@/lib/trading/executionClient';
import { buildSignedHotstuffOrderPayload } from '@/lib/trading/hotstuff/signOrderPayload';
import {
  connectEvmWalletWithOptions,
  disconnectEvmWalletSession,
  getConnectedEvmWalletAddress,
} from '@/lib/trading/wallet';
import { deriveHotstuffAgentAddress } from '@/lib/trading/hotstuff/agentStorage';
import { generatePrivateKey } from 'viem/accounts';
import { useAgentRegistration } from './useAgentRegistration';
import type { AccountStatusResponse, TradeIntent } from '@/types/trading';
import { appendTradingOrder, upsertTradingSession } from '@/lib/trading/profileStorage';

type FlowStep = 'connect' | 'agent' | 'size' | 'submit' | 'done';
const WALLET_STORAGE_KEY = 'trading_wallet_address_v1';

export function useTradingFlow(intent: TradeIntent | null) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountStatusResponse | null>(null);
  const [sizeUsd, setSizeUsd] = useState('100');
  const [agentName, setAgentName] = useState('');
  const [agentWalletAddress, setAgentWalletAddress] = useState('');
  const [agentPrivateKey, setAgentPrivateKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const exchange = intent?.exchange ?? 'hotstuff';
  const agent = useAgentRegistration(exchange, walletAddress);

  const refreshAccount = useCallback(async (address: string) => {
    const status = await fetchAccountStatus({ exchange, walletAddress: address });
    setAccount(status);
    if (status.apiAgentId) agent.setAgentId(status.apiAgentId);
    return status;
  }, [agent, exchange]);

  const connectWallet = useCallback(async (forcePrompt = false) => {
    setError(null);
    setBusy(true);
    try {
      const address = await connectEvmWalletWithOptions({ forcePrompt });
      setWalletAddress(address);
      window.localStorage.setItem(WALLET_STORAGE_KEY, address.toLowerCase());
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
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
  }, [agent]);

  const changeWallet = useCallback(async () => {
    await connectWallet(true);
  }, [connectWallet]);

  useEffect(() => {
    if (!intent || walletAddress || busy) return;
    const cached = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (!cached) return;

    let cancelled = false;
    const run = async () => {
      const connected = await getConnectedEvmWalletAddress();
      if (!connected || cancelled) return;

      const connectedLc = connected.toLowerCase();
      const cachedLc = cached.toLowerCase();
      if (connectedLc !== cachedLc) {
        window.localStorage.setItem(WALLET_STORAGE_KEY, connectedLc);
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
  }, [busy, intent, refreshAccount, walletAddress]);

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
      setError(e instanceof Error ? e.message : String(e));
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
    setBusy(true);
    try {
      let signedOrderPayload: unknown;
      if (exchange === 'hotstuff') {
        const context = await fetchOrderContext({
          exchange,
          symbol: intent.symbol,
        });
        signedOrderPayload = await buildSignedHotstuffOrderPayload({
          walletAddress,
          instrumentId: context.instrumentId,
          markPrice: context.markPrice,
          sizeUsd,
          side: intent.side,
        });
      }

      const response = await placeTradeIntent({
        exchange,
        walletAddress,
        symbol: intent.symbol,
        side: intent.side,
        sizeUsd,
        apiAgentId: agent.agentId ?? account?.apiAgentId ?? undefined,
        signedOrderPayload,
      });
      setSuccess(response.exchangeTxHash
        ? `Order placed: ${response.exchangeTxHash}`
        : (response.message ?? 'Accepted'));
      appendTradingOrder({
        exchange,
        walletAddress,
        apiWalletAddress: agent.agentId ?? account?.apiAgentId ?? 'unknown',
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
  }, [account?.apiAgentId, agent.agentId, exchange, intent, sizeUsd, walletAddress]);

  const step: FlowStep = useMemo(() => {
    if (success) return 'done';
    if (!walletAddress) return 'connect';
    if (!account?.hasApiAgent) return 'agent';
    if (!sizeUsd || Number(sizeUsd) <= 0) return 'size';
    return 'submit';
  }, [account?.hasApiAgent, sizeUsd, success, walletAddress]);

  return {
    walletAddress,
    account,
    sizeUsd,
    setSizeUsd,
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
    step,
    connectWallet,
    disconnectWallet,
    changeWallet,
    registerAgent,
    useExistingAgent,
    approve,
    submitIntent,
  };
}
