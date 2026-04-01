import { getHotstuffServerConfig } from '@/lib/trading/hotstuffServerConfig';
import { resolvePair } from '@/lib/pairs';

export async function postHotstuffExchange(body: unknown): Promise<unknown> {
  const cfg = getHotstuffServerConfig();
  const res = await fetch(`${cfg.hotstuffHttpUrl.replace(/\/$/, '')}/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string; tx_hash?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || `HotStuff HTTP ${res.status}`);
  }
  return data;
}

async function postHotstuffInfo<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const cfg = getHotstuffServerConfig();
  const res = await fetch(`${cfg.hotstuffHttpUrl.replace(/\/$/, '')}/info`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T | { error?: string; message?: string };
  if (!res.ok) {
    const err = (data as { error?: string; message?: string }).error
      ?? (data as { error?: string; message?: string }).message
      ?? `HotStuff info HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

export async function fetchHotstuffOrderContext(symbol: string): Promise<{
  instrumentId: number;
  nativeSymbol: string;
  markPrice: string;
}> {
  const nativeSymbol = resolvePair(symbol, 'hotstuff');
  if (!nativeSymbol) {
    throw new Error(`HotStuff symbol mapping not found for ${symbol}`);
  }

  const instruments = await postHotstuffInfo<{ perps: Array<{ id: number; name: string }> }>('instruments', { type: 'perps' });
  const instrument = instruments.perps.find(p => p.name === nativeSymbol);
  if (!instrument) {
    throw new Error(`HotStuff instrument not found for ${nativeSymbol}`);
  }

  const ticker = await postHotstuffInfo<Array<{ symbol: string; mark_price: string }>>('ticker', { symbol: nativeSymbol });
  const markPrice = ticker[0]?.mark_price;
  if (!markPrice) {
    throw new Error(`HotStuff mark price unavailable for ${nativeSymbol}`);
  }

  return {
    instrumentId: instrument.id,
    nativeSymbol,
    markPrice,
  };
}

interface HotstuffRecentTrade {
  tx_hash?: string;
  price?: string | number;
  size?: string | number;
  timestamp?: string | number;
}

export async function findHotstuffTradeByTxHash(
  symbol: string,
  txHash: string,
): Promise<HotstuffRecentTrade | null> {
  const nativeSymbol = resolvePair(symbol, 'hotstuff');
  if (!nativeSymbol) return null;
  const recent = await postHotstuffInfo<HotstuffRecentTrade[]>('trades', { symbol: nativeSymbol });
  if (!Array.isArray(recent)) return null;
  const target = txHash.toLowerCase();
  return recent.find(t => String(t.tx_hash ?? '').toLowerCase() === target) ?? null;
}
