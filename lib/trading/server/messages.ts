export const TRADING_ERRORS = {
  invalidExchange: 'Invalid exchange',
  invalidWalletAddress: 'Invalid wallet address',
  invalidSymbol: 'Invalid symbol',
  invalidSide: 'Invalid side',
  invalidSizeUsd: 'Invalid sizeUsd',
  accountNotFound: 'Account not found on exchange',
  apiAgentNotConfigured: 'API agent not configured',
  challengeNotFound: 'Challenge not found or already used',
  challengeExpired: 'Challenge expired',
  challengeMismatch: 'Challenge context mismatch',
  routeNotFound: 'Route not found',
  methodNotAllowed: 'Method not allowed',
  missingChallengeId: 'Missing challengeId',
  invalidSignature: 'Invalid signature format',
  apiAgentMismatch: 'apiAgentId mismatch',
  brokerApprovalFailed: 'Broker approval failed',
  signedOrderPayloadRequired: 'signedOrderPayload is required for trade placement',
} as const;

export const TRADING_MESSAGES = {
  accountReadyNoAgent: 'Account found, API agent not created yet',
  accountReadyWithAgent: 'API agent already active',
  agentRegistered: 'API agent registered',
  brokerApproved: 'Broker approval recorded',
  brokerPending: 'Broker approval queued',
  intentAccepted: 'Trade placed',
  intentQueued: 'Trade queued',
} as const;
