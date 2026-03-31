import type { StrategyPreset } from '@/types/strategyPreset';

const STORAGE_KEY = 'strategy_presets_v1';

function isClient(): boolean {
  return typeof window !== 'undefined';
}

export function readPresets(): StrategyPreset[] {
  if (!isClient()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StrategyPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresets(presets: StrategyPreset[]): void {
  if (!isClient()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function upsertPreset(preset: StrategyPreset): StrategyPreset[] {
  const all = readPresets();
  const next = all.filter(p => p.id !== preset.id);
  next.unshift(preset);
  writePresets(next);
  return next;
}

export function deletePreset(id: string): StrategyPreset[] {
  const next = readPresets().filter(p => p.id !== id);
  writePresets(next);
  return next;
}
