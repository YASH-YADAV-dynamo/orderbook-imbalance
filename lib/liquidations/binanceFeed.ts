import { LiquidationEvent } from './types';
import { generateUniqueId } from './utils';

export type FeedStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export class BinanceFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private onStatus?: (status: FeedStatus) => void;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(
    onEvent: (event: LiquidationEvent) => void,
    onStatus?: (status: FeedStatus) => void,
  ) {
    this.onEvent   = onEvent;
    this.onStatus  = onStatus;
  }

  connect() {
    if (this.destroyed) return;
    this.onStatus?.('connecting');
    this.ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

    this.ws.onopen = () => {
      console.log('[Binance] Feed connected ✓');
      this.onStatus?.('connected');
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.e !== 'forceOrder') return;
        const o = data.o;
        const price = parseFloat(o.ap || o.p);
        const qty   = parseFloat(o.q);
        if (!price || !qty) return;

        this.onEvent({
          dex:          'BINANCE',
          symbol:       o.s.replace('USDT', ''),
          side:         o.S === 'SELL' ? 'long' : 'short',
          liq_type:     'market',
          price_usd:    price,
          amount_token: qty,
          notional_usd: price * qty,
          timestamp_ms: data.E || Date.now(),
          raw_order_id: generateUniqueId(data.E),
        });
      } catch { /* ignore parse errors */ }
    };

    this.ws.onerror = () => { this.onStatus?.('error'); };

    this.ws.onclose = (e) => {
      this.onStatus?.('disconnected');
      console.warn(`[Binance] WS closed (${e.code}), reconnecting in 3s...`);
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
