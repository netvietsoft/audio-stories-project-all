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
  vipTier?: number;
  vipExpirationDate?: string | null;
  allowEmailNoti?: boolean;
  allowBellNoti?: boolean;
  credits: number;
};

type UserState = {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  setHydrated: (isHydrated: boolean) => void;
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
  isHydrated: false,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,
      setHydrated: (isHydrated) => set({ isHydrated }),
      setAuth: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken, isHydrated: true }),
      updateAccessToken: (accessToken) => set({ accessToken, isHydrated: true }),
      setUser: (user) => set({ user, isHydrated: true }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, isHydrated: true }),
    }),
    {
      name: USER_STORAGE_KEY,
      storage: createJSONStorage(getStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
