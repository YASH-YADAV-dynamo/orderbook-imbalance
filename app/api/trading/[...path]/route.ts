import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

type Exchange = 'pacifica' | 'hyperliquid';

interface AccountState {
  hasExchangeAccount: boolean;
  hasApiAgent: boolean;
  apiAgentId: string | null;
}

interface ChallengeState {
  exchange: Exchange;
  walletAddress: string;
  message: string;
  expiresAt: number;
}

const EXCHANGE_CREATE_URL: Record<Exchange, string> = {
  pacifica: 'https://app.pacifica.fi',
  hyperliquid: 'https://app.hyperliquid.xyz/trade',
};

const accounts = new Map<string, AccountState>();
const challenges = new Map<string, ChallengeState>();

function accountKey(exchange: Exchange, walletAddress: string): string {
  return `${exchange}:${walletAddress.toLowerCase()}`;
}

function isExchange(value: unknown): value is Exchange {
  return value === 'pacifica' || value === 'hyperliquid';
}

function isWalletAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function readBody<T>(req: NextRequest): Promise<T> {
  return req.json() as Promise<T>;
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function getOrInitAccount(exchange: Exchange, walletAddress: string): AccountState {
  const key = accountKey(exchange, walletAddress);
  const existing = accounts.get(key);
  if (existing) return existing;

  // Local Next-route mode: optimistic account existence so setup can continue.
  const initial: AccountState = {
    hasExchangeAccount: true,
    hasApiAgent: false,
    apiAgentId: null,
  };
  accounts.set(key, initial);
  return initial;
}

async function handleAccountStatus(req: NextRequest): Promise<Response> {
  const body = await readBody<{ exchange?: unknown; walletAddress?: unknown }>(req);
  if (!isExchange(body.exchange)) return jsonError('Invalid exchange', 400);
  if (!isWalletAddress(body.walletAddress)) return jsonError('Invalid wallet address', 400);

  const account = getOrInitAccount(body.exchange, body.walletAddress);
  return Response.json({
    hasExchangeAccount: account.hasExchangeAccount,
    hasApiAgent: account.hasApiAgent,
    apiAgentId: account.apiAgentId,
    canTrade: account.hasExchangeAccount && account.hasApiAgent,
    createAccountUrl: EXCHANGE_CREATE_URL[body.exchange],
    connectAccountUrl: EXCHANGE_CREATE_URL[body.exchange],
    message: account.hasApiAgent
      ? 'API agent already active'
      : 'Account found, API agent not created yet',
  });
}

async function handleAgentChallenge(req: NextRequest): Promise<Response> {
  const body = await readBody<{ exchange?: unknown; walletAddress?: unknown }>(req);
  if (!isExchange(body.exchange)) return jsonError('Invalid exchange', 400);
  if (!isWalletAddress(body.walletAddress)) return jsonError('Invalid wallet address', 400);

  const account = getOrInitAccount(body.exchange, body.walletAddress);
  if (!account.hasExchangeAccount) return jsonError('Account not found on exchange', 403);

  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + 60_000;
  const message = [
    'Authorize API agent creation',
    `Exchange: ${body.exchange}`,
    `Wallet: ${body.walletAddress}`,
    `Challenge: ${challengeId}`,
    `ExpiresAt: ${expiresAt}`,
  ].join('\n');

  challenges.set(challengeId, {
    exchange: body.exchange,
    walletAddress: body.walletAddress.toLowerCase(),
    message,
    expiresAt,
  });

  return Response.json({ challengeId, message, expiresAt });
}

async function handleAgentRegister(req: NextRequest): Promise<Response> {
  const body = await readBody<{
    exchange?: unknown;
    walletAddress?: unknown;
    challengeId?: unknown;
    signature?: unknown;
  }>(req);

  if (!isExchange(body.exchange)) return jsonError('Invalid exchange', 400);
  if (!isWalletAddress(body.walletAddress)) return jsonError('Invalid wallet address', 400);
  if (typeof body.challengeId !== 'string' || !body.challengeId) return jsonError('Missing challengeId', 400);
  if (typeof body.signature !== 'string' || body.signature.length < 10) return jsonError('Invalid signature format', 400);

  const ch = challenges.get(body.challengeId);
  if (!ch) return jsonError('Challenge not found or already used', 409);
  if (Date.now() > ch.expiresAt) {
    challenges.delete(body.challengeId);
    return jsonError('Challenge expired', 409);
  }
  if (ch.exchange !== body.exchange || ch.walletAddress !== body.walletAddress.toLowerCase()) {
    return jsonError('Challenge context mismatch', 401);
  }

  // Mark one-time use
  challenges.delete(body.challengeId);

  const key = accountKey(body.exchange, body.walletAddress);
  const account = getOrInitAccount(body.exchange, body.walletAddress);
  const agentId = account.apiAgentId ?? `agent_${body.exchange}_${crypto.randomUUID().slice(0, 8)}`;
  const updated: AccountState = {
    ...account,
    hasExchangeAccount: true,
    hasApiAgent: true,
    apiAgentId: agentId,
  };
  accounts.set(key, updated);

  return Response.json({
    agentId,
    status: 'active',
    message: 'API agent registered in Next server route',
  });
}

async function handleOrderIntent(req: NextRequest): Promise<Response> {
  const body = await readBody<{
    exchange?: unknown;
    walletAddress?: unknown;
    symbol?: unknown;
    side?: unknown;
    sizeUsd?: unknown;
    apiAgentId?: unknown;
  }>(req);

  if (!isExchange(body.exchange)) return jsonError('Invalid exchange', 400);
  if (!isWalletAddress(body.walletAddress)) return jsonError('Invalid wallet address', 400);
  if (typeof body.symbol !== 'string' || !body.symbol.includes('/')) return jsonError('Invalid symbol', 400);
  if (body.side !== 'buy' && body.side !== 'sell') return jsonError('Invalid side', 400);

  const size = typeof body.sizeUsd === 'string' ? Number(body.sizeUsd) : Number.NaN;
  if (!Number.isFinite(size) || size <= 0) return jsonError('Invalid sizeUsd', 400);

  const account = getOrInitAccount(body.exchange, body.walletAddress);
  if (!account.hasExchangeAccount) return jsonError('Account not found on exchange', 403);
  if (!account.hasApiAgent || !account.apiAgentId) return jsonError('API agent not configured', 403);

  if (typeof body.apiAgentId === 'string' && body.apiAgentId !== account.apiAgentId) {
    return jsonError('apiAgentId mismatch', 401);
  }

  const intentId = `intent_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  return Response.json({
    intentId,
    status: 'accepted',
    message: 'Intent accepted by Next server route',
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const p = await params;
  const key = p.path.join('/');

  try {
    if (key === 'account/status') return await handleAccountStatus(req);
    if (key === 'agent/challenge') return await handleAgentChallenge(req);
    if (key === 'agent/register') return await handleAgentRegister(req);
    if (key === 'orders/intent') return await handleOrderIntent(req);
    return jsonError('Route not found', 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(msg, 500);
  }
}

export async function GET(): Promise<Response> {
  return jsonError('Method not allowed', 405);
}

export async function PUT(): Promise<Response> {
  return jsonError('Method not allowed', 405);
}

export async function PATCH(): Promise<Response> {
  return jsonError('Method not allowed', 405);
}

export async function DELETE(): Promise<Response> {
  return jsonError('Method not allowed', 405);
}
