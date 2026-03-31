/**
 * Trading server flow and envs
 *
 * Required env vars:
 * - NEXT_PUBLIC_HOTSTUFF_HTTP
 * Optional:
 * - NEXT_PUBLIC_HOTSTUFF_WS
 * - NEXT_PUBLIC_BROKER_ADDRESS
 * - NEXT_PUBLIC_MAX_FEE_RATE
 * - NEXT_PUBLIC_AGENT_VALID_DAYS
 *
 * Flow used by /api/trading:
 * 1) account/status -> checks account + existing agent
 * 2) agent/challenge -> returns a one-time message to sign
 * 3) agent/register -> verifies challenge context and stores agent
 * 4) broker/approve -> records or forwards broker-fee approval payload
 * 5) orders/intent -> records intent and optionally forwards signed payload
 */

export * from './router';
