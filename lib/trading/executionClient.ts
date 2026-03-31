import type {
  AgentActivateRequest,
  AgentActivateResponse,
  ApproveBrokerRequest,
  ApproveBrokerResponse,
  AccountStatusRequest,
  AccountStatusResponse,
  AgentChallengeRequest,
  AgentChallengeResponse,
  AgentRegisterRequest,
  AgentRegisterResponse,
  PlaceIntentRequest,
  PlaceIntentResponse,
  OrderContextRequest,
  OrderContextResponse,
} from '@/types/trading';

const BASE = '/api/trading';

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return data.error ?? data.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function postJson<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as TRes;
}

export function fetchAccountStatus(body: AccountStatusRequest): Promise<AccountStatusResponse> {
  return postJson<AccountStatusRequest, AccountStatusResponse>('/account/status', body);
}

export function createAgentChallenge(body: AgentChallengeRequest): Promise<AgentChallengeResponse> {
  return postJson<AgentChallengeRequest, AgentChallengeResponse>('/agent/challenge', body);
}

export function registerAgent(body: AgentRegisterRequest): Promise<AgentRegisterResponse> {
  return postJson<AgentRegisterRequest, AgentRegisterResponse>('/agent/register', body);
}

export function placeTradeIntent(body: PlaceIntentRequest): Promise<PlaceIntentResponse> {
  return postJson<PlaceIntentRequest, PlaceIntentResponse>('/orders/intent', body);
}

export function approveBroker(body: ApproveBrokerRequest): Promise<ApproveBrokerResponse> {
  return postJson<ApproveBrokerRequest, ApproveBrokerResponse>('/broker/approve', body);
}

export function fetchOrderContext(body: OrderContextRequest): Promise<OrderContextResponse> {
  return postJson<OrderContextRequest, OrderContextResponse>('/orders/context', body);
}

export function activateAgent(body: AgentActivateRequest): Promise<AgentActivateResponse> {
  return postJson<AgentActivateRequest, AgentActivateResponse>('/agent/activate', body);
}
