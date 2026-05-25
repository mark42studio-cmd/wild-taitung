import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ItineraryStore {
  selectedSpotIds: string[];
  addSpot: (spotId: string) => void;
  removeSpot: (spotId: string) => void;
  clearItinerary: () => void;
  setSelectedSpotIds: (spotIds: string[]) => void;
}

export const useItineraryStore = create<ItineraryStore>()(
  persist(
    (set) => ({
      selectedSpotIds: [],
      addSpot: (spotId) =>
        set((state) => ({
          selectedSpotIds: state.selectedSpotIds.includes(spotId)
            ? state.selectedSpotIds
            : [...state.selectedSpotIds, spotId],
        })),
      removeSpot: (spotId) =>
        set((state) => ({
          selectedSpotIds: state.selectedSpotIds.filter((id) => id !== spotId),
        })),
      clearItinerary: () => set({ selectedSpotIds: [] }),
      setSelectedSpotIds: (spotIds) =>
        set({
          selectedSpotIds: Array.from(new Set(spotIds.filter(Boolean))),
        }),
    }),
    {
      name: 'wild-taitung-shared-itinerary',
      partialize: (state) => ({ selectedSpotIds: state.selectedSpotIds }),
    },
  ),
);
