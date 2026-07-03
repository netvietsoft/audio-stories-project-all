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
};

type BackendMeResponse = {
  sub: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  roles?: string[];
  vip_tier?: number;
  credits?: number;
  pulse_balance?: number;
  premium_expires_at?: string | null;
  allow_email_noti?: boolean;
  allow_bell_noti?: boolean;
};

const normalizeUserProfile = (profile: BackendMeResponse): UserProfile => ({
  id: profile.sub,
  email: profile.email,
  name: profile.name ?? undefined,
  avatarUrl: profile.avatar_url ?? undefined,
  roles: profile.roles ?? [],
  vipTier: profile.vip_tier,
  vipExpirationDate: profile.premium_expires_at,
  allowEmailNoti: profile.allow_email_noti,
  allowBellNoti: profile.allow_bell_noti,
  pulseBalance: profile.pulse_balance ?? profile.credits ?? 0,
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
    try {
      const profile = await apiClient.get<BackendMeResponse>("/auth/me");
      // BE bọc response trong { data: ... } -> user nằm ở profile.data.data
      const profileBody: any = profile.data;
      setUser(normalizeUserProfile(profileBody?.data ?? profileBody));
    } catch (error: any) {
      if (error?.response?.status === 401) {
        logout();
        return;
      }
      throw error;
    }
  }, [logout, setUser]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await apiClient.post<LoginResponse>("/auth/login", payload);
      // BE bọc response trong { data: ... } -> access_token ở response.data.data
      const loginBody: any = response.data;
      const access_token = loginBody?.data?.access_token ?? loginBody?.access_token;
      const profile = await apiClient.get<BackendMeResponse>("/auth/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      const profileBody: any = profile.data;
      const nextUser = normalizeUserProfile(profileBody?.data ?? profileBody);

      setAuth({
        accessToken: access_token,
        user: nextUser,
      });
      setAuthCookies(access_token);
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
