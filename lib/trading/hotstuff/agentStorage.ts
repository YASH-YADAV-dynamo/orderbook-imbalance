'use client';

import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem/accounts';

const PREFIX = 'hotstuff_agent_pk_v1';
const DEFAULT_TTL_MINUTES = Number(process.env.NEXT_PUBLIC_AGENT_KEY_TTL_MINUTES || '120');

interface StoredAgentKey {
  privateKey: `0x${string}`;
  expiresAt: number;
}

interface WalletAgentStore {
  activeAgentId: string | null;
  byAgent: Record<string, StoredAgentKey>;
}

function storageKey(walletAddress: string): string {
  return `${PREFIX}:${walletAddress.toLowerCase()}`;
}

function getTtlMs(): number {
  const safeMinutes = Number.isFinite(DEFAULT_TTL_MINUTES) && DEFAULT_TTL_MINUTES > 0
    ? DEFAULT_TTL_MINUTES
    : 120;
  return safeMinutes * 60 * 1000;
}

function writeStore(walletAddress: string, payload: WalletAgentStore): void {
  if (Object.keys(payload.byAgent).length === 0) {
    window.localStorage.removeItem(storageKey(walletAddress));
    return;
  }
  window.localStorage.setItem(storageKey(walletAddress), JSON.stringify(payload));
}

function normalizeAgentId(value: string): string | null {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value.toLowerCase();
}

function fromLegacy(walletAddress: string, value: string): WalletAgentStore | null {
  if (!value.startsWith('0x')) return null;
  const privateKey = value as `0x${string}`;
  const agentAddress = privateKeyToAccount(privateKey).address.toLowerCase();
  const store: WalletAgentStore = {
    activeAgentId: agentAddress,
    byAgent: {
      [agentAddress]: {
        privateKey,
        expiresAt: Date.now() + getTtlMs(),
      },
    },
  };
  writeStore(walletAddress, store);
  return store;
}

function cleanupStore(walletAddress: string, store: WalletAgentStore): WalletAgentStore | null {
  const now = Date.now();
  const cleaned: Record<string, StoredAgentKey> = {};
  Object.entries(store.byAgent).forEach(([agentId, entry]) => {
    if (!entry || typeof entry.privateKey !== 'string' || !entry.privateKey.startsWith('0x')) return;
    if (!entry.expiresAt || now >= entry.expiresAt) return;
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) return;
    cleaned[normalizedAgentId] = {
      privateKey: entry.privateKey as `0x${string}`,
      expiresAt: entry.expiresAt,
    };
  });

  if (Object.keys(cleaned).length === 0) {
    window.localStorage.removeItem(storageKey(walletAddress));
    return null;
  }

  const normalizedActive = store.activeAgentId ? normalizeAgentId(store.activeAgentId) : null;
  const activeAgentId = normalizedActive && cleaned[normalizedActive]
    ? normalizedActive
    : Object.keys(cleaned)[0];

  const next: WalletAgentStore = {
    activeAgentId,
    byAgent: cleaned,
  };
  writeStore(walletAddress, next);
  return next;
}

function readStore(walletAddress: string): WalletAgentStore | null {
  const raw = window.localStorage.getItem(storageKey(walletAddress));
  if (!raw) return null;

  const legacy = fromLegacy(walletAddress, raw);
  if (legacy) return cleanupStore(walletAddress, legacy);

  try {
    const parsed = JSON.parse(raw) as Partial<WalletAgentStore & StoredAgentKey>;

    // Backward compatibility with previous single-object format.
    if (parsed.privateKey && parsed.expiresAt) {
      const privateKey = parsed.privateKey as `0x${string}`;
      const agentAddress = privateKeyToAccount(privateKey).address.toLowerCase();
      const converted: WalletAgentStore = {
        activeAgentId: agentAddress,
        byAgent: {
          [agentAddress]: {
            privateKey,
            expiresAt: Number(parsed.expiresAt),
          },
        },
      };
      return cleanupStore(walletAddress, converted);
    }

    if (!parsed.byAgent || typeof parsed.byAgent !== 'object') {
      window.localStorage.removeItem(storageKey(walletAddress));
      return null;
    }
    const store: WalletAgentStore = {
      activeAgentId: typeof parsed.activeAgentId === 'string' ? parsed.activeAgentId : null,
      byAgent: parsed.byAgent as Record<string, StoredAgentKey>,
    };
    return cleanupStore(walletAddress, store);
  } catch {
    window.localStorage.removeItem(storageKey(walletAddress));
    return null;
  }
}

export function setHotstuffAgentPrivateKey(
  walletAddress: string,
  privateKey: `0x${string}`,
  ttlMs = getTtlMs(),
  agentId?: `0x${string}`,
): void {
  const store = readStore(walletAddress) ?? { activeAgentId: null, byAgent: {} };
  const resolvedAgentId = normalizeAgentId(agentId ?? privateKeyToAccount(privateKey).address);
  if (!resolvedAgentId) return;
  store.byAgent[resolvedAgentId] = {
    privateKey,
    expiresAt: Date.now() + Math.max(1, ttlMs),
  };
  store.activeAgentId = resolvedAgentId;
  writeStore(walletAddress, store);
}

export function setHotstuffActiveAgent(walletAddress: string, agentId: string): boolean {
  const store = readStore(walletAddress);
  if (!store) return false;
  const normalized = normalizeAgentId(agentId);
  if (!normalized || !store.byAgent[normalized]) return false;
  store.activeAgentId = normalized;
  writeStore(walletAddress, store);
  return true;
}

export function getHotstuffAgentPrivateKey(
  walletAddress: string,
  agentId?: string,
): `0x${string}` | null {
  const store = readStore(walletAddress);
  if (!store) return null;
  const normalized = agentId ? normalizeAgentId(agentId) : store.activeAgentId;
  const resolved = normalized && store.byAgent[normalized]
    ? normalized
    : Object.keys(store.byAgent)[0];
  if (!resolved) return null;
  if (store.activeAgentId !== resolved) {
    store.activeAgentId = resolved;
    writeStore(walletAddress, store);
  }
  return store.byAgent[resolved]?.privateKey ?? null;
}

export function getHotstuffAgentAddress(walletAddress: string): `0x${string}` | null {
  const store = readStore(walletAddress);
  if (!store || !store.activeAgentId) return null;
  return store.activeAgentId as `0x${string}`;
}

export function getHotstuffKnownAgentAddresses(walletAddress: string): `0x${string}`[] {
  const store = readStore(walletAddress);
  if (!store) return [];
  return Object.keys(store.byAgent) as `0x${string}`[];
}

export function ensureHotstuffAgentPrivateKey(walletAddress: string): `0x${string}` {
  const existing = getHotstuffAgentPrivateKey(walletAddress);
  if (existing) return existing;
  const created = generatePrivateKey();
  setHotstuffAgentPrivateKey(walletAddress, created);
  return created;
}

export function deriveHotstuffAgentAddress(privateKey: `0x${string}`): `0x${string}` {
  return privateKeyToAccount(privateKey).address;
}
