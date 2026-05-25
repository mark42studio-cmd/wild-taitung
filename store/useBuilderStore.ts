import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BuilderDay } from '@/types';

interface BuilderStore {
  days: BuilderDay[];
  adventureName: string;
  setDays: (daysOrFn: BuilderDay[] | ((prev: BuilderDay[]) => BuilderDay[])) => void;
  setAdventureName: (name: string) => void;
  reset: () => void;
}

export const useBuilderStore = create<BuilderStore>()(
  persist(
    (set) => ({
      days: [],
      adventureName: '',
      setDays: (daysOrFn) =>
        set((state) => ({
          days: typeof daysOrFn === 'function' ? daysOrFn(state.days) : daysOrFn,
        })),
      setAdventureName: (name) => set({ adventureName: name }),
      reset: () => set({ days: [], adventureName: '' }),
    }),
    { name: 'wild-taitung-builder' },
  ),
);
