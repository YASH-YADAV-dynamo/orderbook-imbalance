'use client';

function envFlag(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return null;
}

export function isHotstuffTestnet(): boolean {
  const explicit = envFlag(process.env.NEXT_PUBLIC_HOTSTUFF_IS_TESTNET);
  if (explicit != null) return explicit;
  const url = process.env.NEXT_PUBLIC_HOTSTUFF_HTTP ?? '';
  return url.toLowerCase().includes('testnet');
}

export function getHotstuffHttpBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_HOTSTUFF_HTTP?.trim();
  if (fromEnv) return fromEnv;
  return isHotstuffTestnet()
    ? 'https://testnet-test-api.hotstuff.exchange/'
    : 'https://api.hotstuff.trade/';
}
