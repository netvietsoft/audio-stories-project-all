import { create } from "zustand";

import { apiClient } from "@/lib/api/api-client";
import { unwrapData, unwrapList } from "@/lib/api/unwrap";

type FavoriteStory = {
  id: string;
};

type FavoriteResponse = {
  data: FavoriteStory[];
};

type FavoriteStore = {
  favoriteIds: string[];
  isHydrated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  toggle: (storyId: string) => Promise<boolean>;
  isFavorite: (storyId: string) => boolean;
};

const unique = (items: string[]) => [...new Set(items)];

export const useFavoriteStore = create<FavoriteStore>((set, get) => ({
  favoriteIds: [],
  isHydrated: false,
  isLoading: false,
  hydrate: async () => {
    const { isHydrated, isLoading } = get();
    if (isHydrated || isLoading) return;

    set({ isLoading: true });
    try {
      const response = await apiClient.get<FavoriteResponse>("/favorites", {
        params: {
          page: 1,
          limit: 200,
          sort: "latest",
        },
      });
      set({
        favoriteIds: unique(unwrapList<FavoriteStory>(response.data).map((item) => item.id)),
        isHydrated: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, isHydrated: true });
    }
  },
  toggle: async (storyId: string) => {
    const current = get().favoriteIds;
    const optimisticIsFav = !current.includes(storyId);
    set({
      favoriteIds: optimisticIsFav
        ? unique([...current, storyId])
        : current.filter((id) => id !== storyId),
    });

    try {
      const response = await apiClient.post<{ isFavorite: boolean }>("/favorites/toggle", {
        storyId,
      });
      const isFavorite = Boolean(unwrapData<{ isFavorite: boolean }>(response.data)?.isFavorite);
      const next = get().favoriteIds;
      set({
        favoriteIds: isFavorite
          ? unique([...next, storyId])
          : next.filter((id) => id !== storyId),
      });
      return isFavorite;
    } catch {
      set({ favoriteIds: current });
      return current.includes(storyId);
    }
  },
  isFavorite: (storyId: string) => get().favoriteIds.includes(storyId),
}));
