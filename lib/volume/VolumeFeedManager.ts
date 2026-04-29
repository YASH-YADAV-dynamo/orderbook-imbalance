import { NormalizedTrade } from './types';
import { BaseVolumeFeed } from './BaseVolumeFeed';
import { binanceAdapter } from './adapters/binance';
import { bybitAdapter } from './adapters/bybit';
import { okxAdapter } from './adapters/okx';
import { hyperliquidAdapter } from './adapters/hyperliquid';
import { bitgetAdapter } from './adapters/bitget';

export class VolumeFeedManager {
  private feeds: BaseVolumeFeed[] = [];
  private onEvent: (event: NormalizedTrade) => void;
  private onStatus?: (exchange: string, status: string) => void;
  private symbols: string[];

  constructor(
    symbols: string[],
    onEvent: (event: NormalizedTrade) => void,
    onStatus?: (exchange: string, status: string) => void
  ) {
    this.symbols = symbols;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }

  start() {
    const adapters = [
      binanceAdapter,
      bybitAdapter,
      okxAdapter,
      hyperliquidAdapter,
      bitgetAdapter
    ];

    this.feeds = adapters.map(adapter => {
      const feed = new BaseVolumeFeed(
        adapter,
        this.symbols,
        this.onEvent,
        (status) => this.onStatus?.(adapter.id, status)
      );
      feed.connect();
      return feed;
    });
  }

  stop() {
    this.feeds.forEach(feed => feed.disconnect());
    this.feeds = [];
  }
}
