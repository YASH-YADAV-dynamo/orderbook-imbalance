import { LiquidationEvent } from './types';

export class OkxFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(onEvent: (event: LiquidationEvent) => void) {
    this.onEvent = onEvent;
  }

  connect() {
    const url = 'wss://ws.okx.com:8443/ws/v5/public';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('OKX Liquidation Feed connected');
      // Subscribe to SWAP liquidations (most volume)
      this.ws?.send(JSON.stringify({
        op: 'subscribe',
        args: [
          { channel: 'liquidation-orders', instType: 'SWAP' },
          { channel: 'liquidation-orders', instType: 'FUTURES' }
        ]
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'subscribe') return;
        
        if (data.arg?.channel === 'liquidation-orders' && data.data) {
          data.data.forEach((item: any) => {
            const normalized: LiquidationEvent = {
              dex: 'okx',
              symbol: item.instId.split('-')[0], // BTC-USDT-SWAP -> BTC
              side: item.side === 'sell' ? 'long' : 'short', // sell side liquidation means long was liquidated
              liq_type: 'market',
              price_usd: parseFloat(item.bkPx || item.sz), // OKX doesn't always provide price in some variants, bkPx is bankruptcy price
              amount_token: parseFloat(item.sz),
              notional_usd: parseFloat(item.bkPx || 0) * parseFloat(item.sz),
              timestamp_ms: parseInt(item.ts),
              raw_order_id: `okx-${item.ts}-${Math.random()}`,
            };
            this.onEvent(normalized);
          });
        }
      } catch (err) {
        console.error('OKX WS Parse Error:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('OKX WS Error:', err);
    };

    this.ws.onclose = (event) => {
      console.warn(`OKX WS Closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
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
