import { z } from 'zod';

export const ExchangeSchema = z.enum(['pacifica', 'hyperliquid', 'hotstuff']);
export const SideSchema = z.enum(['buy', 'sell']);
export const WalletSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const AccountStatusSchema = z.object({
  exchange: ExchangeSchema,
  walletAddress: WalletSchema,
});

export const AgentChallengeSchema = AccountStatusSchema;

export const AgentRegisterSchema = z.object({
  exchange: ExchangeSchema,
  walletAddress: WalletSchema,
  challengeId: z.string().min(1),
  signature: z.string().min(10),
});

export const AgentActivateSchema = z.object({
  exchange: ExchangeSchema,
  walletAddress: WalletSchema,
  apiAgentId: WalletSchema,
  signedAgentPayload: z.unknown(),
});

export const PlaceIntentSchema = z.object({
  exchange: ExchangeSchema,
  walletAddress: WalletSchema,
  symbol: z.string().includes('/'),
  side: SideSchema,
  sizeUsd: z.string().min(1),
  apiAgentId: z.string().optional(),
  autoApproveBroker: z.boolean().optional(),
  orderType: z.enum(['market', 'limit']).optional(),
  tif: z.enum(['IOC', 'GTC']).optional(),
  slippagePct: z.string().optional(),
  limitPrice: z.string().optional(),
  signedOrderPayload: z.unknown().optional(),
});

export const OrderContextSchema = z.object({
  exchange: ExchangeSchema,
  symbol: z.string().includes('/'),
});

export const ApproveBrokerSchema = z.object({
  exchange: ExchangeSchema,
  walletAddress: WalletSchema,
  apiAgentId: z.string().optional(),
  signedApprovalPayload: z.unknown().optional(),
});

export type Exchange = z.infer<typeof ExchangeSchema>;
export type AccountStatusInput = z.infer<typeof AccountStatusSchema>;
export type AgentChallengeInput = z.infer<typeof AgentChallengeSchema>;
export type AgentRegisterInput = z.infer<typeof AgentRegisterSchema>;
export type AgentActivateInput = z.infer<typeof AgentActivateSchema>;
export type PlaceIntentInput = z.infer<typeof PlaceIntentSchema>;
export type ApproveBrokerInput = z.infer<typeof ApproveBrokerSchema>;
export type OrderContextInput = z.infer<typeof OrderContextSchema>;
