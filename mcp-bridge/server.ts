/**
 * HTTP bridge for hosted MCP usage.
 * Keeps core logic server-side by exposing read-only endpoints over HTTPS.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { WSAggregator } from '../mcp-server/wsAggregator';
import { getAllPairs } from '../lib/pairs';

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.MCP_BRIDGE_API_KEY ?? '';
const ALL_PAIRS = getAllPairs().map((p) => p.id);
const aggregators = new Map<string, WSAggregator>();

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text, 'utf8'),
  });
  res.end(text);
}

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function authOK(req: http.IncomingMessage): boolean {
  const header = req.headers['x-api-key'];
  const fromHeader = typeof header === 'string' ? header : header?.[0] ?? '';
  const auth = req.headers.authorization ?? '';
  const fromBearer =
    auth.startsWith('Bearer ') || auth.startsWith('bearer ') ? auth.slice(7).trim() : '';
  const token = fromHeader || fromBearer;
  return Boolean(API_KEY && token && safeEq(token, API_KEY));
}

if (!API_KEY) {
  process.stderr.write('Missing MCP_BRIDGE_API_KEY\n');
  process.exit(1);
}

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

function buildSingle(path: string, pair: string): unknown {
  const agg = getAggregator(pair);
  if (!agg) return { error: `Unsupported symbol: ${pair}`, supportedPairs: ALL_PAIRS };
  if (path === '/v1/signals') return { pair, data: agg.getSignals() };
  if (path === '/v1/leaderboard') return { pair, data: agg.getLeaderboard() };
  return { pair, data: agg.getArbitrage() };
}

function buildAll(path: string): unknown {
  const out: Record<string, unknown> = {};
  for (const pair of ALL_PAIRS) {
    out[pair] = buildSingle(path, pair);
  }
  return { pairs: out };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  const symbol = url.searchParams.get('symbol')?.toUpperCase();

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true, pairCount: ALL_PAIRS.length });
    return;
  }

  if (req.method === 'GET' && path === '/v1/pairs') {
    sendJson(res, 200, { pairs: ALL_PAIRS });
    return;
  }

  if (!authOK(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    if (path === '/v1/signals' || path === '/v1/leaderboard' || path === '/v1/arbitrage') {
      sendJson(res, 200, symbol ? buildSingle(path, symbol) : buildAll(path));
      return;
    }
    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: 'Internal error', message: String(err) });
  }
});

server.listen(PORT, () => {
  process.stderr.write(`mcp-bridge listening on :${PORT} pairs=${ALL_PAIRS.length}\n`);
});
