"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "@/components/shared/LocalizedLink";
import { Crown, Eye, Layers, Star, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import FavoriteButton from "@/components/shared/FavoriteButton";

export interface Story {
  id: string;
  slug: string;
  title?: string;
  titleVi?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl?: string | null;
  totalViews?: number;
  averageRating?: number | string;
  totalChapters?: number;
  chapterCount?: number | string;
  _count?: { chapters?: number };
  author?: { id?: string; name?: string | null };
  categories?: Array<{
    category?: {
      id?: number;
      name?: string | null;
      nameVi?: string | null;
      nameEn?: string | null;
      slug?: string | null;
    };
  }>;
}

export interface HallContributor {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  vipTier: number;
  credits: number;
  totalUnlockedStories: number;
}

const getLocalizedValue = (
  lang: string,
  vi?: string | null,
  en?: string | null,
  fallback?: string | null,
) => {
  if (lang === "en") return en || vi || fallback || "";
  return vi || en || fallback || "";
};

const getChapterTotal = (story: Story) => {
  const values = [story._count?.chapters, story.chapterCount, story.totalChapters];
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const formatRating = (value?: number | string) => {
  const rating = Number(value || 0);
  if (!Number.isFinite(rating) || rating <= 0) return "N/A";
  return rating.toFixed(1);
};

export function TopContributorsLeaderboard({ contributors }: { contributors?: HallContributor[] }) {
  const locale = useLocale();
  const t = useTranslations("Home");
  const topOne = contributors?.[0];
  const topFive = (contributors || []).slice(1, 6);

  if (!topOne) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col items-center justify-center text-center h-full p-8 rounded-2xl bg-gradient-to-b from-yellow-500/20 to-gray-800/40 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
          <Crown className="text-yellow-400 w-12 h-12 mb-2 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
          <Image
            src={topOne.avatarUrl || "https://api.dicebear.com/9.x/adventurer/svg?seed=TopContributor"}
            alt={topOne.displayName || "Top Contributor"}
            width={128}
            height={128}
            className="w-32 h-32 rounded-full border-4 border-yellow-500 object-cover mb-4"
            unoptimized
          />
          <p className="text-3xl font-bold text-white">{topOne.displayName || "Top Contributor"}</p>
          <p className="text-yellow-400 font-medium text-sm tracking-widest uppercase mt-1">{t("top", { rank: 1 })}</p>
          <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mt-4">
            {Number(topOne.credits || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")} {t("creditsLabel")}
          </p>
        </div>

        <div className="flex flex-col justify-between h-full gap-3">
          {topFive.map((user, index) => {
            const rank = index + 2;
            const rankClass = rank === 2
              ? "text-[#C0C0C0]"
              : rank === 3
                ? "text-[#CD7F32]"
                : "text-gray-500";

            return (
              <div
                key={user.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
              >
                <span className={`text-xl font-bold w-6 text-center ${rankClass}`}>{rank}</span>
                <Image
                  src={user.avatarUrl || `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(user.displayName || user.id)}`}
                  alt={user.displayName || "Contributor"}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                  unoptimized
                />
                <div className="flex flex-col flex-1">
                  <p className="text-base font-semibold text-white">{user.displayName || "Contributor"}</p>
                  <p className="text-sm text-gray-400">{Number(user.credits || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")} {t("creditsLabel")}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
  );
}

export function InteractiveStoryShelf({ stories }: { stories: Story[] }) {
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const tHome = useTranslations("Home");
  const tStoryDetail = useTranslations("StoryDetail");
  const labels = {
    readNow: tHome("readNow"),
    storyIntroFallback: tHome("storyIntroFallback"),
    chapters: tHome("chaptersLabel"),
    views: tHome("viewsLabel"),
    rating: tHome("ratingLabel"),
    authorFallback: tStoryDetail("authorUpdating"),
  };

  const [activeStoryId, setActiveStoryId] = useState<string>(stories[0]?.id || "");

  useEffect(() => {
    if (!stories.length) {
      setActiveStoryId("");
      return;
    }
    setActiveStoryId((prev) => (stories.some((s) => s.id === prev) ? prev : (stories[0]?.id || "")));
  }, [stories]);

  const activeStory = useMemo(
    () => stories.find((s) => s.id === activeStoryId) || stories[0],
    [activeStoryId, stories],
  );

  const leaderboardStories = stories.slice(0, 5);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {stories.length ? (
        <div className="mt-4 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">

          {/* ── Left: Featured story card (spans 2 cols on lg) ── */}
          <div className="flex h-full flex-col gap-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/40 md:flex-row lg:col-span-2">
            {activeStory ? (
              <>
                {/* Thumbnail – fixed width, aligned to top */}
                <div className="w-full shrink-0 self-start md:w-56 lg:w-64">
                  <Link href={`/story/${activeStory.slug}`} className="block h-full">
                    <Image
                      src={activeStory.thumbnailUrl || "/icon.svg"}
                      alt={getLocalizedValue(lang, activeStory.titleVi, activeStory.titleEn, activeStory.title)}
                      width={224}
                      height={299}
                      sizes="(max-width: 768px) 100vw, 256px"
                      className="h-full w-full shrink-0 rounded-xl object-cover"
                    />
                  </Link>
                </div>

                {/* Content – title, author, stats, description, buttons */}
                <div className="flex min-w-0 flex-1 flex-col py-1">
                  <Link href={`/story/${activeStory.slug}`}>
                    <h4 className="line-clamp-2 text-2xl font-extrabold leading-tight text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 sm:text-[2rem]">
                      {getLocalizedValue(lang, activeStory.titleVi, activeStory.titleEn, activeStory.title)}
                    </h4>
                  </Link>

                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {activeStory.author?.name || labels.authorFallback}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <p className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Layers className="h-3.5 w-3.5" />
                      {labels.chapters}: {getChapterTotal(activeStory).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}
                    </p>
                    <p className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Eye className="h-3.5 w-3.5" />
                      {labels.views}: {Number(activeStory.totalViews || 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}
                    </p>
                    <p className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      {labels.rating}: {formatRating(activeStory.averageRating)}
                    </p>
                  </div>

                  <p className="mt-2 line-clamp-6 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    {getLocalizedValue(
                      lang,
                      activeStory.descriptionVi,
                      activeStory.descriptionEn,
                      activeStory.description,
                    ) || labels.storyIntroFallback}
                  </p>

                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <Link
                      href={`/story/${activeStory.slug}`}
                      className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      {labels.readNow}
                    </Link>
                    <FavoriteButton
                      storyId={activeStory.id}
                      size="sm"
                      icon="heart"
                      className="h-10 w-10 justify-center rounded-full p-0"
                      activeClassName="bg-red-500 text-white"
                      inactiveClassName="bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* ── Right: Top-5 leaderboard list (1 col on lg) ── */}
          <div className="flex h-full flex-col justify-between lg:col-span-1">
            {leaderboardStories.map((story, idx) => {
              const storyTitle = getLocalizedValue(lang, story.titleVi, story.titleEn, story.title);
              const isActive = story.id === activeStory?.id;
              const rankColors = ["text-amber-400", "text-slate-300", "text-amber-600", "text-gray-400", "text-gray-400"];

              return (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => setActiveStoryId(story.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                    isActive
                      ? "bg-blue-600/20 ring-1 ring-blue-500/40"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <span className={`w-6 shrink-0 text-center text-xl font-bold tabular-nums ${rankColors[idx] ?? "text-gray-400"}`}>
                    {idx + 1}
                  </span>

                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
                    <Image
                      src={story.thumbnailUrl || "/icon.svg"}
                      alt={storyTitle}
                      fill
                      sizes="48px"
                      className="aspect-[3/4] object-cover"
                    />
                  </div>

                  <div className="flex min-w-0 flex-col flex-1">
                    <span className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {storyTitle}
                    </span>
                    <span className="mt-0.5 text-xs text-gray-400">
                      {Number(story.totalViews || 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN")} {labels.views.toLowerCase()}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <Star className="h-3 w-3 text-amber-500" />
                      {formatRating(story.averageRating)}
                    </span>
                  </div>
                  <TrendingUp className="h-4 w-4 shrink-0 text-green-400" />
                </button>
              );
            })}
          </div>

        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {tHome("noData")}
        </div>
      )}
    </div>
  );
}

