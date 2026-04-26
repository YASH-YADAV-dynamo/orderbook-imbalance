import { LiquidationEvent } from './types';
import { generateUniqueId } from './utils';
import { FeedStatus } from './binanceFeed';

export class HyperliquidFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private onStatus?: (status: FeedStatus) => void;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(onEvent: (event: LiquidationEvent) => void, onStatus?: (status: FeedStatus) => void) {
    this.onEvent  = onEvent;
    this.onStatus = onStatus;
  }

  connect() {
    if (this.destroyed) return;
    this.onStatus?.('connecting');
    this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    this.ws.onopen = () => {
      console.log('[Hyperliquid] Feed connected ✓');
      this.onStatus?.('connected');
      this.ws?.send(JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'liquidations' },
      }));
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.channel === 'subscriptionResponse') return;

        if (data.channel === 'liquidations' && data.data) {
          const items: any[] = Array.isArray(data.data) ? data.data : [data.data];
          items.forEach((liq: any) => {
            const price = parseFloat(liq.px ?? liq.p ?? '0');
            const size  = parseFloat(liq.sz ?? '0');
            if (!price || !size) return;
            this.onEvent({
              dex:          'HYPERLIQUID',
              symbol:       liq.coin ?? '',
              side:         (liq.side === 'S' || liq.side === 'sell') ? 'long' : 'short',
              liq_type:     'market',
              price_usd:    price,
              amount_token: size,
              notional_usd: price * size,
              timestamp_ms: liq.time ?? liq.ts ?? Date.now(),
              raw_order_id: generateUniqueId(liq.time ?? Date.now()),
            });
          });
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => { this.onStatus?.('error'); };

    this.ws.onclose = (e) => {
      this.onStatus?.('disconnected');
      console.warn(`[Hyperliquid] WS closed (${e.code}), reconnecting in 3s...`);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.onStatus?.('disconnected');
  }
}
