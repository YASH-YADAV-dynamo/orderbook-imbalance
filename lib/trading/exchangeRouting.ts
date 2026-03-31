import type { AdapterId } from '@/lib/dexAdapters';
import type { ExecutionExchange } from '@/types/trading';

const ADAPTER_TO_EXECUTION_EXCHANGE: Partial<Record<AdapterId, ExecutionExchange>> = {
  pacifica: 'pacifica',
  hyperliquid: 'hyperliquid',
  hotstuff: 'hotstuff',
};

export function toExecutionExchange(adapterId: AdapterId): ExecutionExchange | null {
  return ADAPTER_TO_EXECUTION_EXCHANGE[adapterId] ?? null;
}
