import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_FORMULA_PARAMS, FormulaParams, FormulaType } from '@/types/orderbook';

interface AppState {
  theme: 'light' | 'dark' | 'dim';
  darkMode: boolean;
  leaderboardSymbol:  string;
  leaderboardFormula: FormulaType;
  leaderboardParams:  FormulaParams;

  setTheme:              (theme: 'light' | 'dark' | 'dim') => void;
  toggleDarkMode:        () => void; // Keep for backward compatibility
  setLeaderboardSymbol:  (s: string) => void;
  setLeaderboardFormula: (f: FormulaType) => void;
  setLeaderboardParams:  (patch: Partial<FormulaParams>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme:              'dark',
      darkMode:           true, // Keep for backward compatibility
      leaderboardSymbol:  'BTC/USD',
      leaderboardFormula: 'distanceWeighted',
      leaderboardParams:  DEFAULT_FORMULA_PARAMS,

      setTheme:              (theme) => set({ theme, darkMode: theme === 'dark' || theme === 'dim' }),
      toggleDarkMode:        () => set(s => {
        const next = s.theme === 'light' ? 'dark' : 'light';
        return { theme: next, darkMode: next === 'dark' };
      }),
      setLeaderboardSymbol:  (leaderboardSymbol)  => set({ leaderboardSymbol }),
      setLeaderboardFormula: (leaderboardFormula) => set({ leaderboardFormula }),
      setLeaderboardParams:  (patch) => set(s => ({
        leaderboardParams: { ...s.leaderboardParams, ...patch },
      })),
    }),
    {
      name: 'obi-app',
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 && state.leaderboardSymbol) {
          const sym = state.leaderboardSymbol as string;
          if (!sym.includes('/')) {
            state.leaderboardSymbol = `${sym}/USD`;
          }
        }
        return state as unknown as AppState;
      },
    },
  ),
);
