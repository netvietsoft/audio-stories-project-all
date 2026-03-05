"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { clearAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import { apiClient } from "@/lib/api/api-client";
import { useUserStore, type UserProfile } from "@/stores/user-store";

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  access_token: string;
  refresh_token: string;
};

type BackendMeResponse = {
  sub: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  roles?: string[];
};

const normalizeUserProfile = (profile: BackendMeResponse): UserProfile => ({
  id: profile.sub,
  email: profile.email,
  name: profile.name ?? undefined,
  avatarUrl: profile.avatar_url ?? undefined,
  roles: profile.roles ?? [],
});

type AuthContextValue = {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const user = useUserStore((state) => state.user);
  const accessToken = useUserStore((state) => state.accessToken);
  const setAuth = useUserStore((state) => state.setAuth);
  const setUser = useUserStore((state) => state.setUser);
  const clearAuth = useUserStore((state) => state.clearAuth);

  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearAuth();
    clearAuthCookies();
  }, [clearAuth]);

  const refreshProfile = useCallback(async () => {
    const profile = await apiClient.get<BackendMeResponse>("/auth/me");
    setUser(normalizeUserProfile(profile.data));
  }, [setUser]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await apiClient.post<LoginResponse>("/auth/login", payload);
      const { access_token, refresh_token } = response.data;
      const profile = await apiClient.get<BackendMeResponse>("/auth/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      const nextUser = normalizeUserProfile(profile.data);

      setAuth({
        accessToken: access_token,
        refreshToken: refresh_token,
        user: nextUser,
      });
      setAuthCookies(access_token, refresh_token);
    },
    [setAuth],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!accessToken) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      try {
        if (!user) {
          await refreshProfile();
        }
      } catch {
        logout();
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [accessToken, logout, refreshProfile, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(accessToken),
      isLoading,
      login,
      logout,
      refreshProfile,
    }),
    [accessToken, isLoading, login, logout, refreshProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
