"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/api-client";
import { setAuthCookies } from "@/lib/auth/cookies";
import { useUserStore } from "@/stores/user-store";

type MeResponse = {
  sub: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  roles?: string[];
  vip_tier?: number;
  credits?: number;
  premium_expires_at?: string | null;
};

export default function GoogleCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useUserStore((state) => state.setAuth);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const accessToken = searchParams.get("access_token");
        const refreshToken = searchParams.get("refresh_token");

        if (!accessToken || !refreshToken) {
          setError("Thiếu token đăng nhập Google. Vui lòng thử lại.");
          return;
        }

        const meRes = await apiClient.get<MeResponse>("/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        setAuth({
          user: {
            id: meRes.data.sub,
            email: meRes.data.email,
            name: meRes.data.name ?? undefined,
            avatarUrl: meRes.data.avatar_url ?? undefined,
            roles: meRes.data.roles ?? [],
            vipTier: meRes.data.vip_tier,
            vipExpirationDate: meRes.data.premium_expires_at,
            credits: meRes.data.credits ?? 0,
          },
          accessToken,
          refreshToken,
        });

        setAuthCookies(accessToken, refreshToken);

        router.replace("/");
      } catch {
        setError("Đăng nhập Google thất bại. Vui lòng thử lại.");
      }
    };

    processCallback();
  }, [router, searchParams, setAuth]);

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  return <p className="text-sm text-gray-600 dark:text-gray-300">Đang xử lý đăng nhập Google...</p>;
}
