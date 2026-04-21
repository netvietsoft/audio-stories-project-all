"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { locales } from "@/i18n";

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
  const locale = useLocale();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const accessToken = searchParams.get("access_token");

        if (!accessToken) {
          setError(locale === "en" ? "Missing Google login token. Please try again." : "Thiếu token đăng nhập Google. Vui lòng thử lại.");
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
        });

        setAuthCookies(accessToken);

        const redirectPath = searchParams.get("redirect") || "/";

        // If the redirectPath already contains any supported locale prefix
        // (e.g. /en/... or /vi/...), don't prefix it again to avoid
        // producing paths like /vi/en/...
        const hasLocalePrefix = (() => {
          try {
            const pattern = new RegExp(`^/(${(locales as readonly string[]).join("|")})(/|$)`);
            return pattern.test(redirectPath);
          } catch {
            return false;
          }
        })();

        const finalRedirect = hasLocalePrefix ? redirectPath : `/${locale}${redirectPath === "/" ? "" : redirectPath}`;
        router.replace(finalRedirect);
      } catch {
        setError(locale === "en" ? "Google login failed. Please try again." : "Đăng nhập Google thất bại. Vui lòng thử lại.");
      }
    };

    processCallback();
  }, [router, searchParams, setAuth, locale]);

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  return <p className="text-sm text-gray-600 dark:text-gray-300">{locale === "en" ? "Processing Google login..." : "Đang xử lý đăng nhập Google..."}</p>;
}
