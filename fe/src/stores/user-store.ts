import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { USER_STORAGE_KEY } from "@/constants/auth";

type UserStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

const createNoopStorage = (): UserStorage => ({
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

const getStorage = (): StateStorage =>
  typeof window === "undefined" ? createNoopStorage() : window.localStorage;

export type UserProfile = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  roles?: string[];
};

type UserState = {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (payload: {
    user: UserProfile;
    accessToken: string;
    refreshToken: string;
  }) => void;
  updateAccessToken: (accessToken: string) => void;
  setUser: (user: UserProfile | null) => void;
  clearAuth: () => void;
};

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,
      setAuth: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      updateAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clearAuth: () => set(initialState),
    }),
    {
      name: USER_STORAGE_KEY,
      storage: createJSONStorage(getStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
