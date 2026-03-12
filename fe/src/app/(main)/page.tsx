"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import StoryCard from "@/components/shared/StoryCard";
import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import { apiClient } from "@/lib/api/api-client";
import { fetchExploreCached } from "@/lib/api/public-story-cache";

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

type OptionFilters = {
  categoryId: string;
  authorId: string;
  status: "" | "completed" | "ongoing";
  sort: "latest" | "views" | "rating" | "title_asc" | "chapters_desc";
};

const SECTION_LIMIT = 8;

const storySections = [
  {
    key: "trending",
    params: { sort: "views" as const, trendWindow: "week" },
    viewAllHref: "/trending",
  },
  {
    key: "popular",
    params: { sort: "rating" as const },
    viewAllHref: "/search?sort=rating",
  },
  {
    key: "completed",
    params: { sort: "latest" as const, status: "completed" },
    viewAllHref: "/search?status=completed",
  },
] as const;

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("Home");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";

  const [sectionsData, setSectionsData] = useState<Record<string, StoryItem[]>>({});
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [latestChapters, setLatestChapters] = useState<ChapterItem[]>([]);
  const [hall, setHall] = useState<HallMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [quickFilter, setQuickFilter] = useState<OptionFilters>({
    categoryId: "",
    authorId: "",
    status: "",
    sort: "latest",
  });

  const heroStories = useMemo(() => {
    const trending = sectionsData.trending || [];
    const newest = sectionsData.newest || [];
    return (trending.length ? trending : newest).slice(0, 5);
  }, [sectionsData.newest, sectionsData.trending]);

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
        const sectionRequests = storySections.map((section) =>
          fetchExploreCached<ExploreResponse>({
            limit: SECTION_LIMIT,
            lang,
            ...section.params,
          }),
        );

        const [sectionRes, catRes, fallbackCatRes, authorRes, chapterRes, hallRes] = await Promise.all([
          Promise.allSettled(sectionRequests),
          apiClient
            .get<{ data: CategoryItem[] }>("/stories/categories/top", { params: { limit: 8, lang } })
            .then((res) => res.data?.data || [])
            .catch(() => []),
          apiClient
            .get<Array<{ id: number; name: string; slug: string }>>("/stories/categories")
            .then((res) => res.data || [])
            .catch(() => []),
          apiClient
            .get<AuthorItem[]>("/stories/authors")
            .then((res) => res.data || [])
            .catch(() => []),
          apiClient
            .get<ChapterItem[]>("/chapters/latest", { params: { limit: 10 } })
            .then((res) => res.data || [])
            .catch(() => []),
          apiClient
            .get<{ data: HallMember[] }>("/stories/hall-of-fame", { params: { limit: 3 } })
            .then((res) => res.data?.data || [])
            .catch(() => []),
        ]);

        const nextSections: Record<string, StoryItem[]> = {};
        storySections.forEach((section, idx) => {
          const sectionItem = sectionRes[idx];
          if (!sectionItem || sectionItem.status !== "fulfilled") {
            nextSections[section.key] = [];
            return;
          }
          nextSections[section.key] = sectionItem.value.data || [];
        });

        const categoriesFromTop = catRes || [];
        const categoriesFromFallback = (fallbackCatRes || []).map((item) => ({
          ...item,
          storiesCount: 0,
        }));

        setSectionsData(nextSections);
        setCategories((categoriesFromTop.length ? categoriesFromTop : categoriesFromFallback).slice(0, 8));
        setAuthors(authorRes || []);
        setLatestChapters(chapterRes || []);
        setHall(hallRes || []);
      } catch (error) {
        console.error(t("loadError"), error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHome();
  }, [lang, t]);

  const applyQuickFilter = () => {
    const query = new URLSearchParams();
    if (quickFilter.categoryId) query.set("categoryId", quickFilter.categoryId);
    if (quickFilter.authorId) query.set("authorId", quickFilter.authorId);
    if (quickFilter.status) query.set("status", quickFilter.status);
    if (quickFilter.sort) query.set("sort", quickFilter.sort);
    router.push(`/search?${query.toString()}`);
  };

  const activeHero = heroStories[heroIndex];

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white">
        {activeHero ? (
          <img
            src={activeHero.thumbnailUrl || "https://placehold.co/1600x500?text=Hot+Story"}
            alt={activeHero.title}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-800/40" />

        {/* Next Button */}
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
            <Link href={activeHero ? `/story/${activeHero.slug}` : "/explore"} className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300">
              {t("listenNow")}
            </Link>
            <Link href="/trending" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">
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

      <StoryFilterBar
        categories={categories}
        authors={authors}
        value={quickFilter}
        onChange={setQuickFilter}
        onApply={applyQuickFilter}
      />

      {/* Most Recently Updated Section */}
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

          {latestChapters.length === 0 && Array.from({ length: 5 }).map((_, i) => (
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

      {storySections.map((section) => (
        <section key={section.key} className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t(`${section.key}Title`)}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">{t(`${section.key}Subtitle`)}</p>
            </div>
            <Link href={section.viewAllHref} className="text-sm font-semibold text-blue-600 hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(sectionsData[section.key] || []).map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
          {!isLoading && !(sectionsData[section.key] || []).length ? (
            <p className="text-sm text-slate-500">{t("noData")}</p>
          ) : null}
        </section>
      ))}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("featuredCategoriesTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">{t("featuredCategoriesSubtitle")}</p>
          </div>
          <Link href="/categories" className="text-sm font-semibold text-blue-600 hover:underline">
            {t("viewAll")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.slice(0, 3).map((cat) => (
            <Link
              key={cat.id}
              href={`/chuong-${cat.slug}`}
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

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-amber-50 to-white p-5 dark:border-slate-700 dark:from-amber-900/20 dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("hallTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">{t("hallSubtitle")}</p>
          </div>
          <Link href="/vinh-danh" className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            {t("viewFullRanking")}
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {hall.map((member, idx) => (
            <div key={member.id} className="rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-slate-800">
              <p className="text-xs font-semibold text-amber-600">{t("top", { rank: idx + 1 })}</p>
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.displayName}`}
                  alt={member.displayName}
                  className="h-12 w-12 rounded-full"
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{member.displayName}</p>
                  <p className="text-xs text-slate-500">{t("vipUnlocked", { tier: member.vipTier, count: member.totalUnlockedStories })}</p>
                </div>
              </div>
            </div>
          ))}
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
