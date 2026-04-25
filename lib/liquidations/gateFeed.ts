import { LiquidationEvent } from './types';

export class GateFeed {
  private ws: WebSocket | null = null;
  private onEvent: (event: LiquidationEvent) => void;
  private symbols: string[];
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private defaultSymbols = [
    'BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT', 
    'DOGE_USDT', 'ADA_USDT', 'AVAX_USDT', 'SHIB_USDT', 'DOT_USDT'
  ];

  constructor(onEvent: (event: LiquidationEvent) => void, symbols?: string[]) {
    this.onEvent = onEvent;
    this.symbols = symbols || this.defaultSymbols;
  }

  connect() {
    const url = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Gate.io Liquidation Feed connected');
      this.ws?.send(JSON.stringify({
        time: Math.floor(Date.now() / 1000),
        channel: 'futures.liquidates',
        event: 'subscribe',
        payload: this.symbols
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.channel === 'futures.liquidates' && data.event === 'update') {
          data.result.forEach((item: any) => {
            const normalized: LiquidationEvent = {
              dex: 'gate.io',
              symbol: item.contract.split('_')[0],
              side: item.order_price.includes('-') ? 'long' : 'short', // Gate logic varies
              liq_type: 'market',
              price_usd: parseFloat(item.fill_price),
              amount_token: Math.abs(parseFloat(item.size)),
              notional_usd: parseFloat(item.fill_price) * Math.abs(parseFloat(item.size)),
              timestamp_ms: item.time * 1000,
              raw_order_id: `gate-${item.contract}-${item.time}-${Math.random()}`,
            };
            this.onEvent(normalized);
          });
        }
      } catch (err) {
        console.error('Gate.io WS Parse Error:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Gate.io WS Error:', err);
    };

    this.ws.onclose = () => {
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
