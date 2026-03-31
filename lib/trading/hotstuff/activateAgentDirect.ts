'use client';

import { ExchangeClient, HttpTransport } from '@hotstuff-labs/ts-sdk';
import { createWalletClient, custom, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getActiveEvmProvider } from '@/lib/trading/wallet';
import { ensureHotstuffAgentPrivateKey } from './agentStorage';
import { getHotstuffHttpBase, isHotstuffTestnet } from './network';

export async function activateHotstuffAgentDirect(walletAddress: string): Promise<`0x${string}`> {
  return activateHotstuffAgentDirectWithKey(walletAddress, ensureHotstuffAgentPrivateKey(walletAddress));
}

export async function activateHotstuffAgentDirectWithKey(
  walletAddress: string,
  agentPrivateKey: `0x${string}`,
): Promise<`0x${string}`> {
  const owner = getAddress(walletAddress);
  const agentAddress = privateKeyToAccount(agentPrivateKey).address;
  const provider = getActiveEvmProvider();
  const eoaWallet = createWalletClient({
    account: owner as `0x${string}`,
    transport: custom(provider),
  });

  const validDays = Number(process.env.NEXT_PUBLIC_AGENT_VALID_DAYS || '30');
  const validUntil = Date.now() + Math.max(1, validDays) * 24 * 60 * 60 * 1000;
  const base = getHotstuffHttpBase();
  const testnet = isHotstuffTestnet();
  const transport = new HttpTransport({
    isTestnet: testnet,
    server: {
      mainnet: { api: base, rpc: base },
      testnet: { api: base, rpc: base },
    },
  });
  const exchange = new ExchangeClient({ transport, wallet: eoaWallet });

  await exchange.addAgent({
    agentName: 'browser-agent',
    agent: agentAddress,
    forAccount: owner,
    validUntil,
    agentPrivateKey,
    signer: owner,
  });

  return agentAddress;
}
