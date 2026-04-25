import { LiquidationEvent } from './types';

export async function fetchHistoricalBinance(): Promise<LiquidationEvent[]> {
  try {
    // Binance REST for all liquidations is tricky without a symbol, 
    // but we can fetch top ones or use a specific aggregate endpoint if available.
    // For now, let's fetch BTC and ETH to populate the dashboard immediately.
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT'];
    const allEvents: LiquidationEvent[] = [];

    const promises = symbols.map(async (s) => {
      const resp = await fetch(`https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${s}&limit=50`);
      const data = await resp.json();
      if (Array.isArray(data)) {
        data.forEach((order: any) => {
          allEvents.push({
            dex: 'binance',
            symbol: order.symbol.replace('USDT', ''),
            side: order.side === 'SELL' ? 'long' : 'short',
            liq_type: 'market',
            price_usd: parseFloat(order.averagePrice),
            amount_token: parseFloat(order.origQty),
            notional_usd: parseFloat(order.averagePrice) * parseFloat(order.origQty),
            timestamp_ms: order.time,
            raw_order_id: `binance-hist-${order.time}-${Math.random()}`,
          });
        });
      }
    });

    await Promise.all(promises);
    return allEvents;
  } catch (err) {
    console.error('Failed to fetch Binance historical data:', err);
    return [];
  }
}

export async function fetchHistoricalOkx(): Promise<LiquidationEvent[]> {
  try {
    const resp = await fetch('https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&limit=100');
    const json = await resp.json();
    if (json.code === '0' && json.data) {
      return json.data.flatMap((batch: any) => {
        return batch.details.map((item: any) => ({
          dex: 'okx',
          symbol: batch.instId.split('-')[0],
          side: item.side === 'sell' ? 'long' : 'short',
          liq_type: 'market',
          price_usd: parseFloat(item.bkPx || item.sz),
          amount_token: parseFloat(item.sz),
          notional_usd: parseFloat(item.bkPx || 0) * parseFloat(item.sz),
          timestamp_ms: parseInt(batch.ts),
          raw_order_id: `okx-hist-${batch.ts}-${Math.random()}`,
        }));
      });
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch OKX historical data:', err);
    return [];
  }
}
