import type { Exchange } from './schemas';

interface AccountState {
  hasExchangeAccount: boolean;
  hasApiAgent: boolean;
  apiAgentId: string | null;
  brokerApproved: boolean;
}

interface ChallengeState {
  exchange: Exchange;
  walletAddress: string;
  message: string;
  expiresAt: number;
}

const accounts = new Map<string, AccountState>();
const challenges = new Map<string, ChallengeState>();

const DEFAULT_ACCOUNT: AccountState = {
  hasExchangeAccount: true,
  hasApiAgent: false,
  apiAgentId: null,
  brokerApproved: false,
};

export function accountKey(exchange: Exchange, walletAddress: string): string {
  return `${exchange}:${walletAddress.toLowerCase()}`;
}

export function getOrInitAccount(exchange: Exchange, walletAddress: string): AccountState {
  const key = accountKey(exchange, walletAddress);
  const existing = accounts.get(key);
  if (existing) return existing;
  accounts.set(key, { ...DEFAULT_ACCOUNT });
  return accounts.get(key)!;
}

export function updateAccount(
  exchange: Exchange,
  walletAddress: string,
  patch: Partial<AccountState>,
): AccountState {
  const key = accountKey(exchange, walletAddress);
  const next = { ...getOrInitAccount(exchange, walletAddress), ...patch };
  accounts.set(key, next);
  return next;
}

export function setChallenge(challengeId: string, challenge: ChallengeState): void {
  challenges.set(challengeId, challenge);
}

export function getChallenge(challengeId: string): ChallengeState | undefined {
  return challenges.get(challengeId);
}

export function deleteChallenge(challengeId: string): void {
  challenges.delete(challengeId);
}
