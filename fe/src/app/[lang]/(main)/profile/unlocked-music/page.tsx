"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Coins, LockOpen, Music2 } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";

type UnlockedMusicItem = {
  id: string;
  unlockedAt: string;
  sourceType: "track" | "playlist";
  creditsSpent: number;
  music: {
    id: string;
    slug: string;
    title: string;
    artist: string;
    thumbnailUrl: string | null;
    contentType: "single" | "playlist" | "podcast";
  };
  sourcePlaylist?: {
    id: string;
    slug: string;
    title: string;
  } | null;
};

type UnlockedMusicResponse = {
  data: UnlockedMusicItem[];
  meta?: {
    total?: number;
    page?: number;
    lastPage?: number;
  };
};

export default function ProfileUnlockedMusicPage() {
  const t = useTranslations("ProfileUnlockedMusicPage");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const accessToken = useUserStore((state) => state.accessToken);
  const isAuthHydrated = useUserStore((state) => state.isHydrated);

  const [items, setItems] = useState<UnlockedMusicItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const fetchUnlockedMusic = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<UnlockedMusicResponse>("/music/interactions/unlocked", {
        params: {
          page: 1,
          limit: 50,
        },
      });
      setItems(response.data.data || []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthHydrated) return;
    if (!accessToken) {
      router.push(`/${currentLang}`);
      return;
    }
    void fetchUnlockedMusic();
  }, [accessToken, currentLang, isAuthHydrated, router]);

  const sourceLabel = (item: UnlockedMusicItem) => {
    if (item.sourceType === "playlist") {
      if (item.sourcePlaylist?.title) {
        return t("sourcePlaylistWithName", { playlist: item.sourcePlaylist.title });
      }
      return t("sourcePlaylist");
    }
    return t("sourceTrack");
  };

  return (
    <div className="space-y-6">
      <h1 className="inline-flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100">
        <Music2 className="h-6 w-6 text-pink-600" /> {t("title")}
      </h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#2a2a2a]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/music/${item.music.slug}`}
              className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:bg-gray-50 dark:border-zinc-800 dark:bg-[#232325] dark:hover:bg-[#2a2a2a]"
            >
              <div className="flex gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#2b2b2d]">
                  <Image
                    src={item.music.thumbnailUrl || "/thumbnaildefault.jpg"}
                    alt={item.music.title}
                    width={128}
                    height={128}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                    {item.music.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{item.music.artist}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">
                      <LockOpen className="h-3 w-3" /> {sourceLabel(item)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <Coins className="h-3 w-3" /> {t("creditsSpent", { credits: Math.max(0, item.creditsSpent || 0) })}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                    {t("unlockedAt", { time: dateFormatter.format(new Date(item.unlockedAt)) })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
