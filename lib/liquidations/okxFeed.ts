import { LiquidationEvent } from './types';
import { generateUniqueId } from './utils';
import { FeedStatus } from './binanceFeed';

export class OkxFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private onStatus?: (status: FeedStatus) => void;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(onEvent: (event: LiquidationEvent) => void, onStatus?: (status: FeedStatus) => void) {
    this.onEvent  = onEvent;
    this.onStatus = onStatus;
  }

  connect() {
    if (this.destroyed) return;
    this.onStatus?.('connecting');
    this.ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

    this.ws.onopen = () => {
      console.log('[OKX] Feed connected ✓');
      this.onStatus?.('connected');
      this.ws?.send(JSON.stringify({
        op: 'subscribe',
        args: [{ channel: 'liquidation-orders', instType: 'SWAP' }],
      }));
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
      }, 25000);
    };

    this.ws.onmessage = (msg) => {
      try {
        if (msg.data === 'pong') return;
        const data = JSON.parse(msg.data);
        if (data.event === 'subscribe' || data.event === 'error') return;
        if (data.arg?.channel === 'liquidation-orders' && data.data) {
          data.data.forEach((item: any) => {
            const symbol = item.instId.split('-')[0];
            (item.details ?? []).forEach((d: any) => {
              const price  = parseFloat(d.bkPx || d.px || '0');
              const amount = parseFloat(d.sz || '0');
              if (!price || !amount) return;
              this.onEvent({
                dex:          'OKX',
                symbol,
                side:         d.side === 'sell' ? 'long' : 'short',
                liq_type:     'market',
                price_usd:    price,
                amount_token: amount,
                notional_usd: price * amount,
                timestamp_ms: parseInt(d.ts || item.ts || Date.now().toString()),
                raw_order_id: generateUniqueId(parseInt(d.ts || Date.now().toString())),
              });
            });
          });
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => { this.onStatus?.('error'); };

    this.ws.onclose = (e) => {
      this.onStatus?.('disconnected');
      console.warn(`[OKX] WS closed (${e.code}), reconnecting in 5s...`);
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  disconnect() {
    this.destroyed = true;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.onStatus?.('disconnected');
  }
}
