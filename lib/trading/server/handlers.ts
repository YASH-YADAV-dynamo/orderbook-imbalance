import type { NextRequest } from 'next/server';
import { getHotstuffServerConfig } from '@/lib/trading/hotstuffServerConfig';
import {
  ApproveBrokerSchema,
  AccountStatusSchema,
  AgentActivateSchema,
  AgentChallengeSchema,
  AgentRegisterSchema,
  OrderContextSchema,
  PlaceIntentSchema,
  type Exchange,
} from './schemas';
import { TRADING_ERRORS, TRADING_MESSAGES } from './messages';
import { deleteChallenge, getChallenge, getOrInitAccount, setChallenge, updateAccount } from './devState';
import { fetchHotstuffOrderContext, postHotstuffExchange } from './hotstuffHttp';

type Json = Record<string, unknown>;

export interface RouteHandlerContext {
  req: NextRequest;
}

type ExchangeHandler = {
  accountStatus: (input: Json) => Promise<Response>;
  challenge: (input: Json) => Promise<Response>;
  register: (input: Json) => Promise<Response>;
  activateAgent: (input: Json) => Promise<Response>;
  approveBroker: (input: Json) => Promise<Response>;
  orderContext: (input: Json) => Promise<Response>;
  orderIntent: (input: Json) => Promise<Response>;
};

const EXCHANGE_CREATE_URL: Record<Exchange, string> = {
  pacifica: 'https://app.pacifica.fi',
  hyperliquid: 'https://app.hyperliquid.xyz/trade',
  hotstuff: 'https://app.hotstuff.trade',
};

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function toNumber(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : Number.NaN;
}

