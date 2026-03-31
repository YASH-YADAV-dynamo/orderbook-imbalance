'use client';

import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem/accounts';

const PREFIX = 'hotstuff_agent_pk_v1';

function storageKey(walletAddress: string): string {
  return `${PREFIX}:${walletAddress.toLowerCase()}`;
}

export function setHotstuffAgentPrivateKey(walletAddress: string, privateKey: `0x${string}`): void {
  window.localStorage.setItem(storageKey(walletAddress), privateKey);
}

export function getHotstuffAgentPrivateKey(walletAddress: string): `0x${string}` | null {
  const value = window.localStorage.getItem(storageKey(walletAddress));
  if (!value || !value.startsWith('0x')) return null;
  return value as `0x${string}`;
}

export function getHotstuffAgentAddress(walletAddress: string): `0x${string}` | null {
  const privateKey = getHotstuffAgentPrivateKey(walletAddress);
  if (!privateKey) return null;
  return privateKeyToAccount(privateKey).address;
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
