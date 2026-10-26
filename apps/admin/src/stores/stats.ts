import { create } from "zustand";

// Stats reporting disabled
export const REQUIRED_HEADER_NAME = "stats";
export const REQUIRED_HEADER_VALUE = "";

interface StatsState {
  loading: boolean;
  loaded: boolean;
  stats: () => Promise<void>;
}

export const useStatsStore = create<StatsState>((set) => ({
  loading: false,
  loaded: true,

  stats: async () => {
    // Stats reporting disabled
    set({ loaded: true });
  },
}));
