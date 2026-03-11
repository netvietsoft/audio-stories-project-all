import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  roles?: string[];
  credits?: number;
  vipTier?: string;
  vipExpirationDate?: string;
}

interface AdminAuthState {
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

interface AdminAuthActions {
  setAuth: (auth: { user: AdminUser; accessToken: string; refreshToken: string }) => void;
  updateAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

type AdminStore = AdminAuthState & AdminAuthActions;

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      updateAccessToken: (accessToken) =>
        set((state) => ({
          ...state,
          accessToken,
        })),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "admin-store",
    },
  ),
);
