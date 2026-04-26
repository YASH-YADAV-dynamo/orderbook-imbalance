import { LiquidationEvent } from './types';
import { generateUniqueId } from './utils';
import { FeedStatus } from './binanceFeed';

export class HtxFeed {
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
    this.ws = new WebSocket('wss://api.hbdm.com/linear-swap-notification');

    this.ws.onopen = () => {
      console.log('[HTX] Feed connected ✓');
      this.onStatus?.('connected');
      this.ws?.send(JSON.stringify({ sub: 'public.linear-swap.liquidation.all', id: 'htx-liq-sub' }));
    };

    this.ws.onmessage = async (msg) => {
      try {
        let text: string;
        if (msg.data instanceof Blob) {
          if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(await msg.data.arrayBuffer());
            writer.close();
            text = await new Response(ds.readable).text();
          } else { return; }
        } else { text = msg.data; }

        const data = JSON.parse(text);

        // Must respond to ping to keep connection alive
        if (data.op === 'ping' || data.ping) {
          this.ws?.send(JSON.stringify(data.op === 'ping' ? { op: 'pong', ts: data.ts } : { pong: data.ping }));
          return;
        }

        if (data.ch === 'public.linear-swap.liquidation.all' && data.data) {
          const items: any[] = Array.isArray(data.data) ? data.data : [data.data];
          items.forEach((item: any) => {
            const price  = parseFloat(item.price ?? '0');
            const volume = parseFloat(item.volume ?? '0');
            if (!price || !volume) return;
            this.onEvent({
              dex:          'HTX',
              symbol:       item.symbol ?? '',
              side:         item.direction === 'sell' ? 'long' : 'short',
              liq_type:     'market',
              price_usd:    price,
              amount_token: volume,
              notional_usd: price * volume,
              timestamp_ms: item.ts ?? Date.now(),
              raw_order_id: generateUniqueId(item.ts ?? Date.now()),
            });
          });
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => { this.onStatus?.('error'); };

    this.ws.onclose = (e) => {
      this.onStatus?.('disconnected');
      console.warn(`[HTX] WS closed (${e.code}), reconnecting in 5s...`);
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
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.onStatus?.('disconnected');
  }
}
