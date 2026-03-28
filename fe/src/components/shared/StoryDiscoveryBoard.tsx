"use client";

import Image from "next/image";
import Link from "@/components/shared/LocalizedLink";
import { Crown, Eye, Layers, Star } from "lucide-react";
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
    <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-yellow-50 to-yellow-100 p-8 text-center shadow-lg lg:col-span-5">
          <Crown className="text-yellow-500 w-12 h-12 mb-2 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" />
          <Image
            src={topOne.avatarUrl || "https://api.dicebear.com/9.x/adventurer/svg?seed=TopContributor"}
            alt={topOne.displayName || "Top Contributor"}
            width={128}
            height={128}
            className="w-32 h-32 rounded-full border-4 border-yellow-500 object-cover mb-4"
            unoptimized
          />
          <p className="text-3xl font-bold text-gray-900">{topOne.displayName || "Top Contributor"}</p>
          <p className="text-yellow-600 font-medium text-sm tracking-widest uppercase mt-1">{t("top", { rank: 1 })}</p>
          <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-700 mt-4">
            {Number(topOne.credits || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")} {t("creditsLabel")}
          </p>
        </div>

        <div className="flex h-full flex-col justify-between gap-3 lg:col-span-7 lg:items-center">
          {topFive.map((user, index) => {
            const rank = index + 2;
            const rankClass = rank === 2
              ? "text-gray-400 dark:text-[#C0C0C0]"
              : rank === 3
                ? "text-amber-600 dark:text-[#CD7F32]"
                : "text-gray-500";

            return (
              <div
                key={user.id}
                className="flex w-full items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-800/40 dark:hover:bg-gray-800/60 lg:max-w-2xl"
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
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{user.displayName || "Contributor"}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{Number(user.credits || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")} {t("creditsLabel")}</p>
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

  const topStory = stories[0];
  const rankedStories = stories.slice(1, 5);

  return (
    <div className="p-6">
      {stories.length ? (
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[40%_1fr]">

          {/* Left: Top 1 Featured Story */}
          <div className="flex h-full flex-col gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-5">
            {topStory ? (
              <>
                {/* Thumbnail */}
                <div className="w-full flex justify-center flex-[0.7]">
                  <Link href={`/story/${topStory.slug}`} className="block w-1/2">
                    <Image
                      src={topStory.thumbnailUrl || "/icon.svg"}
                      alt={getLocalizedValue(lang, topStory.titleVi, topStory.titleEn, topStory.title)}
                      width={400}
                      height={400}
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="aspect-[3/4] w-full rounded-xl object-cover"
                    />
                  </Link>
                </div>

                {/* Content */}
                <div className="flex flex-[0.3] flex-col items-center text-center justify-center w-[70%] mx-auto">
                  <Link href={`/story/${topStory.slug}`}>
                    <h4 className="line-clamp-2 text-xl font-extrabold leading-tight text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
                      {getLocalizedValue(lang, topStory.titleVi, topStory.titleEn, topStory.title)}
                    </h4>
                  </Link>

                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {topStory.author?.name || labels.authorFallback}
                  </p>

                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {getLocalizedValue(
                      lang,
                      topStory.descriptionVi,
                      topStory.descriptionEn,
                      topStory.description,
                    ) || labels.storyIntroFallback}
                  </p>

                  <div className="mt-4">
                    <Link
                      href={`/story/${topStory.slug}`}
                      className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-400 to-pink-400 px-6 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md"
                    >
                      {labels.readNow}
                    </Link>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Right: Top 2-5 Grid (2 rows x 2 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-center">
            {rankedStories.map((story, idx) => {
              const storyTitle = getLocalizedValue(lang, story.titleVi, story.titleEn, story.title);
              const authorName = story.author?.name || labels.authorFallback;
              const views = Number(story.totalViews || 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN");
              const categories = story.categories?.slice(0, 2).map(c => 
                getLocalizedValue(lang, c.category?.nameVi, c.category?.nameEn, c.category?.name)
              ).filter(Boolean).join(", ") || "";

              return (
                <Link
                  key={story.id}
                  href={`/story/${story.slug}`}
                  className="flex items-center gap-4 rounded-xl p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={story.thumbnailUrl || "/icon.svg"}
                      alt={storyTitle}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h5 className="line-clamp-2 text-base font-bold text-gray-900 dark:text-white">
                      {storyTitle}
                    </h5>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {authorName}
                    </p>
                    {categories && (
                      <p className="mt-1 text-xs text-pink-600 dark:text-pink-400 line-clamp-1">
                        {categories}
                      </p>
                    )}
                    <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-gray-400 dark:text-gray-500">
                      <Eye className="h-4 w-4" />
                      {views}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-gray-100 p-6 text-sm text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">
          {tHome("noData")}
        </div>
      )}
    </div>
  );
}

