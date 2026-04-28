import { LiquidationEvent } from './types';
import { generateUniqueId } from './utils';
import { FeedStatus } from './binanceFeed';

const DEFAULT_SYMBOLS = [
  'BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT',
  'DOGE_USDT', 'ADA_USDT', 'AVAX_USDT', 'LINK_USDT', 'DOT_USDT',
  'PEPE_USDT', 'WIF_USDT', 'SUI_USDT', 'APT_USDT', 'NEAR_USDT',
];

export class GateFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private onStatus?: (status: FeedStatus) => void;
  private symbols: string[];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(
    onEvent: (event: LiquidationEvent) => void,
    onStatus?: (status: FeedStatus) => void,
    symbols?: string[],
  ) {
    this.onEvent  = onEvent;
    this.onStatus = onStatus;
    this.symbols  = symbols || DEFAULT_SYMBOLS;
  }

  connect() {
    if (this.destroyed) return;
    this.onStatus?.('connecting');
    this.ws = new WebSocket('wss://fx-ws.gateio.ws/v4/ws/usdt');

    this.ws.onopen = () => {
      console.log('[Gate.io] Feed connected ✓');
      this.onStatus?.('connected');
      this.ws?.send(JSON.stringify({
        time:    Math.floor(Date.now() / 1000),
        channel: 'futures.liquidates',
        event:   'subscribe',
        payload: this.symbols,
      }));
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel: 'futures.ping' }));
        }
      }, 30000);
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.channel === 'futures.liquidates' && data.event === 'update' && data.result) {
          const items: any[] = Array.isArray(data.result) ? data.result : [data.result];
          items.forEach((item: any) => {
            const price = parseFloat(item.fill_price ?? item.order_price ?? '0');
            const size  = Math.abs(parseFloat(item.size ?? '0'));
            if (!price || !size) return;
            this.onEvent({
              dex:          'GATE.IO',
              symbol:       item.contract.split('_')[0],
              side:         parseFloat(item.size ?? '0') < 0 ? 'short' : 'long',
              liq_type:     'market',
              price_usd:    price,
              amount_token: size,
              notional_usd: price * size,
              timestamp_ms: (item.time ?? 0) * 1000 || Date.now(),
              raw_order_id: generateUniqueId((item.time ?? 0) * 1000),
            });
          });
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => { this.onStatus?.('error'); };

    this.ws.onclose = (e) => {
      this.onStatus?.('disconnected');
      console.warn(`[Gate.io] WS closed (${e.code}), reconnecting in 5s...`);
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
