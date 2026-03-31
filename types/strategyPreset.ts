export type StrategyKind = 'funding_basis' | 'maker_taker';

export interface StrategyPresetParams {
  minSpreadBps: number;
  maxNotionalUsd: number;
  maxOpenPositions: number;
}

export interface StrategyPreset {
  id: string;
  name: string;
  kind: StrategyKind;
  symbols: string[];
  params: StrategyPresetParams;
  createdAt: number;
  updatedAt: number;
}

export interface StrategyRunResult {
  runId: string;
  presetId: string;
  createdAt: number;
  symbolsAnalyzed: number;
  averageSpreadBps: number;
  bestSpreadBps: number;
  opportunities: number;
  note: string;
}
