import { LiquidationEvent } from './types';

export class BitgetFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private symbols: string[];
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private defaultSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT',
    'LINKUSDT', 'PEPEUSDT', 'WIFUSDT', 'FETUSDT', 'RNDRUSDT'
  ];

  constructor(onEvent: (event: LiquidationEvent) => void, symbols?: string[]) {
    this.onEvent = onEvent;
    this.symbols = symbols || this.defaultSymbols;
  }

  connect() {
    const url = 'wss://ws.bitget.com/v2/ws/public';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Bitget Liquidation Feed connected');
      // Bitget V2 subscription
      this.ws?.send(JSON.stringify({
        op: 'subscribe',
        args: this.symbols.map(s => ({
          instType: 'USDT-FUTURES',
          channel: 'liquidation',
          instId: s
        }))
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'push' && data.arg?.channel === 'liquidation') {
          data.data.forEach((item: any) => {
            const normalized: LiquidationEvent = {
              dex: 'bitget',
              symbol: item.instId.replace('USDT', ''),
              side: item.side === 'sell' ? 'long' : 'short', // sell side liq = long closed
              liq_type: 'market',
              price_usd: parseFloat(item.price),
              amount_token: parseFloat(item.size),
              notional_usd: parseFloat(item.price) * parseFloat(item.size),
              timestamp_ms: parseInt(item.ts),
              raw_order_id: `bitget-${item.instId}-${item.ts}-${Math.random()}`,
            };
            this.onEvent(normalized);
          });
        }
      } catch (err) {
        console.error('Bitget WS Parse Error:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Bitget WS Error:', err);
    };

    this.ws.onclose = (event) => {
      console.warn(`Bitget WS Closed: ${event.code}`);
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
