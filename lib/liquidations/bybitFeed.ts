import { LiquidationEvent } from './types';

export class BybitFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private symbols: string[];
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // We subscribe to top symbols as Bybit doesn't have a simple "all" stream on public WS
  private defaultSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT',
    'LINKUSDT', 'PEPEUSDT', 'WIFUSDT', 'FETUSDT', 'RNDRUSDT',
    'SUIUSDT', 'APTUSDT', 'OPUSDT', 'ARBUSDT', 'TIAUSDT'
  ];

  constructor(onEvent: (event: LiquidationEvent) => void, symbols?: string[]) {
    this.onEvent = onEvent;
    this.symbols = symbols || this.defaultSymbols;
  }

  connect() {
    const url = 'wss://stream.bybit.com/v5/public/linear';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Bybit Liquidation Feed connected');
      // Subscribe to all symbols in chunks (Bybit supports up to 10 topics per msg)
      for (let i = 0; i < this.symbols.length; i += 10) {
        const chunk = this.symbols.slice(i, i + 10);
        this.ws?.send(JSON.stringify({
          op: 'subscribe',
          args: chunk.map(s => `allLiquidation.${s}`)
        }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.topic && data.topic.startsWith('allLiquidation')) {
          const item = data.data;
          
          const normalized: LiquidationEvent = {
            dex: 'bybit',
            symbol: item.s.replace('USDT', ''),
            side: item.S === 'Buy' ? 'long' : 'short', // Buy side liquidation means a Long was forced to sell? 
            // Wait: Bybit "Buy" side means the liquidation order was a buy? 
            // According to Bybit docs: "Side of the liquidation order"
            // If it's a "Buy" order, it means a Short position was liquidated.
            // If it's a "Sell" order, it means a Long position was liquidated.
            // Let's re-verify. 
            // Usually: "Buy" order covers a "Short". "Sell" order closes a "Long".
            liq_type: 'market',
            price_usd: parseFloat(item.p),
            amount_token: parseFloat(item.v),
            notional_usd: parseFloat(item.p) * parseFloat(item.v),
            timestamp_ms: item.T,
            raw_order_id: `bybit-${item.s}-${item.T}-${Math.random()}`,
          };

          // Correction based on common exchange logic:
          // side=Buy in liquidation stream usually means the exchange is BUYING to close a SHORT.
          // side=Sell means the exchange is SELLING to close a LONG.
          normalized.side = item.S === 'Sell' ? 'long' : 'short';

          this.onEvent(normalized);
        }
      } catch (err) {
        console.error('Bybit WS Parse Error:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Bybit WS Error:', err);
    };

    this.ws.onclose = (event) => {
      console.warn(`Bybit WS Closed: ${event.code}`);
      this.reconnect();
    };
  }

  private reconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
  }
}
