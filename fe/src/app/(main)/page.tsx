"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import StoryCard from "@/components/shared/StoryCard";
import ResponsiveStoryList from "@/components/shared/ResponsiveStoryList";
import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import { apiClient } from "@/lib/api/api-client";
import { fetchExploreCached } from "@/lib/api/public-story-cache";
import { useRouter } from "next/navigation";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  author?: { id?: string; name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type CategoryItem = {
  id: number;
  name: string;
  slug: string;
  storiesCount: number;
};

type AuthorItem = {
  id: string;
  name: string;
};

type ChapterItem = {
  id: string;
  title: string;
  chapterNumber: number;
  createdAt: string;
  story: {
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    author: { name: string };
  };
};

type HallMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  vipTier: number;
  credits: number;
  totalUnlockedStories: number;
};

type ExploreResponse = {
  data: StoryItem[];
};

const NEW_LIMIT = 5;
const POPULAR_LIMIT = 8;
const RANKING_LIMIT = 5;

export default function HomePage() {
  const t = useTranslations("Home");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const router = useRouter();

  const [newestStories, setNewestStories] = useState<StoryItem[]>([]);
  const [popularStories, setPopularStories] = useState<StoryItem[]>([]);
  const [trendingStories, setTrendingStories] = useState<StoryItem[]>([]);
  const [topRatingStories, setTopRatingStories] = useState<StoryItem[]>([]);
  const [topViewsStories, setTopViewsStories] = useState<StoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [latestChapters, setLatestChapters] = useState<ChapterItem[]>([]);
  const [hall, setHall] = useState<HallMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [filterValue, setFilterValue] = useState<StoryFilterValue>({
    categoryId: "",
    authorId: "",
    status: "",
    sort: "latest",
  });

  const heroStories = useMemo(() => {
    return (trendingStories.length ? trendingStories : newestStories).slice(0, 5);
  }, [trendingStories, newestStories]);

  useEffect(() => {
    if (!heroStories.length) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroStories.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroStories.length]);

  useEffect(() => {
    const loadHome = async () => {
      setIsLoading(true);
      try {
        const [
          newestRes,
          popularRes,
          trendingRes,
          topRatingRes,
          topViewsRes,
          catTopRes,
          catFallbackRes,
          hallRes,
          authorRes,
          chapterRes,
        ] = await Promise.allSettled([
          fetchExploreCached<ExploreResponse>({ limit: NEW_LIMIT, lang, sort: "latest" }),
          fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, sort: "rating" }),
          fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, sort: "views", trendWindow: "week" }),
          fetchExploreCached<ExploreResponse>({ limit: RANKING_LIMIT, lang, sort: "rating" }),
          fetchExploreCached<ExploreResponse>({ limit: RANKING_LIMIT, lang, sort: "views" }),
          apiClient
            .get<{ data: CategoryItem[] }>("/stories/categories/top", { params: { limit: 20, lang } })
            .then((r) => r.data?.data || [])
            .catch(() => []),
          apiClient
            .get<Array<{ id: number; name: string; slug: string }>>("/stories/categories")
            .then((r) => r.data || [])
            .catch(() => []),
          apiClient
            .get<{ data: HallMember[] }>("/stories/hall-of-fame", { params: { limit: 5 } })
            .then((r) => r.data?.data || [])
            .catch(() => []),
          apiClient
            .get<AuthorItem[]>("/stories/authors")
            .then((r) => r.data || [])
            .catch(() => []),
          apiClient
            .get<ChapterItem[]>("/chapters/latest", { params: { limit: 10 } })
            .then((res) => res.data || [])
            .catch(() => []),
        ]);

        setNewestStories(newestRes.status === "fulfilled" ? (newestRes.value.data || []) : []);
        setPopularStories(popularRes.status === "fulfilled" ? (popularRes.value.data || []) : []);
        setTrendingStories(trendingRes.status === "fulfilled" ? (trendingRes.value.data || []) : []);
        setTopRatingStories(topRatingRes.status === "fulfilled" ? (topRatingRes.value.data || []) : []);
        setTopViewsStories(topViewsRes.status === "fulfilled" ? (topViewsRes.value.data || []) : []);

        const catTop = catTopRes.status === "fulfilled" ? catTopRes.value : [];
        const catFb = catFallbackRes.status === "fulfilled"
          ? (catFallbackRes.value as Array<{ id: number; name: string; slug: string }>).map((c) => ({ ...c, storiesCount: 0 }))
          : [];
        setCategories((catTop.length ? catTop : catFb));

        setHall(hallRes.status === "fulfilled" ? hallRes.value : []);
        setAuthors(authorRes.status === "fulfilled" ? authorRes.value : []);
        setLatestChapters(chapterRes.status === "fulfilled" ? chapterRes.value : []);
      } catch (error) {
        console.error(t("loadError"), error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHome();
  }, [lang, t]);

  const activeHero = heroStories[heroIndex];

  return (
    <div className="space-y-12">

      {/* ─── Hero Banner ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white">
        {activeHero ? (
          <Image
            src={activeHero.thumbnailUrl || "https://placehold.co/1600x500?text=Hot+Story"}
            alt={activeHero.title}
            fill
            sizes="100vw"
            priority
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-800/40 pointer-events-none" />

        {heroStories.length > 1 && (
          <button
            onClick={() => setHeroIndex((prev) => (prev === heroStories.length - 1 ? 0 : prev + 1))}
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-110"
            aria-label="Next slide"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{t("heroBadge")}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">
            {t("heroTitleLine1")}
            <br className="hidden md:block" /> {t("heroTitleLine2")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
            {activeHero ? t("heroFeatured", { title: activeHero.title }) : t("heroFallback")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={activeHero ? `/story/${activeHero.slug}` : "/explore"} className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition-colors">
              {t("listenNow")}
            </Link>
            <Link href="/trending" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">
              {t("viewTrending")}
            </Link>
          </div>
          <div className="mt-6 flex gap-2">
            {heroStories.map((story, idx) => (
              <button
                key={story.id}
                onClick={() => setHeroIndex(idx)}
                className={`h-2.5 rounded-full transition-all ${idx === heroIndex ? "w-10 bg-amber-300" : "w-2.5 bg-white/40"}`}
                aria-label={`hero-${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Hashtag / Category Strip ────────────────────────────── */}
      {categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("hashtagsTitle")}</h2>
            <Link href="/categories" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
              {t("viewAll")}
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="flex-shrink-0 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-950 dark:hover:text-blue-300"
              >
                #{cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Quick Filter Bar ────────────────────────────────────── */}
      <StoryFilterBar
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        authors={authors}
        value={filterValue}
        onChange={setFilterValue}
        onApply={() => {
          const params = new URLSearchParams();
          if (filterValue.categoryId) params.append("categoryId", filterValue.categoryId);
          if (filterValue.authorId) params.append("authorId", filterValue.authorId);
          if (filterValue.status) params.append("status", filterValue.status);
          if (filterValue.sort && filterValue.sort !== "latest") params.append("sort", filterValue.sort);
          router.push(`/explore?${params.toString()}`);
        }}
        isLoading={isLoading}
      />

      {/* ─── Chương mới cập nhật ─── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-2">
          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
            Chương mới cập nhật
          </h3>
          <Link href="/explore?sort=latest" className="text-sm font-bold text-blue-600 hover:text-blue-700">
            {t("viewAll")}
          </Link>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {latestChapters.map((chapter) => (
            <div key={chapter.id} className="group flex items-center gap-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 transition-colors">
              <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded shadow-sm border border-gray-100 dark:border-gray-800">
                <Image
                  src={chapter.story.thumbnailUrl || "/images/placeholder-story.png"}
                  alt={chapter.story.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-grow min-w-0 grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-4">
                <div className="md:col-span-4">
                  <Link href={`/story/${chapter.story.slug}`} className="font-bold text-slate-800 dark:text-slate-200 truncate block hover:text-blue-600 transition-colors">
                    {chapter.story.title}
                  </Link>
                </div>
                <div className="md:col-span-4">
                  <Link href={`/story/${chapter.story.slug}/chuong-${chapter.chapterNumber}`} className="text-sm text-slate-600 dark:text-slate-400 truncate block hover:text-blue-600 transition-colors">
                    Chương {chapter.chapterNumber}: {chapter.title}
                  </Link>
                </div>
                <div className="md:col-span-2">
                  <span className="text-sm text-slate-500 truncate block">
                    {chapter.story.author.name}
                  </span>
                </div>
                <div className="md:col-span-2 md:text-right">
                  <span className="text-xs text-slate-400 font-medium">
                    {timeAgo(chapter.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {latestChapters.length === 0 && isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
              <div className="h-14 w-10 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="flex-grow space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-900 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Truyện mới đăng ─── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("newestTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("newestSubtitle")}</p>
          </div>
          <Link href="/new" className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {t("viewAll")}
          </Link>
        </div>
        <ResponsiveStoryList 
          stories={newestStories} 
          isLoading={isLoading} 
          colsDesktop="5" 
          limit={NEW_LIMIT}
        />
      </section>

      {/* ─── Featured Categories (Horizontal Grid) ─── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("featuredCategoriesTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("featuredCategoriesSubtitle")}</p>
          </div>
          <Link href="/categories" className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {t("viewAll")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.slice(0, 3).map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{cat.name}</p>
              <p className="mt-1 text-xs text-slate-500">{t("storiesCount", { count: cat.storiesCount })}</p>
            </Link>
          ))}

          {categories.length > 3 && (
            <div className="relative">
              <button
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="w-full h-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 flex flex-col items-center justify-center gap-2"
              >
                <p className="font-semibold text-slate-900 dark:text-slate-100">{t("otherCategories")}</p>
                <p className="text-xs text-slate-500">{t("moreCategories", { count: categories.length - 3 })}</p>
              </button>

              {showAllCategories && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowAllCategories(false)}
                  />
                  <div className="absolute z-40 top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-80 overflow-y-auto">
                      {categories.slice(3).map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/categories/${cat.slug}`}
                          onClick={() => setShowAllCategories(false)}
                          className="block px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                        >
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{cat.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{t("storiesCount", { count: cat.storiesCount })}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── Truyện phổ biến (8 truyện: slider mobile, grid 8-col desktop) ─ */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("popularTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("popularSubtitle")}</p>
          </div>
          <Link href="/search?sort=rating" className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {t("viewAll")}
          </Link>
        </div>
        {isLoading ? (
          <div className="flex flex-row gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide lg:grid lg:grid-cols-8 lg:overflow-visible lg:pb-0">
            {Array.from({ length: POPULAR_LIMIT }).map((_, i) => (
              <div key={i} className="w-[130px] sm:w-[150px] shrink-0 snap-start lg:w-full lg:shrink">
                <div className="aspect-[3/4] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : popularStories.length > 0 ? (
          <div className="flex flex-row gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide lg:grid lg:grid-cols-8 lg:overflow-visible lg:pb-0">
            {popularStories.slice(0, POPULAR_LIMIT).map((story) => (
              <div key={story.id} className="w-[130px] sm:w-[150px] shrink-0 snap-start lg:w-full lg:shrink">
                <StoryCard story={story} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("noData")}</p>
        )}
      </section>

      {/* ─── Bảng Xếp Hạng (3 cols trên desktop) ───────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("rankingsTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("rankingsSubtitle")}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Bảng 1: Xếp hạng sức mạnh (Hall of Fame) */}
          <RankingColumn
            title={t("rankHallTitle")}
            viewAllHref="/vinh-danh"
            viewAllLabel={t("viewAll")}
            items={hall.map((m) => ({
              id: m.id,
              name: m.displayName,
              avatarUrl: m.avatarUrl,
              meta: t("vipUnlocked", { tier: m.vipTier, count: m.totalUnlockedStories }),
            }))}
            isLoading={isLoading}
            isUserRanking
          />
          {/* Bảng 2: Truyện mới nhất */}
          <RankingColumn
            title={t("rankNewestTitle")}
            viewAllHref="/new"
            viewAllLabel={t("viewAll")}
            items={newestStories.map((s) => ({
              id: s.id,
              name: s.title,
              avatarUrl: s.thumbnailUrl,
              meta: s.author?.name || "",
              href: `/story/${s.slug}`,
            }))}
            isLoading={isLoading}
          />
          {/* Bảng 3: Truyện được xem nhiều nhất */}
          <RankingColumn
            title={t("rankViewsTitle")}
            viewAllHref="/trending"
            viewAllLabel={t("viewAll")}
            items={topViewsStories.map((s) => ({
              id: s.id,
              name: s.title,
              avatarUrl: s.thumbnailUrl,
              meta: t("totalViews", { count: Number(s.totalViews || 0).toLocaleString("vi-VN") }),
              href: `/story/${s.slug}`,
            }))}
            isLoading={isLoading}
          />
        </div>
      </section>

    </div>
  );
}

function timeAgo(date: string | Date | number) {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return "vừa xong";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} tháng trước`;
  return past.toLocaleDateString("vi-VN");
}

/* ──────────────────────────────────────────────────────────────
   RankingColumn sub-component
   ────────────────────────────────────────────────────────────── */
type RankingItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  meta: string;
  href?: string;
};

function RankingColumn({
  title,
  viewAllHref,
  viewAllLabel,
  items,
  isLoading,
  isUserRanking = false,
}: {
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
  items: RankingItem[];
  isLoading: boolean;
  isUserRanking?: boolean;
}) {
  const rankColors = ["text-amber-500", "text-slate-400", "text-amber-700", "text-slate-500", "text-slate-500"];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
        <Link href={viewAllHref} className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
          {viewAllLabel}
        </Link>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading
          ? Array.from({ length: RANKING_LIMIT }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-6 h-4 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </li>
            ))
          : items.map((item, idx) => {
              const content = (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className={`w-6 text-center text-sm font-black tabular-nums shrink-0 ${rankColors[idx] || "text-slate-400"}`}>
                    {idx + 1}
                  </span>
                  <div className="w-10 h-10 shrink-0 relative">
                    <Image
                      src={
                        item.avatarUrl ||
                        (isUserRanking
                          ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.name)}`
                          : "https://placehold.co/80x80?text=?")
                      }
                      alt={item.name}
                      fill
                      sizes="40px"
                      unoptimized={isUserRanking || item.avatarUrl?.includes("dicebear")}
                      className={`object-cover ${isUserRanking ? "rounded-full" : "rounded-md"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.meta}</p>
                  </div>
                </li>
              );
              return item.href ? (
                <Link key={item.id} href={item.href} className="block">
                  {content}
                </Link>
              ) : content;
            })}
      </ul>
    </div>
  );
}
