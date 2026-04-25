import { LiquidationEvent } from './types';

export class BinanceFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private symbols: string[];
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(onEvent: (event: LiquidationEvent) => void, symbols: string[] = []) {
    this.onEvent = onEvent;
    this.symbols = symbols;
  }

  connect() {
    // !forceOrder@arr stream is an aggregate of ALL liquidations on Binance Futures
    const url = 'wss://fstream.binance.com/ws/!forceOrder@arr';
    
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Binance Liquidation Feed connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === 'forceOrder') {
          const order = data.o;
          
          // Filter by symbols if provided
          if (this.symbols.length > 0 && !this.symbols.includes(order.s)) {
            return;
          }

          const normalized: LiquidationEvent = {
            dex: 'binance',
            symbol: order.s.replace('USDT', ''), // Normalize symbol (e.g. BTCUSDT -> BTC)
            side: order.S === 'SELL' ? 'long' : 'short', // SELL means a Long was liquidated
            liq_type: 'market',
            price_usd: parseFloat(order.p),
            amount_token: parseFloat(order.q),
            notional_usd: parseFloat(order.p) * parseFloat(order.q),
            timestamp_ms: data.E,
            raw_order_id: data.E + Math.random(), // Binance doesn't provide a unique ID per liquidation in this stream
          };

          this.onEvent(normalized);
        }
      } catch (err) {
        console.error('Binance WS Parse Error:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Binance WS Error:', err);
    };

    this.ws.onclose = (event) => {
      console.warn(`Binance WS Closed: Code ${event.code} (${this.getCloseCodeDescription(event.code)}), Reason: ${event.reason || 'None'}, ReadyState: ${this.ws?.readyState}`);
      this.reconnect();
    };
  }

  private getCloseCodeDescription(code: number): string {
    const codes: Record<number, string> = {
      1000: 'Normal Closure',
      1001: 'Going Away',
      1002: 'Protocol Error',
      1003: 'Unsupported Data',
      1005: 'No Status Rcvd',
      1006: 'Abnormal Closure (Network/Security)',
      1007: 'Invalid frame payload data',
      1008: 'Policy Violation',
      1009: 'Message Too Big',
      1010: 'Mandatory Ext.',
      1011: 'Internal Error',
      1015: 'TLS handshake',
    };
    return codes[code] || 'Unknown';
  }

  private reconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect loop
      this.ws.close();
    }
  }
}
