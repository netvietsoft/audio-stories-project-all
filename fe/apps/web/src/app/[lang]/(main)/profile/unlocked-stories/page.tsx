"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Coins, LockOpen } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { unwrapList } from "@/lib/api/unwrap";
import { getLocalizedValue } from "@/lib/story-localization";
import { cleanChapterTitle, formatChapterTitle } from "@/lib/formatChapterTitle";
import { useUserStore } from "@/stores/user-store";

type UnlockedStoryItem = {
  id: string;
  unlockedAt: string;
  variant: {
    id: string;
    title: string;
    unlockPrice: number;
  };
  chapter: {
    id: string;
    chapterNumber: number;
    title: string;
  };
  story: {
    id: string;
    slug: string;
    title: string;
    titleVi?: string | null;
    titleEn?: string | null;
    thumbnailUrl: string | null;
  };
};

type UnlockedStoriesResponse = {
  data: UnlockedStoryItem[];
  meta?: {
    total?: number;
    page?: number;
    lastPage?: number;
  };
};

export default function ProfileUnlockedStoriesPage() {
  const t = useTranslations("ProfileUnlockedStoriesPage");
  const tChapter = useTranslations("StoryChapterClient");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const accessToken = useUserStore((state) => state.accessToken);
  const isAuthHydrated = useUserStore((state) => state.isHydrated);

  const [items, setItems] = useState<UnlockedStoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const fetchUnlockedStories = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<UnlockedStoriesResponse>("/unlocked-stories", {
        params: {
          page: 1,
          limit: 50,
        },
      });
      setItems(unwrapList<UnlockedStoryItem>(response.data));
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
    void fetchUnlockedStories();
  }, [accessToken, currentLang, isAuthHydrated, router]);

  return (
    <div className="space-y-6">
      <h1 className="inline-flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100">
        <BookOpen className="h-6 w-6 text-pink-600" /> {t("title")}
      </h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#2a2a2a]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const storyTitle = getLocalizedValue(locale, item.story.titleVi, item.story.titleEn, item.story.title);
            const chapterTitle = formatChapterTitle(
              tChapter("chapterKeyword"),
              item.chapter.chapterNumber,
              cleanChapterTitle(item.chapter.title),
            );

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:bg-gray-50 dark:border-zinc-800 dark:bg-[#232325] dark:hover:bg-[#2a2a2a]"
              >
                <div className="flex gap-4">
                  <Link href={`/story/${item.story.slug}`} className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-[#2b2b2d]">
                    <Image
                      src={item.story.thumbnailUrl || "/thumbnaildefault.jpg"}
                      alt={storyTitle}
                      width={112}
                      height={160}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={`/story/${item.story.slug}`} className="block truncate text-sm font-bold text-gray-900 hover:text-pink-600 dark:text-gray-100">
                      {storyTitle}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{chapterTitle}</p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {t("variantLabel", { title: item.variant.title })}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">
                        <LockOpen className="h-3 w-3" /> {t("unlocked")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Coins className="h-3 w-3" /> {t("creditsSpent", { credits: Math.max(0, item.variant.unlockPrice || 0) })}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                      {t("unlockedAt", { time: dateFormatter.format(new Date(item.unlockedAt)) })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
