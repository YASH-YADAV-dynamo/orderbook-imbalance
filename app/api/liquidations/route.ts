import { NextResponse } from 'next/server';
import { PacificaAdapter } from '@/lib/liquidations/pacifica';
import { LiquidationEvent } from '@/lib/liquidations/types';

const pacificaAdapter = new PacificaAdapter({
  dex: 'pacifica',
  baseUrl: 'https://api.pacifica.fi',
  symbols: ['BTC', 'ETH', 'SOL'],
});

export const revalidate = 0; // Disable static caching for real-time endpoint

// Helper to generate realistic fake liquidations for demo purposes
function generateMockLiquidations(): LiquidationEvent[] {
  const mocks: LiquidationEvent[] = [];
  const now = Date.now();
  const types: ("market" | "backstop" | "settlement")[] = ['market', 'market', 'market', 'backstop'];
  const sides: ("long" | "short")[] = ['long', 'short'];
  
  const EXCHANGES = ['Binance', 'Bybit', 'Hyperliquid', 'Bitget', 'Gate.io', 'OKX', 'HTX', 'Trade[XYZ]', 'Aster', 'Pacifica'];
  const SYMBOLS = ['BTC', 'ETH', 'MET', 'CHIP', 'SOL', 'CL', 'RAVE', 'BRENTOIL', 'XAU', 'BOME', 'DOGE', 'XRP', 'HYPE', 'BAS', 'PEPE', 'BNB'];
  
  // Weights to make some exchanges/symbols bigger
  const getWeightedRandom = (arr: string[]) => arr[Math.floor(Math.pow(Math.random(), 1.5) * arr.length)];
  
  for (let i = 0; i < 200; i++) {
    const symbol = getWeightedRandom(SYMBOLS);
    const exchange = getWeightedRandom(EXCHANGES);
    
    const timeOffset = Math.random() * 24 * 60 * 60 * 1000; // random time in last 24h
    let price = 100;
    let amount = 10;
    
    if (symbol === 'BTC') { price = 65000 + (Math.random() * 5000); amount = Math.random() * 2 + 0.1; }
    else if (symbol === 'ETH') { price = 3500 + (Math.random() * 200); amount = Math.random() * 20 + 1; }
    else if (symbol === 'SOL') { price = 150 + (Math.random() * 20); amount = Math.random() * 500 + 10; }
    else { price = Math.random() * 100 + 0.01; amount = Math.random() * 100000 + 1000; }
    
    // Some random multiplier to create large outliers for Treemaps
    const volumeMultiplier = Math.random() > 0.9 ? 10 : 1;
    
    mocks.push({
      dex: exchange.toLowerCase(),
      symbol,
      side: sides[Math.floor(Math.random() * sides.length)],
      liq_type: types[Math.floor(Math.random() * types.length)],
      price_usd: price,
      amount_token: amount * volumeMultiplier,
      notional_usd: price * amount * volumeMultiplier,
      timestamp_ms: now - timeOffset,
      raw_order_id: 10000000000 + i,
    });
  }
  return mocks;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC';
  
  try {
    // Fetch recent liquidations
    let events = await pacificaAdapter.fetchRecent(symbol);
    
    // DEMO FALLBACK: If there are no real liquidations (because they are rare),
    // inject some fake ones so the dashboard isn't completely empty.
    if (events.length === 0) {
      events = generateMockLiquidations();
    }
    
    // Sort events descending by timestamp (newest first)
    events.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
    
    // Calculate 24h metrics
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const last24hEvents = events.filter(e => e.timestamp_ms >= oneDayAgo);
    
    let totalLongUsd = 0;
    let totalShortUsd = 0;
    let maxLiqUsd = 0;
    let backstopUsd = 0;
    
    for (const event of last24hEvents) {
      if (event.side === 'long') totalLongUsd += event.notional_usd;
      if (event.side === 'short') totalShortUsd += event.notional_usd;
      if (event.notional_usd > maxLiqUsd) maxLiqUsd = event.notional_usd;
      if (event.liq_type === 'backstop') backstopUsd += event.notional_usd;
    }
    
    const totalVolume = totalLongUsd + totalShortUsd;
    const longRatio = totalVolume > 0 ? totalLongUsd / totalVolume : 0;
    const shortRatio = totalVolume > 0 ? totalShortUsd / totalVolume : 0;
    const avgSize = last24hEvents.length > 0 ? totalVolume / last24hEvents.length : 0;
    
    const metrics = {
      totalVolume,
      totalLongUsd,
      totalShortUsd,
      longRatio,
      shortRatio,
      avgSize,
      maxLiqUsd,
      backstopUsd,
      eventCount24h: last24hEvents.length
    };
    
    // Create chart data (group by hour)
    const hourlyData: Record<string, { time: number, long: number, short: number }> = {};
    
    for (const event of last24hEvents) {
      // Round to nearest hour
      const hourMs = Math.floor(event.timestamp_ms / (1000 * 60 * 60)) * (1000 * 60 * 60);
      const hourKey = String(hourMs);
      
      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = { time: hourMs, long: 0, short: 0 };
      }
      
      if (event.side === 'long') {
        hourlyData[hourKey].long += event.notional_usd;
      } else if (event.side === 'short') {
        hourlyData[hourKey].short += event.notional_usd;
      }
    }
    
    const chartData = Object.values(hourlyData).sort((a, b) => a.time - b.time);

    return NextResponse.json({
      success: true,
      data: {
        events,
        metrics,
        chartData
      }
    });
  } catch (error: any) {
    console.error('Liquidations API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
