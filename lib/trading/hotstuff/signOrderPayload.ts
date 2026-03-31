'use client';

import { EXCHANGE_OP_CODES, signAction } from '@hotstuff-labs/ts-sdk';
import { createWalletClient, custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getActiveEvmProvider } from '@/lib/trading/wallet';
import type { ExecutionSide } from '@/types/trading';
import { getHotstuffAgentPrivateKey } from './agentStorage';
import { isHotstuffTestnet } from './network';

interface BuildArgs {
  walletAddress: string;
  instrumentId: number;
  markPrice: string;
  sizeUsd: string;
  side: ExecutionSide;
}

function toFixedSize(notionalUsd: number, markPrice: number): string {
  const raw = notionalUsd / markPrice;
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error('Unable to derive valid order size from mark price.');
  }
  return raw.toFixed(6);
}

export async function buildSignedHotstuffOrderPayload(args: BuildArgs): Promise<unknown> {
  const provider = getActiveEvmProvider();
  const eoaWallet = createWalletClient({
    account: args.walletAddress as `0x${string}`,
    transport: custom(provider),
  });
  const agentPrivateKey = getHotstuffAgentPrivateKey(args.walletAddress);
  const signingWallet = agentPrivateKey
    ? privateKeyToAccount(agentPrivateKey)
    : eoaWallet;

  const markPrice = Number(args.markPrice);
  const notionalUsd = Number(args.sizeUsd);
  if (!Number.isFinite(markPrice) || markPrice <= 0) {
    throw new Error('Invalid mark price for order placement.');
  }
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
    throw new Error('Invalid sizeUsd for order placement.');
  }

  const side = args.side === 'buy' ? 'b' : 's';
  const aggressivePx = args.side === 'buy'
    ? (markPrice * 1.01).toFixed(4)
    : (markPrice * 0.99).toFixed(4);
  const nonce = Date.now();

  const orderAction = {
    orders: [{
      instrumentId: args.instrumentId,
      side,
      positionSide: 'BOTH' as const,
      price: aggressivePx,
      size: toFixedSize(notionalUsd, markPrice),
      tif: 'IOC' as const,
      ro: false,
      po: false,
      cloid: `arb-${nonce}`,
      triggerPx: '0',
      isMarket: true,
      tpsl: '' as const,
      grouping: '' as const,
    }],
    expiresAfter: Date.now() + 60_000,
    nonce,
    ...(process.env.NEXT_PUBLIC_BROKER_ADDRESS && process.env.NEXT_PUBLIC_MAX_FEE_RATE
      ? {
        brokerConfig: {
          broker: process.env.NEXT_PUBLIC_BROKER_ADDRESS as `0x${string}`,
          fee: process.env.NEXT_PUBLIC_MAX_FEE_RATE,
        },
      }
      : {}),
  };

  const txType = EXCHANGE_OP_CODES.placeOrder;
  const testnet = isHotstuffTestnet();
  const signature = await signAction(
    {
      wallet: signingWallet,
      action: orderAction,
      txType,
    },
    { isTestnet: testnet },
  );

  return {
    action: {
      data: orderAction,
      type: String(txType),
    },
    signature,
    nonce,
  };
}
