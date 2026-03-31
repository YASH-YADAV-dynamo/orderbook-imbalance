'use client';

import { ExchangeClient, EXCHANGE_OP_CODES, HttpTransport } from '@hotstuff-labs/ts-sdk';
import { createWalletClient, custom, getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getActiveEvmProvider } from '@/lib/trading/wallet';
import { getHotstuffAgentPrivateKey, setHotstuffAgentPrivateKey } from './agentStorage';
import { getHotstuffHttpBase, isHotstuffTestnet } from './network';

interface Result {
  agentAddress: `0x${string}`;
  signedPayload: unknown;
}

export async function buildHotstuffAgentActivationPayload(
  walletAddress: string,
  agentName: string,
  providedAgentPrivateKey?: `0x${string}`,
): Promise<Result> {
  const owner = getAddress(walletAddress);
  const provider = getActiveEvmProvider();
  const eoaWallet = createWalletClient({
    account: owner as `0x${string}`,
    transport: custom(provider),
  });

  const existingPrivateKey = getHotstuffAgentPrivateKey(walletAddress);
  const agentPrivateKey = providedAgentPrivateKey ?? existingPrivateKey ?? generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivateKey);

  const validDays = Number(process.env.NEXT_PUBLIC_AGENT_VALID_DAYS || '30');
  const validUntil = Date.now() + Math.max(1, validDays) * 24 * 60 * 60 * 1000;
  const base = getHotstuffHttpBase();
  const testnet = isHotstuffTestnet();

  const transport = new HttpTransport({
    isTestnet: testnet,
    server: {
      mainnet: {
        api: base,
        rpc: base,
      },
      testnet: {
        api: base,
        rpc: base,
      },
    },
  });
  const exchange = new ExchangeClient({
    transport,
    wallet: eoaWallet,
  });
  const prepared = await exchange.addAgent(
    {
      agentName: agentName.trim() || 'browser-agent',
      agent: agentAccount.address,
      forAccount: owner,
      validUntil,
      agentPrivateKey,
      signer: owner,
    },
    false,
  ) as { params: Record<string, unknown> & { nonce?: number }; signature: string };
  const nonce = prepared.params.nonce ?? Date.now();

  const signedPayload = {
    action: {
      data: prepared.params,
      type: String(EXCHANGE_OP_CODES.addAgent),
    },
    signature: prepared.signature,
    nonce,
  };

  if (!existingPrivateKey || providedAgentPrivateKey) {
    setHotstuffAgentPrivateKey(walletAddress, agentPrivateKey);
  }

  return {
    agentAddress: agentAccount.address,
    signedPayload,
  };
}
