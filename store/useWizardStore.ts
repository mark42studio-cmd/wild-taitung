import { create } from 'zustand';
import type { AdventureTheme, CuratedRoute } from '@/types';

interface WizardStore {
  days: number | null;
  theme: AdventureTheme | null;
  recommendedRoutes: CuratedRoute[];
  selectedRouteId: string | null;
  selectedRouteForModal: CuratedRoute | null;

  setDays: (days: number) => void;
  setTheme: (theme: AdventureTheme) => void;
  setRecommendedRoutes: (routes: CuratedRoute[]) => void;
  selectRoute: (id: string) => void;
  setSelectedRouteForModal: (route: CuratedRoute | null) => void;
  reset: () => void;
}

const initialState = {
  days: null,
  theme: null,
  recommendedRoutes: [],
  selectedRouteId: null,
  selectedRouteForModal: null,
};

export const useWizardStore = create<WizardStore>((set) => ({
  ...initialState,
  setDays: (days) => set((s) => s.days === days ? s : { days }),
  setTheme: (theme) => set((s) => s.theme === theme ? s : { theme }),
  setRecommendedRoutes: (routes) => set({ recommendedRoutes: routes }),
  selectRoute: (id) => set((s) => s.selectedRouteId === id ? s : { selectedRouteId: id }),
  setSelectedRouteForModal: (route) => set({ selectedRouteForModal: route }),
  reset: () => set(initialState),
}));
