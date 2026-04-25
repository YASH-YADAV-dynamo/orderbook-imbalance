import { LiquidationEvent } from './types';

export class HyperliquidFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(onEvent: (event: LiquidationEvent) => void) {
    this.onEvent = onEvent;
  }

  connect() {
    const url = 'wss://api.hyperliquid.xyz/ws';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Hyperliquid Liquidation Feed connected');
      // Subscribe to global liquidations
      this.ws?.send(JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'liquidation' }
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === 'liquidation' && msg.data) {
          const { liquidations } = msg.data;
          
          liquidations.forEach((liq: any) => {
            const normalized: LiquidationEvent = {
              dex: 'hyperliquid',
              symbol: liq.coin,
              side: liq.side === 'S' ? 'long' : 'short', // S = Sell = Long Liquidated
              liq_type: 'market',
              price_usd: parseFloat(liq.p),
              amount_token: parseFloat(liq.sz),
              notional_usd: parseFloat(liq.p) * parseFloat(liq.sz),
              timestamp_ms: Date.now(), // HL doesn't always provide timestamp in the liq object
              raw_order_id: msg.data.hash + liq.coin + liq.sz, // Semi-unique ID
            };
            this.onEvent(normalized);
          });
        }
      } catch (err) {
        console.error('Hyperliquid WS Parse Error:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Hyperliquid WS Error:', err);
    };

    this.ws.onclose = (event) => {
      console.warn(`Hyperliquid WS Closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
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
