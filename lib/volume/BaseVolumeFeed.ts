import { VolumeAdapter } from './volumeAdapters';
import { NormalizedTrade } from './types';

export type FeedStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export class BaseVolumeFeed {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private destroyed = false;
  private symbols: string[];
  private adapter: VolumeAdapter;
  private onEvent: (event: NormalizedTrade) => void;
  private onStatus?: (status: FeedStatus) => void;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    adapter: VolumeAdapter,
    symbols: string[],
    onEvent: (event: NormalizedTrade) => void,
    onStatus?: (status: FeedStatus) => void
  ) {
    this.adapter = adapter;
    this.symbols = symbols;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }

  connect() {
    if (this.destroyed) return;
    
    this.onStatus?.('connecting');
    const url = this.adapter.getWsUrl(this.symbols);
    
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(`[VolumeFeed][${this.adapter.id}] Connected ✓`);
        this.onStatus?.('connected');
        
        // Subscribe to symbols
        const msgs = this.adapter.getSubscribeMsgs(this.symbols);
        msgs.forEach(msg => this.ws?.send(JSON.stringify(msg)));

        // Start pinging if supported
        if (this.adapter.getPingMsg && this.adapter.pingIntervalMs) {
          this.startPinging();
        }
      };

      this.ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          const result = this.adapter.parseTrade(data);
          if (!result) return;

          if (Array.isArray(result)) {
            result.forEach(trade => this.onEvent(trade));
          } else {
            this.onEvent(result);
          }
        } catch (e) {
          // Silent catch for parse errors
        }
      };

      this.ws.onerror = () => {
        this.onStatus?.('error');
      };

      this.ws.onclose = (e) => {
        this.onStatus?.('disconnected');
        this.stopPinging();
        if (!this.destroyed) {
          console.warn(`[VolumeFeed][${this.adapter.id}] WS closed (${e.code}), reconnecting...`);
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error(`[VolumeFeed][${this.adapter.id}] Connection failed:`, err);
      this.scheduleReconnect();
    }
  }

  private startPinging() {
    this.stopPinging();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN && this.adapter.getPingMsg) {
        this.ws.send(JSON.stringify(this.adapter.getPingMsg()));
      }
    }, this.adapter.pingIntervalMs);
  }

  private stopPinging() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  disconnect() {
    this.destroyed = true;
    this.stopPinging();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.onStatus?.('disconnected');
  }
}
