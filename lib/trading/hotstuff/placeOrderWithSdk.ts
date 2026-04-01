'use client';

import { ExchangeClient, HttpTransport } from '@hotstuff-labs/ts-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import type { ExecutionOrderType, ExecutionSide, ExecutionTif } from '@/types/trading';
import { getHotstuffAgentPrivateKey } from './agentStorage';
import { getHotstuffHttpBase, isHotstuffTestnet } from './network';

interface PlaceWithSdkArgs {
  walletAddress: string;
  apiAgentId?: string;
  instrumentId: number;
  markPrice: string;
  sizeUsd: string;
  side: ExecutionSide;
  orderType: ExecutionOrderType;
  tif: ExecutionTif;
  slippagePct: string;
  limitPrice: string;
}

interface SdkPlaceOrderResult {
  raw: unknown;
  txHash?: string;
  orderId?: string;
  exchangeAddress?: string;
}

function toFixedSize(notionalUsd: number, markPrice: number): string {
  const raw = notionalUsd / markPrice;
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error('Unable to derive valid order size from mark price.');
  }
  return raw.toFixed(6);
}

function extractTxHash(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const rec = result as Record<string, unknown>;
  const direct = rec.tx_hash ?? rec.txHash ?? rec.hash;
  return typeof direct === 'string' && direct ? direct : undefined;
}

function extractExchangeAddress(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const rec = result as Record<string, unknown>;
  return typeof rec.address === 'string' && rec.address ? rec.address : undefined;
}

function extractOrderId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const rec = result as Record<string, unknown>;
  const data = rec.data;
  if (!data || typeof data !== 'object') return undefined;
  const status = (data as Record<string, unknown>).status;
  if (!status) return undefined;
  if (typeof status === 'object' && !Array.isArray(status)) {
    const oid = (status as Record<string, unknown>).oid;
    if (typeof oid === 'number' || typeof oid === 'string') return String(oid);
  }
  if (Array.isArray(status)) {
    for (const entry of status) {
      if (!entry || typeof entry !== 'object') continue;
      const maybeObj = entry as Record<string, unknown>;
      if (typeof maybeObj.oid === 'number' || typeof maybeObj.oid === 'string') return String(maybeObj.oid);
      const nested = maybeObj.success;
      if (nested && typeof nested === 'object') {
        const nestedOid = (nested as Record<string, unknown>).oid;
        if (typeof nestedOid === 'number' || typeof nestedOid === 'string') return String(nestedOid);
      }
    }
  }
  return undefined;
}

export async function placeHotstuffOrderWithSdk(args: PlaceWithSdkArgs): Promise<SdkPlaceOrderResult> {
  const agentPrivateKey = getHotstuffAgentPrivateKey(args.walletAddress, args.apiAgentId);
  if (!agentPrivateKey) {
    throw new Error('API agent signer key is missing on this browser. Re-activate API agent in setup once.');
  }
  const signingWallet = privateKeyToAccount(agentPrivateKey);
  if (args.apiAgentId && signingWallet.address.toLowerCase() !== args.apiAgentId.toLowerCase()) {
    throw new Error('Active API agent does not match signer key. Re-activate API agent to sync signer.');
  }

  const markPrice = Number(args.markPrice);
  const notionalUsd = Number(args.sizeUsd);
  if (!Number.isFinite(markPrice) || markPrice <= 0) {
    throw new Error('Invalid mark price for order placement.');
  }
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
    throw new Error('Invalid sizeUsd for order placement.');
  }

  const side = args.side === 'buy' ? 'b' : 's';
  const slippage = Number(args.slippagePct);
  const safeSlippage = Number.isFinite(slippage) && slippage >= 0 ? slippage : 1;
  const marketPx = args.side === 'buy'
    ? (markPrice * (1 + safeSlippage / 100)).toFixed(4)
    : (markPrice * (1 - safeSlippage / 100)).toFixed(4);
  const parsedLimitPrice = Number(args.limitPrice);
  const limitPx = Number.isFinite(parsedLimitPrice) && parsedLimitPrice > 0
    ? parsedLimitPrice.toFixed(4)
    : markPrice.toFixed(4);
  const finalPrice = args.orderType === 'market' ? marketPx : limitPx;
  const finalTif = args.orderType === 'market' ? 'IOC' : args.tif;
  const nonce = Date.now();

  const base = getHotstuffHttpBase();
  const testnet = isHotstuffTestnet();
  const transport = new HttpTransport({
    isTestnet: testnet,
    server: {
      mainnet: { api: base, rpc: base },
      testnet: { api: base, rpc: base },
    },
  });
  const exchange = new ExchangeClient({
    transport,
    wallet: signingWallet,
  });

  const raw = await exchange.placeOrder({
    orders: [{
      instrumentId: args.instrumentId,
      side,
      positionSide: 'BOTH',
      price: finalPrice,
      size: toFixedSize(notionalUsd, markPrice),
      tif: finalTif,
      ro: false,
      po: false,
      cloid: `arb-${nonce}`,
      triggerPx: '0',
      isMarket: args.orderType === 'market',
      tpsl: '',
      grouping: '',
    }],
    expiresAfter: Date.now() + 60_000,
    ...(process.env.NEXT_PUBLIC_BROKER_ADDRESS && process.env.NEXT_PUBLIC_MAX_FEE_RATE
      ? {
        brokerConfig: {
          broker: process.env.NEXT_PUBLIC_BROKER_ADDRESS as `0x${string}`,
          fee: process.env.NEXT_PUBLIC_MAX_FEE_RATE,
        },
      }
      : {}),
  });

  return {
    raw,
    txHash: extractTxHash(raw),
    orderId: extractOrderId(raw),
    exchangeAddress: extractExchangeAddress(raw),
  };
}
