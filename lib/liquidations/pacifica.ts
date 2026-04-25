import { DexAdapter, DexAdapterConfig, LiquidationEvent } from './types';

// Pacifica-specific raw trade (from API)
export interface PacificaTrade {
  event_type: "fulfill_taker" | "fulfill_maker"
  price: string
  amount: string
  side: "open_long" | "open_short" | "close_long" | "close_short"
  cause: "normal" | "market_liquidation" | "backstop_liquidation" | "settlement"
  created_at: number
  last_order_id: number
}

function normalizePacificaTrade(
  trade: PacificaTrade, symbol: string
): LiquidationEvent | null {
  if (!["market_liquidation", "backstop_liquidation", "settlement"].includes(trade.cause)) {
    return null;
  }

  const price = parseFloat(trade.price);
  const amount = parseFloat(trade.amount);

  return {
    dex: "pacifica",
    symbol,
    side: trade.side.includes("long") ? "long" : "short",
    liq_type:
      trade.cause === "market_liquidation" ? "market"
      : trade.cause === "backstop_liquidation" ? "backstop"
      : "settlement",
    price_usd: price,
    amount_token: amount,
    notional_usd: price * amount,
    timestamp_ms: trade.created_at,
    raw_order_id: trade.last_order_id,
    raw: trade as unknown as Record<string, unknown>,
  };
}

export class PacificaAdapter implements DexAdapter {
  private config: DexAdapterConfig;

  constructor(config: DexAdapterConfig) {
    this.config = config;
  }

  async fetchRecent(symbol: string): Promise<LiquidationEvent[]> {
    const url = `${this.config.baseUrl}/api/v1/trades?symbol=${symbol}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Pacifica API error: ${response.status}`);
      }
      
      const data = await response.json();
      const trades: PacificaTrade[] = data.data || [];
      
      return trades
        .map(trade => normalizePacificaTrade(trade, symbol))
        .filter((e): e is LiquidationEvent => e !== null);
    } catch (error) {
      console.error(`Failed to fetch recent liquidations from Pacifica for ${symbol}:`, error);
      return [];
    }
  }

  async fetchHistorical(symbol: string, cursor?: string): Promise<{
    events: LiquidationEvent[]
    nextCursor: string | null
  }> {
    // Note: requires auth signature, user mentioned `account=...`.
    // In a real server-side implementation, this would be signed.
    // We'll mock the URL construction for now.
    const baseUrl = `${this.config.baseUrl}/api/v1/trades/history`;
    const params = new URLSearchParams({
      symbol,
      // account: "...", // Add if needed
    });
    if (cursor) {
      params.append('cursor', cursor);
    }

    const url = `${baseUrl}?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        headers: this.config.apiKey ? {
          'Authorization': `Bearer ${this.config.apiKey}` // Replace with actual signing logic
        } : undefined
      });
      
      if (!response.ok) {
        throw new Error(`Pacifica API error: ${response.status}`);
      }
      
      const data = await response.json();
      const trades: PacificaTrade[] = data.data || [];
      
      const events = trades
        .map(trade => normalizePacificaTrade(trade, symbol))
        .filter((e): e is LiquidationEvent => e !== null);
        
      return {
        events,
        nextCursor: data.last_order_id ? String(data.last_order_id) : null,
      };
    } catch (error) {
      console.error(`Failed to fetch historical liquidations from Pacifica for ${symbol}:`, error);
      return { events: [], nextCursor: null };
    }
  }
}
