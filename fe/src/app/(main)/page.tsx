"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import HorizontalStorySlider from "@/components/shared/HorizontalStorySlider";
import StoryListView from "@/components/shared/StoryListView";
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
  storiesCount?: number;
};

type AuthorItem = {
  id: string;
  name: string;
};

type HallMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  vipTier: number;
  totalUnlockedStories: number;
  credits: number;
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
  const [newestChapters, setNewestChapters] = useState<any[]>([]);
  const [popularStories, setPopularStories] = useState<StoryItem[]>([]);
  const [trendingStories, setTrendingStories] = useState<StoryItem[]>([]);
  const [topRatingStories, setTopRatingStories] = useState<StoryItem[]>([]);
  const [topViewsStories, setTopViewsStories] = useState<StoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [hall, setHall] = useState<HallMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
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
          newestChaptersRes,
          popularRes,
          trendingRes,
          topRatingRes,
          topViewsRes,
          catTopRes,
          catFallbackRes,
          hallRes,
          authorRes,
        ] = await Promise.allSettled([
          fetchExploreCached<ExploreResponse>({ limit: NEW_LIMIT, lang, sort: "latest" }),
          apiClient.get("/chapters/latest", { params: { limit: 5 } }).then((r) => r.data || []).catch(() => []),
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
        ]);

        setNewestStories(newestRes.status === "fulfilled" ? (newestRes.value.data || []) : []);
        setNewestChapters(newestChaptersRes.status === "fulfilled" ? newestChaptersRes.value : []);
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

      {/* ─── Truyện mới đăng (List view) ─────────────── */}
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <StoryListView chapters={newestChapters} isLoading={isLoading} />
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
        <HorizontalStorySlider stories={popularStories} isLoading={isLoading} limit={POPULAR_LIMIT} />
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