function buildCommonHandler(exchange: Exchange): ExchangeHandler {
  return {
    async accountStatus(input) {
      const parsed = AccountStatusSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidExchange, 400);

      const account = getOrInitAccount(parsed.data.exchange, parsed.data.walletAddress);
      return Response.json({
        hasExchangeAccount: account.hasExchangeAccount,
        hasApiAgent: account.hasApiAgent,
        apiAgentId: account.apiAgentId,
        canTrade: account.hasExchangeAccount && account.hasApiAgent,
        createAccountUrl: EXCHANGE_CREATE_URL[exchange],
        connectAccountUrl: EXCHANGE_CREATE_URL[exchange],
        brokerApproved: account.brokerApproved,
        message: account.hasApiAgent ? TRADING_MESSAGES.accountReadyWithAgent : TRADING_MESSAGES.accountReadyNoAgent,
      });
    },
    async challenge(input) {
      const parsed = AgentChallengeSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidExchange, 400);

      const challengeId = crypto.randomUUID();
      const expiresAt = Date.now() + 60_000;
      const message = [
        'Authorize API agent creation',
        `Exchange: ${exchange}`,
        `Wallet: ${parsed.data.walletAddress}`,
        `Challenge: ${challengeId}`,
        `ExpiresAt: ${expiresAt}`,
      ].join('\n');

      setChallenge(challengeId, {
        exchange,
        walletAddress: parsed.data.walletAddress.toLowerCase(),
        message,
        expiresAt,
      });

      return Response.json({ challengeId, message, expiresAt });
    },
    async register(input) {
      const parsed = AgentRegisterSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidSignature, 400);

      const challenge = getChallenge(parsed.data.challengeId);
      if (!challenge) return jsonError(TRADING_ERRORS.challengeNotFound, 409);
      if (Date.now() > challenge.expiresAt) {
        deleteChallenge(parsed.data.challengeId);
        return jsonError(TRADING_ERRORS.challengeExpired, 409);
      }
      if (challenge.exchange !== exchange || challenge.walletAddress !== parsed.data.walletAddress.toLowerCase()) {
        return jsonError(TRADING_ERRORS.challengeMismatch, 401);
      }

      deleteChallenge(parsed.data.challengeId);
      const existing = getOrInitAccount(exchange, parsed.data.walletAddress);
      const agentId = existing.apiAgentId || `agent_${exchange}_${crypto.randomUUID().slice(0, 8)}`;
      updateAccount(exchange, parsed.data.walletAddress, {
        hasExchangeAccount: true,
        hasApiAgent: true,
        apiAgentId: agentId,
      });

      return Response.json({
        agentId,
        status: 'active',
        message: TRADING_MESSAGES.agentRegistered,
      });
    },
    async approveBroker(input) {
      const parsed = ApproveBrokerSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidExchange, 400);
      const account = getOrInitAccount(exchange, parsed.data.walletAddress);
      if (!account.hasApiAgent || !account.apiAgentId) return jsonError(TRADING_ERRORS.apiAgentNotConfigured, 403);
      if (parsed.data.apiAgentId && parsed.data.apiAgentId !== account.apiAgentId) {
        return jsonError(TRADING_ERRORS.apiAgentMismatch, 401);
      }

      updateAccount(exchange, parsed.data.walletAddress, { brokerApproved: true });
      return Response.json({
        approvalId: `approval_${exchange}_${crypto.randomUUID().slice(0, 8)}`,
        status: 'approved',
        message: TRADING_MESSAGES.brokerApproved,
      });
    },
    async orderIntent(input) {
      const parsed = PlaceIntentSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidExchange, 400);
      const size = toNumber(parsed.data.sizeUsd);
      if (!Number.isFinite(size) || size <= 0) return jsonError(TRADING_ERRORS.invalidSizeUsd, 400);

      const account = getOrInitAccount(exchange, parsed.data.walletAddress);
      if (!account.hasApiAgent || !account.apiAgentId) return jsonError(TRADING_ERRORS.apiAgentNotConfigured, 403);
      if (parsed.data.apiAgentId && parsed.data.apiAgentId !== account.apiAgentId) {
        return jsonError(TRADING_ERRORS.apiAgentMismatch, 401);
      }

      return Response.json({
        intentId: `intent_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        status: 'accepted',
        message: TRADING_MESSAGES.intentAccepted,
      });
    },
    async orderContext(input) {
      const parsed = OrderContextSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidSymbol, 400);
      return jsonError('Order context not supported for this exchange', 400);
    },
    async activateAgent() {
      return jsonError('Agent activation not supported for this exchange', 400);
    },
  };
}

function buildHotstuffHandler(): ExchangeHandler {
  const base = buildCommonHandler('hotstuff');
  return {
    ...base,
    async approveBroker(input) {
      const parsed = ApproveBrokerSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidExchange, 400);

      const config = getHotstuffServerConfig();
      if (parsed.data.signedApprovalPayload) {
        await postHotstuffExchange(parsed.data.signedApprovalPayload);
      }
      updateAccount('hotstuff', parsed.data.walletAddress, {
        brokerApproved: true,
        hasApiAgent: true,
        apiAgentId: parsed.data.apiAgentId ?? getOrInitAccount('hotstuff', parsed.data.walletAddress).apiAgentId,
      });
      return Response.json({
        approvalId: `approval_hotstuff_${crypto.randomUUID().slice(0, 8)}`,
        status: parsed.data.signedApprovalPayload ? 'approved' : 'pending',
        message: parsed.data.signedApprovalPayload
          ? (config.brokerAddress
            ? `${TRADING_MESSAGES.brokerApproved} (${config.brokerAddress})`
            : TRADING_MESSAGES.brokerApproved)
          : TRADING_MESSAGES.brokerPending,
      });
    },
    async orderIntent(input) {
      const parsed = PlaceIntentSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidExchange, 400);
      const size = toNumber(parsed.data.sizeUsd);
      if (!Number.isFinite(size) || size <= 0) return jsonError(TRADING_ERRORS.invalidSizeUsd, 400);

      let txHash: string | undefined;
      let status: 'accepted' | 'queued' = 'accepted';
      let message: string = TRADING_MESSAGES.intentAccepted;

      if (parsed.data.signedOrderPayload) {
        const result = (await postHotstuffExchange(parsed.data.signedOrderPayload)) as { tx_hash?: string };
        txHash = result.tx_hash;
      } else {
        status = 'queued';
        message = TRADING_MESSAGES.intentQueued;
      }

      return Response.json({
        intentId: `intent_hotstuff_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        status,
        message,
        exchangeTxHash: txHash,
      });
    },
    async orderContext(input) {
      const parsed = OrderContextSchema.safeParse(input);
      if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidSymbol, 400);
      const context = await fetchHotstuffOrderContext(parsed.data.symbol);
      return Response.json(context);
    },
    async activateAgent(input) {
      const parsed = AgentActivateSchema.safeParse(input);
      if (!parsed.success) {
        return jsonError(parsed.error.issues[0]?.message || TRADING_ERRORS.invalidWalletAddress, 400);
      }

      await postHotstuffExchange(parsed.data.signedAgentPayload);
      updateAccount('hotstuff', parsed.data.walletAddress, {
        hasApiAgent: true,
        apiAgentId: parsed.data.apiAgentId,
      });

      return Response.json({
        agentId: parsed.data.apiAgentId,
        status: 'active',
        message: TRADING_MESSAGES.agentRegistered,
      });
    },
  };
}

const HANDLERS: Record<Exchange, ExchangeHandler> = {
  pacifica: buildCommonHandler('pacifica'),
  hyperliquid: buildCommonHandler('hyperliquid'),
  hotstuff: buildHotstuffHandler(),
};

export function getExchangeHandler(exchange: Exchange): ExchangeHandler {
  return HANDLERS[exchange];
}

export async function parseJson(req: NextRequest): Promise<Json> {
  return (await req.json()) as Json;
}
