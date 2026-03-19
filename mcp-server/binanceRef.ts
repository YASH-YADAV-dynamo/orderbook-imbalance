/**
 * Binance spot USDT bookTicker → mid price for MCP referenceMid (parity with browser useBinancePrice).
 */

import WebSocket from 'ws';

const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

export function pairToBinanceStreamSymbol(pairId: string): string {
  const base = pairId.split('/')[0]?.toLowerCase();
  if (!base) return '';
  return `${base}usdt`;
}

export class BinanceBookTicker {
  private mid = 0;
  private lastUpdate = 0;
  private connected = false;
  private ws: WebSocket | null = null;

  constructor(private readonly pairId: string) {}

  connect(): void {
    const sym = pairToBinanceStreamSymbol(this.pairId);
    if (!sym) return;

    const url = `${BINANCE_WS}/${sym}@bookTicker`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      this.connected = true;
    });

    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof data === 'string' ? data : data.toString()) as {
          b?: string;
          a?: string;
        };
        const bid = parseFloat(msg.b ?? '');
        const ask = parseFloat(msg.a ?? '');
        if (bid > 0 && ask > 0) {
          this.mid = (bid + ask) / 2;
          this.lastUpdate = Date.now();
        }
      } catch {
        /* ignore */
      }
    });

    ws.on('close', () => {
      this.connected = false;
    });

    ws.on('error', () => {
      this.connected = false;
      ws.close();
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  /**
   * Mid to pass into computeImbalance as referenceMid when stream is healthy and fresh.
   */
  getReferenceMid(staleMs: number): number | undefined {
    if (!this.connected || this.mid <= 0) return undefined;
    if (Date.now() - this.lastUpdate > staleMs) return undefined;
    return this.mid;
  }

  snapshotMeta(): {
    referenceMid: number;
    lastUpdate: number;
    connected: boolean;
  } {
    return {
      referenceMid: this.mid,
      lastUpdate: this.lastUpdate,
      connected: this.connected,
    };
  }
}
