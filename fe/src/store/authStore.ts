"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/constants/auth";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
};

const AUTH_STORAGE_KEY = "auth-store";

const storage = createJSONStorage(() => localStorage);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

        set({
          user,
          isAuthenticated: true,
        });
      },
      logout: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);

        set({
          user: null,
          isAuthenticated: false,
        });

        window.location.href = "/login";
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
