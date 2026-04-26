import { LiquidationEvent } from './types';
import { generateUniqueId } from './utils';
import { FeedStatus } from './binanceFeed';

const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT',
  'LINKUSDT', 'PEPEUSDT', 'WIFUSDT', 'SUIUSDT', 'APTUSDT',
  'LDOUSDT', 'JUPUSDT', 'TIAUSDT', 'NEARUSDT', 'INJUSDT',
];

export class BitgetFeed {
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
    this.ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');

    this.ws.onopen = () => {
      console.log('[Bitget] Feed connected ✓');
      this.onStatus?.('connected');
      this.ws?.send(JSON.stringify({
        op:   'subscribe',
        args: this.symbols.map(s => ({
          instType: 'USDT-FUTURES',
          channel:  'liquidation',
          instId:   s,
        })),
      }));
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
      }, 30000);
    };

    this.ws.onmessage = (msg) => {
      try {
        if (msg.data === 'pong') return;
        const data = JSON.parse(msg.data);
        if (data.event === 'subscribe') return;

        if (data.action === 'push' && data.arg?.channel === 'liquidation' && data.data) {
          data.data.forEach((item: any) => {
            const price = parseFloat(item.price ?? item.fillPrice ?? '0');
            const size  = parseFloat(item.size ?? item.baseVolume ?? '0');
            if (!price || !size) return;

            this.onEvent({
              dex:          'BITGET',
              symbol:       (item.instId ?? item.symbol ?? '').replace('USDT', ''),
              side:         (item.posSide === 'long' || item.side === 'sell') ? 'long' : 'short',
              liq_type:     'market',
              price_usd:    price,
              amount_token: size,
              notional_usd: price * size,
              timestamp_ms: parseInt(item.ts ?? item.cTime ?? Date.now().toString()),
              raw_order_id: generateUniqueId(parseInt(item.ts ?? Date.now().toString())),
            });
          });
        }
      } catch { /* ignore */ }
    };

    this.ws.onerror = () => { this.onStatus?.('error'); };

    this.ws.onclose = (e) => {
      this.onStatus?.('disconnected');
      console.warn(`[Bitget] WS closed (${e.code}), reconnecting in 5s...`);
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
