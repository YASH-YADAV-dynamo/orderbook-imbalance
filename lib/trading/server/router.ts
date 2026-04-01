import type { NextRequest } from 'next/server';
import { ExchangeSchema } from './schemas';
import { TRADING_ERRORS } from './messages';
import { getExchangeHandler, parseJson } from './handlers';

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function routeTradingPost(req: NextRequest, routeKey: string): Promise<Response> {
  const body = await parseJson(req);
  const parsedExchange = ExchangeSchema.safeParse(body.exchange);
  if (!parsedExchange.success) {
    return jsonError(TRADING_ERRORS.invalidExchange, 400);
  }

  const handler = getExchangeHandler(parsedExchange.data);

  if (routeKey === 'account/status') return handler.accountStatus(body);
  if (routeKey === 'agent/challenge') return handler.challenge(body);
  if (routeKey === 'agent/register') return handler.register(body);
  if (routeKey === 'agent/activate') return handler.activateAgent(body);
  if (routeKey === 'broker/approve') return handler.approveBroker(body);
  if (routeKey === 'orders/context') return handler.orderContext(body);
  if (routeKey === 'orders/trade') return handler.orderIntent(body);
  if (routeKey === 'orders/intent') return handler.orderIntent(body);
  return jsonError(TRADING_ERRORS.routeNotFound, 404);
}

export function methodNotAllowed(): Response {
  return jsonError(TRADING_ERRORS.methodNotAllowed, 405);
}
