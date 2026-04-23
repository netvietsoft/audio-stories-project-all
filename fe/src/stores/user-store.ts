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
  pulseBalance: number;
  credits?: number;
};

type UserState = {
  user: UserProfile | null;
  accessToken: string | null;
  // refreshToken removed — it's now an HttpOnly cookie managed by the browser.
  // JS code must never read or write the refresh token.
  isHydrated: boolean;
  setHydrated: (isHydrated: boolean) => void;
  setAuth: (payload: {
    user: UserProfile;
    accessToken: string;
  }) => void;
  updateAccessToken: (accessToken: string) => void;
  setUser: (user: UserProfile | null) => void;
  clearAuth: () => void;
};

const initialState = {
  user: null,
  accessToken: null,
  isHydrated: false,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,
      setHydrated: (isHydrated) => set({ isHydrated }),
      setAuth: ({ user, accessToken }) => set({ user, accessToken, isHydrated: true }),
      updateAccessToken: (accessToken) => set({ accessToken, isHydrated: true }),
      setUser: (user) => set({ user, isHydrated: true }),
      clearAuth: () => set({ user: null, accessToken: null, isHydrated: true }),
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
        // Do NOT persist refreshToken — it's an HttpOnly cookie, not a JS concern
      }),
    },
  ),
);
