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
import { getAllPairs } from '../lib/pairs';

const ALL_PAIRS = getAllPairs().map((p) => p.id);
const aggregators = new Map<string, WSAggregator>();

function getAggregator(pair: string): WSAggregator | null {
  if (!ALL_PAIRS.includes(pair)) return null;
  let agg = aggregators.get(pair);
  if (!agg) {
    agg = new WSAggregator(pair, 'distanceWeighted', undefined);
    agg.connect();
    aggregators.set(pair, agg);
  }
  return agg;
}

function outputByPair(
  symbol: string | undefined,
  f: (agg: WSAggregator) => unknown,
): unknown {
  if (symbol) {
    const pair = symbol.toUpperCase();
    const agg = getAggregator(pair);
    if (!agg) return { error: `Unsupported symbol: ${pair}`, supportedPairs: ALL_PAIRS };
    return { pair, data: f(agg) };
  }
  const out: Record<string, unknown> = {};
  for (const pair of ALL_PAIRS) {
    const agg = getAggregator(pair);
    if (agg) out[pair] = f(agg);
  }
  return { pairs: out };
}

const server = new McpServer({
  name: 'orderbook-signals',
  version: '0.1.0',
});

server.registerTool(
  'get_signals',
  {
    description:
      'Noise-reduced trading signals per DEX for one symbol or all configured symbols.',
    inputSchema: {
      symbol: z.string().optional().describe('Pair id, e.g. BTC/USD. Omit to return all pairs.'),
    },
  },
  async ({ symbol }) => {
    const signals = outputByPair(symbol, (agg) => agg.getSignals());
    const text = JSON.stringify(signals, null, 2);
    return { content: [{ type: 'text' as const, text }] };
  },
);

server.registerTool(
  'get_leaderboard',
  {
    description:
      'Leaderboard ranked by |noise-reduced imbalance| for one symbol or all symbols.',
    inputSchema: {
      symbol: z.string().optional().describe('Pair id. Omit to return all pairs.'),
    },
  },
  async ({ symbol }) => {
    const leaderboard = outputByPair(symbol, (agg) => agg.getLeaderboard());
    const text = JSON.stringify(leaderboard, null, 2);
    return { content: [{ type: 'text' as const, text }] };
  },
);

server.registerTool(
  'get_arbitrage',
  {
    description:
      'Cross-DEX signal spread ranking (not executable PnL) for one symbol or all symbols.',
    inputSchema: {
      symbol: z.string().optional().describe('Pair id. Omit to return all pairs.'),
    },
  },
  async ({ symbol }) => {
    const arb = outputByPair(symbol, (agg) => agg.getArbitrage());
    const text = JSON.stringify(arb, null, 2);
    return { content: [{ type: 'text' as const, text }] };
  },
);

server.registerTool(
  'get_pairs',
  {
    description: 'List all pair ids currently configured in lib/pairs.ts.',
    inputSchema: {},
  },
  async () => {
    const text = JSON.stringify({ pairs: ALL_PAIRS }, null, 2);
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
