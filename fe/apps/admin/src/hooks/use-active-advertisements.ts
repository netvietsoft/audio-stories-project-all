"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { apiClient } from "@/lib/api/api-client";
import { unwrapList } from "@/lib/api/unwrap";
import type { AdvertisementItem } from "@/types/advertisement";

type UseActiveAdvertisementsOptions = {
  limit?: number;
};

export function useActiveAdvertisements(options: UseActiveAdvertisementsOptions = {}) {
  const locale = useLocale();
  const [ads, setAds] = useState<AdvertisementItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchActiveAds = async () => {
      try {
        const activeLang = locale === "en" ? "en" : "vi";
        const response = await apiClient.get<{ data?: AdvertisementItem[] }>("/ads/active", {
          params: {
            limit: options.limit || 10,
            lang: activeLang,
            routeType: 1,
          },
        });

        if (cancelled) return;
        setAds(unwrapList<AdvertisementItem>(response.data));
      } catch {
        if (cancelled) return;
        setAds([]);
      }
    };

    void fetchActiveAds();

    return () => {
      cancelled = true;
    };
  }, [locale, options.limit]);

  return ads;
}
