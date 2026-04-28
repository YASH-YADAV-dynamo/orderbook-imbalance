import { LiquidationEvent } from './types';
import { generateUniqueId } from './utils';
import { FeedStatus } from './binanceFeed';

const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT',
  'LINKUSDT', 'PEPEUSDT', 'WIFUSDT', 'SUIUSDT', 'APTUSDT',
  'OPUSDT', 'ARBUSDT', 'LDOUSDT', 'JUPUSDT', 'TIAUSDT',
  'NEARUSDT', 'FETUSDT', 'INJUSDT', 'RENDERUSDT', 'SEIUSDT',
  'STXUSDT', 'ORDIUSDT', 'TONUSDT', 'WLDUSDT', 'MATICUSDT',
];

export class BybitFeed {
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
    this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

    this.ws.onopen = () => {
      console.log('[Bybit] Feed connected ✓');
      this.onStatus?.('connected');
      for (let i = 0; i < this.symbols.length; i += 10) {
        const chunk = this.symbols.slice(i, i + 10);
        this.ws?.send(JSON.stringify({
          op:   'subscribe',
          args: chunk.map(s => `liquidation.${s}`),
        }));
      }
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, 20000);
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.op === 'pong' || data.op === 'subscribe' || data.success !== undefined) return;

        if (data.topic?.startsWith('liquidation.') && data.data) {
          const item = data.data;
          const price = parseFloat(item.price);
          const size  = parseFloat(item.size);
          if (!price || !size) return;

          this.onEvent({
            dex:          'BYBIT',
            symbol:       item.symbol.replace('USDT', ''),
            side:         item.side === 'Sell' ? 'long' : 'short',
            liq_type:     'market',
            price_usd:    price,
            amount_token: size,
            notional_usd: price * size,
            timestamp_ms: item.updatedTime || Date.now(),
            raw_order_id: generateUniqueId(item.updatedTime || Date.now()),
          });
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => { this.onStatus?.('error'); };

    this.ws.onclose = (e) => {
      this.onStatus?.('disconnected');
      console.warn(`[Bybit] WS closed (${e.code}), reconnecting in 3s...`);
      if (this.pingInterval) clearInterval(this.pingInterval);
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
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.onStatus?.('disconnected');
  }
}
