// Core normalized event — what every DEX adapter must produce
export interface LiquidationEvent {
  dex: string                          // e.g. "pacifica"
  symbol: string                       // e.g. "BTC"
  side: "long" | "short"
  liq_type: "market" | "backstop" | "settlement"
  price_usd: number                    // execution price
  amount_token: number                 // size in base token
  notional_usd: number                 // price × amount
  timestamp_ms: number
  raw_order_id: string | number        // monotonic cursor for dedup
  raw?: Record<string, unknown>        // original payload if needed
}

// Adapter config — what you pass per DEX
export interface DexAdapterConfig {
  dex: string
  baseUrl: string
  symbols: string[]
  apiKey?: string
  pollIntervalMs?: number
}

// The shared interface that every exchange implements
export interface DexAdapter {
  fetchRecent(symbol: string): Promise<LiquidationEvent[]>
  fetchHistorical(symbol: string, cursor?: string): Promise<{
    events: LiquidationEvent[]
    nextCursor: string | null
  }>
}
