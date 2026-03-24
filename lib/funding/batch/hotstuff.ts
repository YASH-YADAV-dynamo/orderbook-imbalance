import type { FundingOkData } from '@/types/funding';
import { ONE_HOUR_MS } from '@/lib/funding/constants';
import { formatRateAsPercent } from '@/lib/funding/display';
import { fundingTagFromRate } from '@/lib/funding/tag';
import { nextUtcHourMs } from '@/lib/funding/nextHourUtc';
import { resolvePair } from '@/lib/pairs';
import type { AdapterId } from '@/lib/dexAdapters';
import { parseFundingRate } from '@/lib/funding/batch/helpers';

const ADAPTER = 'hotstuff' as const satisfies AdapterId;

const SOURCE = 'HotStuff GET /v1/markets → fundingRate, nextFundingTime (ms).';

/** Map API symbol (e.g. BTC-USD, BTC-PERP) → pair id BASE/USD */
function symbolToPairId(symbol: string): string | null {
  const u = symbol.toUpperCase();
  if (u.endsWith('-USD')) return `${u.replace('-USD', '')}/USD`;
  if (u.endsWith('-PERP')) return `${u.replace('-PERP', '')}/USD`;
  return null;
}

export async function fetchHotstuffBatch(
  wantedPairIds: Set<string>,
): Promise<Map<string, FundingOkData | { error: string }>> {
  const out = new Map<string, FundingOkData | { error: string }>();

  let res: Response;
  try {
    res = await fetch('https://api.hotstuff.trade/v1/markets', { cache: 'no-store' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    for (const id of wantedPairIds) out.set(id, { error: msg });
    return out;
  }

  if (!res.ok) {
    const err = `HTTP ${res.status}`;
    for (const id of wantedPairIds) out.set(id, { error: err });
    return out;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    for (const id of wantedPairIds) out.set(id, { error: 'invalid JSON' });
    return out;
  }

  let list: unknown[] = [];
  if (Array.isArray(json)) list = json;
  else if (json && typeof json === 'object' && Array.isArray((json as { markets?: unknown[] }).markets)) {
    list = (json as { markets: unknown[] }).markets;
  }

  const byPair = new Map<string, { fundingRate?: string; nextFundingTime?: number }>();
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { symbol?: string; fundingRate?: string; nextFundingTime?: number };
    if (typeof r.symbol !== 'string') continue;
    const pid = symbolToPairId(r.symbol);
    if (!pid || !wantedPairIds.has(pid) || !resolvePair(pid, ADAPTER)) continue;
    byPair.set(pid, { fundingRate: r.fundingRate, nextFundingTime: r.nextFundingTime });
  }

  for (const pairId of wantedPairIds) {
    if (!resolvePair(pairId, ADAPTER)) {
      out.set(pairId, { error: 'unsupported_pair' });
      continue;
    }
    const row = byPair.get(pairId);
    if (!row) {
      out.set(pairId, { error: 'symbol not in markets' });
      continue;
    }
    const fundingRateHourly = parseFundingRate(row.fundingRate);
    if (fundingRateHourly === null) {
      out.set(pairId, { error: 'no fundingRate' });
      continue;
    }
    let nextMs = nextUtcHourMs();
    if (typeof row.nextFundingTime === 'number' && row.nextFundingTime > Date.now()) {
      nextMs = row.nextFundingTime;
    }

    out.set(pairId, {
      fundingRateHourly,
      paymentDisplay: formatRateAsPercent(fundingRateHourly),
      dataSource: SOURCE,
      nextFundingMs: nextMs,
      fundingPeriodMs: ONE_HOUR_MS,
      tag: fundingTagFromRate(fundingRateHourly),
    });
  }

  return out;
}
