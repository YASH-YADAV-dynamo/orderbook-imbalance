import { NextResponse } from 'next/server';
import { LiquidationEvent } from '@/lib/liquidations/types';

export const revalidate = 0;

// Optimized symbol list for maximum compatibility across Binance, OKX, Bybit, and Bitget
const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT',
  'LINKUSDT', 'PEPEUSDT', 'WIFUSDT', 'FETUSDT', 'RNDRUSDT',
  'SUIUSDT', 'APTUSDT', 'OPUSDT', 'ARBUSDT', 'TIAUSDT'
];

async function fetchBinanceHistorical(): Promise<LiquidationEvent[]> {
  try {
    const symbol = 'BTCUSDT';
    const resp = await fetch(`https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${symbol}&limit=100`, {
      cache: 'no-store'
    });
    const order = await resp.json();
    const list = Array.isArray(order) ? order : [];
    
    return list.map((order: any) => ({
      raw_order_id: `binance-${order.symbol}-${order.time}`,
      symbol: order.symbol.replace('USDT', ''),
      side: order.side.toLowerCase() === 'sell' ? 'long' : 'short',
      liq_type: 'market',
      price_usd: parseFloat(order.price),
      amount_token: parseFloat(order.origQty),
      notional_usd: parseFloat(order.price) * parseFloat(order.origQty),
      timestamp_ms: order.time,
      dex: 'BINANCE'
    }));
  } catch (e) { return []; }
}

async function fetchOkxHistorical(): Promise<LiquidationEvent[]> {
  try {
    const resp = await fetch('https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&limit=100', {
      cache: 'no-store'
    });
    const json = await resp.json();
    if (json.code === '0' && json.data?.[0]?.details) {
      return json.data[0].details.map((item: any) => ({
        raw_order_id: `okx-${item.instId}-${item.ts}`,
        symbol: item.instId.split('-')[0],
        side: item.side === 'buy' ? 'short' : 'long', 
        liq_type: 'market',
        price_usd: parseFloat(item.bkPx),
        amount_token: parseFloat(item.sz),
        notional_usd: parseFloat(item.bkPx) * parseFloat(item.sz),
        timestamp_ms: parseInt(item.ts),
        dex: 'OKX'
      }));
    }
    return [];
  } catch (e) { return []; }
}

async function fetchBybitHistorical(): Promise<LiquidationEvent[]> {
  try {
    const resp = await fetch('https://api.bybit.com/v5/market/liquidation?category=linear&symbol=BTCUSDT&limit=50', {
      cache: 'no-store'
    });
    const json = await resp.json();
    const list = json.data?.list || [];
    return list.map((item: any) => ({
      raw_order_id: `bybit-${item.symbol}-${item.updatedTime}`,
      symbol: item.symbol.replace('USDT', ''),
      side: item.side === 'Sell' ? 'long' : 'short',
      liq_type: 'market',
      price_usd: parseFloat(item.price),
      amount_token: parseFloat(item.size),
      notional_usd: parseFloat(item.price) * parseFloat(item.size),
      timestamp_ms: parseInt(item.updatedTime),
      dex: 'BYBIT'
    }));
  } catch (e) { return []; }
}

async function fetchBitgetHistorical(): Promise<LiquidationEvent[]> {
  try {
    const resp = await fetch('https://api.bitget.com/api/v2/mix/market/history-liquidation?symbol=BTCUSDT&productType=usdt-futures&limit=50', {
      cache: 'no-store'
    });
    const json = await resp.json();
    const list = json.data || [];
    return list.map((item: any) => ({
      raw_order_id: `bitget-${item.symbol}-${item.cTime}`,
      symbol: item.symbol.replace('USDT', ''),
      side: item.side === 'sell' ? 'long' : 'short',
      liq_type: 'market',
      price_usd: parseFloat(item.price),
      amount_token: parseFloat(item.size),
      notional_usd: parseFloat(item.price) * parseFloat(item.size),
      timestamp_ms: parseInt(item.cTime),
      dex: 'BITGET'
    }));
  } catch (e) { return []; }
}

async function fetchGateHistorical(): Promise<LiquidationEvent[]> {
  try {
    const resp = await fetch('https://api.gateio.ws/api/v4/futures/usdt/liquidates?contract=BTC_USDT', {
      cache: 'no-store'
    });
    const list = await resp.json();
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => ({
      raw_order_id: `gate-${item.contract}-${item.time}`,
      symbol: item.contract.split('_')[0],
      side: 'long', 
      liq_type: 'market',
      price_usd: parseFloat(item.price),
      amount_token: parseFloat(item.size),
      notional_usd: parseFloat(item.price) * parseFloat(item.size),
      timestamp_ms: item.time * 1000,
      dex: 'GATE.IO'
    }));
  } catch (e) { return []; }
}

async function fetchHtxHistorical(): Promise<LiquidationEvent[]> {
  try {
    const resp = await fetch('https://api.hbdm.com/linear-swap-ex/market/liquidation_orders?contract_code=BTC-USDT&trade_type=0&create_date=7&page_index=1&page_size=50', {
      cache: 'no-store'
    });
    const json = await resp.json();
    const list = json.data?.orders || [];
    return list.map((item: any) => ({
      raw_order_id: `htx-${item.symbol}-${item.created_at}`,
      symbol: item.symbol,
      side: item.direction === 'sell' ? 'long' : 'short',
      liq_type: 'market',
      price_usd: parseFloat(item.price),
      amount_token: parseFloat(item.volume),
      notional_usd: parseFloat(item.price) * parseFloat(item.volume),
      timestamp_ms: item.created_at,
      dex: 'HTX'
    }));
  } catch (e) { return []; }
}

export async function GET() {
  try {
    console.log('[API] Initializing multi-venue fetch...');
    const results = await Promise.allSettled([
      fetchBinanceHistorical(),
      fetchOkxHistorical(),
      fetchBybitHistorical(),
      fetchBitgetHistorical(),
      fetchGateHistorical(),
      fetchHtxHistorical()
    ]);

    const allEvents: LiquidationEvent[] = [];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        allEvents.push(...res.value);
      }
    });

    allEvents.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
    const topEvents = allEvents.slice(0, 1000);
    
    console.log(`[API] Success. Found ${topEvents.length} events across ${results.filter(r => r.status === 'fulfilled').length} sources.`);

    return NextResponse.json({
      success: true,
      data: {
        events: topEvents
      }
    });
  } catch (error: any) {
    console.error('[API] Fatal GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
