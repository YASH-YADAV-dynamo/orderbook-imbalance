export type ExecutionExchange = 'pacifica' | 'hyperliquid' | 'hotstuff';
export type ExecutionSide = 'buy' | 'sell';
export type ExecutionOrderType = 'market' | 'limit';
export type ExecutionTif = 'IOC' | 'GTC';

export interface TradeIntent {
  exchange: ExecutionExchange;
  symbol: string;
  side: ExecutionSide;
}

export interface AccountStatusRequest {
  exchange: ExecutionExchange;
  walletAddress: string;
}

export interface AccountStatusResponse {
  hasExchangeAccount: boolean;
  hasApiAgent: boolean;
  apiAgentId?: string;
  brokerApproved?: boolean;
  canTrade: boolean;
  createAccountUrl?: string;
  connectAccountUrl?: string;
  message?: string;
}

export interface AgentChallengeRequest {
  exchange: ExecutionExchange;
  walletAddress: string;
}

export interface AgentChallengeResponse {
  challengeId: string;
  message: string;
  expiresAt?: number;
}

export interface AgentRegisterRequest {
  exchange: ExecutionExchange;
  walletAddress: string;
  challengeId: string;
  signature: string;
}

export interface AgentRegisterResponse {
  agentId: string;
  status: 'active' | 'pending';
  message?: string;
}

export interface AgentActivateRequest {
  exchange: ExecutionExchange;
  walletAddress: string;
  apiAgentId: string;
  signedAgentPayload: unknown;
}

export interface AgentActivateResponse {
  agentId: string;
  status: 'active' | 'pending' | 'rejected';
  message?: string;
}

export interface PlaceIntentRequest {
  exchange: ExecutionExchange;
  walletAddress: string;
  symbol: string;
  side: ExecutionSide;
  sizeUsd: string;
  apiAgentId?: string;
  autoApproveBroker?: boolean;
  orderType?: ExecutionOrderType;
  tif?: ExecutionTif;
  slippagePct?: string;
  limitPrice?: string;
  signedOrderPayload?: unknown;
}

export interface PlaceIntentResponse {
  intentId: string;
  status: 'accepted' | 'queued' | 'rejected';
  message?: string;
  exchangeTxHash?: string;
  exchangeOrderId?: string;
  exchangeAddress?: string;
  executed?: boolean;
  executionPrice?: string;
  executionSize?: string;
  executionTimestamp?: string;
}

export interface OrderContextRequest {
  exchange: ExecutionExchange;
  symbol: string;
}

export interface OrderContextResponse {
  instrumentId: number;
  nativeSymbol: string;
  markPrice: string;
}

export interface ApproveBrokerRequest {
  exchange: ExecutionExchange;
  walletAddress: string;
  apiAgentId?: string;
  signedApprovalPayload?: unknown;
}

export interface ApproveBrokerResponse {
  approvalId: string;
  status: 'approved' | 'pending' | 'rejected';
  message?: string;
}
