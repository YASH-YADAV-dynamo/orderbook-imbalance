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
import { fetchHotstuffOrderContext, findHotstuffTradeByTxHash, postHotstuffExchange } from './hotstuffHttp';

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

function extractTxHash(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const rec = result as Record<string, unknown>;
  const direct = rec.tx_hash ?? rec.txHash ?? rec.hash;
  if (typeof direct === 'string' && direct) return direct;
  return undefined;
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
      if (parsed.data.autoApproveBroker && !account.brokerApproved) {
        updateAccount(exchange, parsed.data.walletAddress, { brokerApproved: true });
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
      const account = getOrInitAccount('hotstuff', parsed.data.walletAddress);
      let effectiveApiAgentId = parsed.data.apiAgentId ?? account.apiAgentId;
      if (!effectiveApiAgentId) return jsonError(TRADING_ERRORS.apiAgentNotConfigured, 403);
      if (account.apiAgentId && parsed.data.apiAgentId && parsed.data.apiAgentId !== account.apiAgentId) {
        // Allow switching between multiple active agents; persist the currently used one.
        effectiveApiAgentId = parsed.data.apiAgentId;
      }
      if (parsed.data.signedApprovalPayload) {
        try {
          await postHotstuffExchange(parsed.data.signedApprovalPayload);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return jsonError(message, 400);
        }
      }
      updateAccount('hotstuff', parsed.data.walletAddress, {
        brokerApproved: true,
        hasApiAgent: true,
        apiAgentId: effectiveApiAgentId,
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
      const account = getOrInitAccount('hotstuff', parsed.data.walletAddress);
      let effectiveApiAgentId = parsed.data.apiAgentId ?? account.apiAgentId;
      if (!effectiveApiAgentId) return jsonError(TRADING_ERRORS.apiAgentNotConfigured, 403);
      if (parsed.data.apiAgentId && account.apiAgentId && parsed.data.apiAgentId !== account.apiAgentId) {
        // Allow switching between multiple active agents; persist the currently used one.
        effectiveApiAgentId = parsed.data.apiAgentId;
      }
      if (!account.hasApiAgent || !account.apiAgentId || account.apiAgentId !== effectiveApiAgentId) {
        updateAccount('hotstuff', parsed.data.walletAddress, {
          hasApiAgent: true,
          apiAgentId: effectiveApiAgentId,
        });
      }
      if (parsed.data.autoApproveBroker && !account.brokerApproved) {
        updateAccount('hotstuff', parsed.data.walletAddress, { brokerApproved: true });
      }
      if (!parsed.data.signedOrderPayload) {
        return jsonError(TRADING_ERRORS.signedOrderPayloadRequired, 400);
      }
      let exchangeResult: unknown;
      try {
        exchangeResult = await postHotstuffExchange(parsed.data.signedOrderPayload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonError(message, 400);
      }
      const txHash = extractTxHash(exchangeResult);
      const orderId = extractOrderId(exchangeResult);
      const exchangeAddress = extractExchangeAddress(exchangeResult);
      let executed = false;
      let executionPrice: string | undefined;
      let executionSize: string | undefined;
      let executionTimestamp: string | undefined;

      if (txHash) {
        try {
          const matchedTrade = await findHotstuffTradeByTxHash(parsed.data.symbol, txHash);
          if (matchedTrade) {
            executed = true;
            executionPrice = matchedTrade.price != null ? String(matchedTrade.price) : undefined;
            executionSize = matchedTrade.size != null ? String(matchedTrade.size) : undefined;
            executionTimestamp = matchedTrade.timestamp != null ? String(matchedTrade.timestamp) : undefined;
          }
        } catch {
          // Keep placement successful even if verification query fails.
        }
      }

      return Response.json({
        intentId: `intent_hotstuff_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        status: 'accepted',
        message: executed
          ? TRADING_MESSAGES.intentAccepted
          : 'Trade submitted to exchange; no fill found yet.',
        exchangeTxHash: txHash,
        exchangeOrderId: orderId,
        exchangeAddress,
        executed,
        executionPrice,
        executionSize,
        executionTimestamp,
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

      try {
        await postHotstuffExchange(parsed.data.signedAgentPayload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonError(message, 400);
      }
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
