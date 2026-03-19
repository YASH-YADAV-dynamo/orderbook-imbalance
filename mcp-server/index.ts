#!/usr/bin/env node
/**
 * MCP Server for Orderbook Imbalance.
 * Connects to DEX WebSockets + Binance bookTicker (reference mid for imbalances).
 * Signals: noise-reduced (5-stage) only. Arbitrage scores weighted (Hyperliquid 2× vs others; Binance via ref mid).
 * Run: npx tsx mcp-server/index.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { WSAggregator } from './wsAggregator';

const DEFAULT_PAIR = 'BTC/USD';

const aggregator = new WSAggregator(DEFAULT_PAIR, 'distanceWeighted', undefined);
aggregator.connect();

const server = new McpServer({
  name: 'orderbook-signals',
  version: '0.1.0',
});

server.registerTool(
  'get_signals',
  {
    description:
      'Noise-reduced trading signals per DEX. _meta: Binance USDT mid as referenceMid when fresh; per-venue keys hold value/confidence/raw.',
    inputSchema: {
      symbol: z.string().optional().describe('Pair id, e.g. BTC/USD (default: BTC/USD)'),
    },
  },
  async () => {
    const signals = aggregator.getSignals();
    const text = JSON.stringify(signals, null, 2);
    return { content: [{ type: 'text' as const, text }] };
  },
);

server.registerTool(
  'get_leaderboard',
  {
    description:
      'Leaderboard ranked by |noise-reduced imbalance| (most extreme first). Includes _meta with Binance reference info.',
    inputSchema: {
      symbol: z.string().optional().describe('Pair id (default: BTC/USD)'),
    },
  },
  async () => {
    const leaderboard = aggregator.getLeaderboard();
    const text = JSON.stringify(leaderboard, null, 2);
    return { content: [{ type: 'text' as const, text }] };
  },
);

server.registerTool(
  'get_arbitrage',
  {
    description:
      'Cross-DEX signal spread ranking (not executable PnL). Weighted: sqrt(w_buy*w_sell) with Hyperliquid=2, others=1; Binance anchors imbalances via referenceMid.',
    inputSchema: {
      symbol: z.string().optional().describe('Pair id (default: BTC/USD)'),
    },
  },
  async () => {
    const arb = aggregator.getArbitrage();
    const text = JSON.stringify(arb, null, 2);
    return { content: [{ type: 'text' as const, text }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Orderbook MCP Server running on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
