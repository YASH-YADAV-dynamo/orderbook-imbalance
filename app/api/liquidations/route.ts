import { NextResponse } from 'next/server';
import { LiquidationEvent } from '@/lib/liquidations/types';

export const revalidate = 0;

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Bybit: fetch recent liquidations per-symbol (REST only works during active markets)
async function seedBybit(): Promise<LiquidationEvent[]> {
  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'PEPEUSDT',
    'SUIUSDT', 'WIFUSDT', 'APTUSDT', 'LDOUSDT', 'NEARUSDT',
  ];
  const events: LiquidationEvent[] = [];

  await Promise.all(symbols.map(async (sym) => {
    try {
      const res = await withTimeout(
        fetch(`https://api.bybit.com/v5/market/liquidation?category=linear&symbol=${sym}&limit=50`, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' },
        }),
        4000, null as any
      );
      if (!res?.ok) return;
      const json = await res.json();
      (json?.result?.list ?? []).forEach((item: any) => {
        const price = parseFloat(item.price);
        const size  = parseFloat(item.size);
        if (!price || !size) return;
        events.push({
          dex:          'BYBIT',
          symbol:       item.symbol.replace('USDT', ''),
          side:         (item.side === 'Sell' ? 'long' : 'short') as 'long' | 'short',
          liq_type:     'market' as 'market',
          price_usd:    price,
          amount_token: size,
          notional_usd: price * size,
          timestamp_ms: parseInt(item.updatedTime),
          raw_order_id: `bybit-seed-${sym}-${item.updatedTime}`,
        });
      });
    } catch { /* skip */ }
  }));

  return events;
}

// OKX: single call for all SWAP liquidations
async function seedOkx(): Promise<LiquidationEvent[]> {
  try {
    const res = await withTimeout(
      fetch('https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&limit=100', {
        cache: 'no-store',
      }),
      5000, null as any
    );
    if (!res?.ok) return [];
    const json = await res.json();
    if (json.code !== '0' || !Array.isArray(json.data)) return [];

    const events: LiquidationEvent[] = [];
    json.data.forEach((item: any) => {
      const symbol = item.instId.split('-')[0];
      (item.details ?? []).forEach((d: any) => {
        const price  = parseFloat(d.bkPx || d.px || '0');
        const amount = parseFloat(d.sz || '0');
        if (!price || !amount) return;
        events.push({
          dex:          'OKX',
          symbol,
          side:         (d.side === 'sell' ? 'long' : 'short') as 'long' | 'short',
          liq_type:     'market' as 'market',
          price_usd:    price,
          amount_token: amount,
          notional_usd: price * amount,
          timestamp_ms: parseInt(d.ts || item.ts || Date.now().toString()),
          raw_order_id: `okx-seed-${symbol}-${d.ts}`,
        });
      });
    });
    return events;
  } catch { return []; }
}

// Deribit: BTC + ETH liquidations — always has data, always public
// These are crypto perpetual/futures liquidation settlements
async function seedDeribit(): Promise<LiquidationEvent[]> {
  const currencies = ['BTC', 'ETH', 'SOL'];
  const events: LiquidationEvent[] = [];

  await Promise.all(currencies.map(async (ccy) => {
    try {
      const url = `https://www.deribit.com/api/v2/public/get_last_settlements_by_currency?currency=${ccy}&type=liquidation&count=50`;
      const res = await withTimeout(
        fetch(url, { cache: 'no-store' }),
        5000, null as any
      );
      if (!res?.ok) return;
      const json = await res.json();
      const settlements: any[] = json?.result?.settlements ?? [];

      settlements.forEach((s: any) => {
        // Only include liquidation-type settlements
        if (s.type !== 'liquidation') return;
        // index_price is the BTC/ETH price at time of liquidation
        const price = s.index_price ?? s.mark_price ?? 0;
        // position is the size in base currency
        const positionRaw = Math.abs(s.position ?? 0);
        if (!price || !positionRaw) return;

        events.push({
          dex:          'DERIBIT',
          symbol:       ccy,
          // Deribit: session_profit_loss < 0 means the position was losing (likely long in a downturn)
          side:         ((s.session_profit_loss ?? 0) < 0 ? 'long' : 'short') as 'long' | 'short',
          liq_type:     'market' as 'market',
          price_usd:    price,
          amount_token: positionRaw,
          notional_usd: price * positionRaw,
          timestamp_ms: s.timestamp,
          raw_order_id: `deribit-seed-${ccy}-${s.timestamp}-${Math.random().toString(36).slice(2)}`,
        });
      });
    } catch { /* skip */ }
  }));

  return events;
}

// Hyperliquid: recent liquidations via their info API
async function seedHyperliquid(): Promise<LiquidationEvent[]> {
  try {
    // Fetch recent liquidation fills by looking at clearinghouse state
    const res = await withTimeout(
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'liquidations' }),
        cache: 'no-store',
      }),
      4000, null as any
    );
    if (!res?.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json)) return [];

    return json.slice(0, 100).map((liq: any) => {
      const price = parseFloat(liq.px ?? liq.price ?? '0');
      const size  = parseFloat(liq.sz ?? liq.size ?? '0');
      return {
        dex:          'HYPERLIQUID',
        symbol:       liq.coin ?? '',
        side:         (liq.side === 'S' ? 'long' : 'short') as 'long' | 'short',
        liq_type:     'market' as 'market',
        price_usd:    price,
        amount_token: size,
        notional_usd: price * size,
        timestamp_ms: liq.time ?? Date.now(),
        raw_order_id: `hl-seed-${liq.time}-${Math.random().toString(36).slice(2)}`,
      };
    }).filter((e: LiquidationEvent) => e.price_usd > 0 && e.amount_token > 0);
  } catch { return []; }
}

export async function GET() {
  const start = Date.now();

  const [bybit, okx, deribit, hyperliquid] = await Promise.all([
    seedBybit(),
    seedOkx(),
    seedDeribit(),
    seedHyperliquid(),
  ]);

  const allEvents = [...bybit, ...okx, ...deribit, ...hyperliquid]
    .filter(e => e.price_usd > 0 && e.notional_usd > 0)
    .sort((a, b) => b.timestamp_ms - a.timestamp_ms)
    .slice(0, 500);

  const byDex: Record<string, number> = {};
  allEvents.forEach(e => { byDex[e.dex] = (byDex[e.dex] || 0) + 1; });
  console.log(`[Seed] ${Date.now() - start}ms | ${allEvents.length} events | ${JSON.stringify(byDex)}`);

  return NextResponse.json({ success: true, data: { events: allEvents } });
}
