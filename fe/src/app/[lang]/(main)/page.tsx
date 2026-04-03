"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import axios from "axios";
import { useLocale, useTranslations } from "next-intl";
import { Headphones, Heart, PlayCircle } from "lucide-react";

import InfiniteMarqueeSlider from "@/components/shared/InfiniteMarqueeSlider";
import StoryListView from "@/components/shared/StoryListView";
import CategoryTabsSection from "@/components/story/CategoryTabsSection";
import HighRatingStoriesGrid from "@/components/story/HighRatingStoriesGrid";
import CategoryStoriesGrid from "@/components/story/CategoryStoriesGrid";
import CompletedStoriesGrid from "@/components/story/CompletedStoriesGrid";
import InteractiveStoriesSection from "../../../components/story/InteractiveStoriesSection";
import { InteractiveStoryShelf, TopContributorsLeaderboard } from "@/components/shared/StoryDiscoveryBoard";
import TrendingKeywords from "@/components/shared/TrendingKeywords";
import { apiClient } from "@/lib/api/api-client";
import { fetchExploreCached } from "@/lib/api/public-story-cache";
import { getLocalizedValue } from "@/lib/story-localization";
import { useUserStore } from "@/stores/user-store";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
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
  nameVi?: string | null;
  nameEn?: string | null;
  slug: string;
  storiesCount?: number;
  imageUrl?: string | null;
};

type AuthorItem = {
  id: string;
  name: string;
};

type FavoriteItem = {
  id: string;
  slug: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  author?: {
    name: string;
  };
  categories?: Array<{ category: { id: number; name: string; nameVi?: string | null; nameEn?: string | null; slug: string } }>;
};

type FavoriteResponse = {
  data: FavoriteItem[];
};

type HistoryItem = {
  id: string;
  progressSeconds: number;
  lastListenedAt: string;
  story: {
    id: string;
    slug: string;
    title: string;
    titleVi?: string | null;
    titleEn?: string | null;
    thumbnailUrl: string | null;
    author?: {
      name: string;
    };
  };
  chapter: {
    id: string;
    chapterNumber: number;
    title: string;
    titleVi?: string | null;
    titleEn?: string | null;
    audioDuration: number | null;
  };
};

type HistoryResponse = {
  data: HistoryItem[];
};

type ExploreResponse = {
  data: StoryItem[];
};

type HallContributor = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  vipTier: number;
  credits: number;
  totalUnlockedStories: number;
};

type HallResponse = {
  data: HallContributor[];
};

type BannerItem = {
  id: string;
  titleVi: string;
  titleEn: string;
  subtitleVi?: string | null;
  subtitleEn?: string | null;
  imageUrl: string;
  targetUrl: string;
  order: number;
  isActive: boolean;
  story?: {
    id: string;
    slug: string;
    title: string;
  } | null;
};

type BannerResponse = {
  data: BannerItem[];
};

type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  isExternal?: boolean;
};

const NEW_LIMIT = 5;
const POPULAR_LIMIT = 9;
const HOME_AXIS_CLASS = "mx-auto w-full px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw]";

export default function HomePage() {
  const t = useTranslations("Home");
  const tProfile = useTranslations("ProfilePage");
  const tNavbar = useTranslations("Navbar");
  const tStoryDetail = useTranslations("StoryDetail");
  const tProfileHistory = useTranslations("ProfileHistoryPage");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const accessToken = useUserStore((state) => state.accessToken);

  const [newestStories, setNewestStories] = useState<StoryItem[]>([]);
  const [newestChapters, setNewestChapters] = useState<any[]>([]);
  const [popularStories, setPopularStories] = useState<StoryItem[]>([]);
  const [completedStories, setCompletedStories] = useState<StoryItem[]>([]);
  const [trendingStories, setTrendingStories] = useState<StoryItem[]>([]);
  const [actionStories, setActionStories] = useState<StoryItem[]>([]);
  const [xuyenKhongStories, setXuyenKhongStories] = useState<StoryItem[]>([]);
  const [shounenStories, setShounenStories] = useState<StoryItem[]>([]);
  const [tienHiepStories, setTienHiepStories] = useState<StoryItem[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryItem[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [hallContributors, setHallContributors] = useState<HallContributor[]>([]);
  const [heroBanners, setHeroBanners] = useState<BannerItem[]>([]);
  const [favoriteStories, setFavoriteStories] = useState<FavoriteItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  
  const [displayCategories, setDisplayCategories] = useState<CategoryItem[]>([]);
  const [displayCategoryStories, setDisplayCategoryStories] = useState<Record<number, StoryItem[]>>({});
  
  const [isPersonalizedLoading, setIsPersonalizedLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  const heroStories = useMemo(() => {
    return (trendingStories.length ? trendingStories : newestStories).slice(0, 5);
  }, [trendingStories, newestStories]);

  const heroSlides = useMemo<HeroSlide[]>(() => {
    if (heroBanners.length > 0) {
      return heroBanners.map((banner) => {
        const isExternal = /^https?:\/\//i.test(banner.targetUrl);
        const normalizedTarget = isExternal
          ? banner.targetUrl
          : banner.targetUrl.startsWith('/')
            ? banner.targetUrl
            : `/${banner.targetUrl}`;

        return {
          id: banner.id,
          title: getLocalizedValue(locale, banner.titleVi, banner.titleEn, banner.titleVi),
          subtitle: getLocalizedValue(locale, banner.subtitleVi, banner.subtitleEn, ''),
          imageUrl: banner.imageUrl,
          href: normalizedTarget,
          isExternal,
        };
      });
    }

    return heroStories.map((story) => ({
      id: story.id,
      title: story.title,
      subtitle: t('heroFeatured', { title: story.title }),
      imageUrl: story.thumbnailUrl || 'https://placehold.co/1600x500?text=Hot+Story',
      href: `/story/${story.slug}`,
      isExternal: false,
    }));
  }, [heroBanners, heroStories, locale, t]);

  useEffect(() => {
    if (!heroSlides.length) return;

    setHeroIndex((prev) => (prev >= heroSlides.length ? 0 : prev));

    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const loadHome = async () => {
      setIsLoading(true);
      try {
        const [
          newestRes,
          newestChaptersRes,
          popularRes,
          completedRes,
          trendingRes,
          catTopRes,
          catFallbackRes,
          authorRes,
          hallRes,
          bannersRes,
        ] = await Promise.allSettled([
          fetchExploreCached<ExploreResponse>({ limit: NEW_LIMIT, lang, sort: "latest" }),
          apiClient.get("/chapters/latest", { params: { limit: 12, lang } }).then((r) => r.data || []).catch(() => []),
          fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, sort: "rating" }),
          fetchExploreCached<ExploreResponse>({ limit: 14, lang, sort: "rating", status: "completed" }),
          fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, sort: "views", trendWindow: "week" }),
          apiClient
            .get<{ data: CategoryItem[] }>("/stories/categories/top", { params: { limit: 20, lang, _t: Date.now() } })
            .then((r) => r.data?.data || [])
            .catch(() => []),
          apiClient
            .get<Array<{ id: number; name: string; slug: string }>>("/stories/categories", {
              params: { language: lang, _t: Date.now() }
            })
            .then((r) => r.data || [])
            .catch(() => []),
          apiClient
            .get<AuthorItem[]>("/stories/authors")
            .then((r) => r.data || [])
            .catch(() => []),
          apiClient
            .get<HallResponse>("/stories/hall-of-fame", { params: { limit: 6 } })
            .then((r) => r.data?.data || [])
            .catch(() => []),
          apiClient
            .get<BannerResponse>("/banners", { params: { active: true, lang } })
            .then((r) => r.data?.data || [])
            .catch(() => []),
        ]);

        setNewestStories(newestRes.status === "fulfilled" ? (newestRes.value.data || []) : []);
        setNewestChapters(newestChaptersRes.status === "fulfilled" ? newestChaptersRes.value : []);
        setPopularStories(popularRes.status === "fulfilled" ? (popularRes.value.data || []) : []);
        setCompletedStories(completedRes.status === "fulfilled" ? (completedRes.value.data || []) : []);
        setTrendingStories(trendingRes.status === "fulfilled" ? (trendingRes.value.data || []) : []);

        const catTop = catTopRes.status === "fulfilled" ? catTopRes.value : [];
        const catFb = catFallbackRes.status === "fulfilled"
          ? (catFallbackRes.value as Array<any>).map((c) => ({ ...c, storiesCount: 0 }))
          : [];
        const allCats = catTop.length ? catTop : catFb;
        setTopCategories(allCats);
        setAllCategories(catFb);

        // Fetch category stories
        const findCatId = (slug: string) => allCats.find(c => c.slug === slug)?.id;
        const actionId = findCatId('action');
        const xuyenKhongId = findCatId('xuyen-khong');
        const shounenId = findCatId('shounen');
        const tienHiepId = findCatId('tien-hiep');

        const [actionRes, xuyenKhongRes, shounenRes, tienHiepRes] = await Promise.allSettled([
          actionId ? fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, categoryId: actionId }) : Promise.resolve({ data: [] }),
          xuyenKhongId ? fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, categoryId: xuyenKhongId }) : Promise.resolve({ data: [] }),
          shounenId ? fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, categoryId: shounenId }) : Promise.resolve({ data: [] }),
          tienHiepId ? fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, categoryId: tienHiepId }) : Promise.resolve({ data: [] }),
        ]);

        setActionStories(actionRes.status === "fulfilled" ? (actionRes.value.data || []) : []);
        setXuyenKhongStories(xuyenKhongRes.status === "fulfilled" ? (xuyenKhongRes.value.data || []) : []);
        setShounenStories(shounenRes.status === "fulfilled" ? (shounenRes.value.data || []) : []);
        setTienHiepStories(tienHiepRes.status === "fulfilled" ? (tienHiepRes.value.data || []) : []);

        // Keep category order stable from API response and only exclude tabs categories.
        const excludedSlugs = ['action', 'xuyen-khong', 'shounen', 'tien-hiep'];
        const availableCategories = allCats.filter(cat => !excludedSlugs.includes(cat.slug));

        const selectedCategories = availableCategories.slice(0, 8);
        setDisplayCategories(selectedCategories);

        // Fetch stories for the displayed categories.
        const displayCategoryPromises = selectedCategories.map(cat =>
          fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, categoryId: cat.id })
        );

        const displayCategoryResults = await Promise.allSettled(displayCategoryPromises);
        const storiesMap: Record<number, StoryItem[]> = {};
        
        selectedCategories.forEach((cat, index) => {
          const result = displayCategoryResults[index];
          if (result && result.status === "fulfilled") {
            storiesMap[cat.id] = result.value.data || [];
          } else {
            storiesMap[cat.id] = [];
          }
        });

        setDisplayCategoryStories(storiesMap);

        setAuthors(authorRes.status === "fulfilled" ? authorRes.value : []);
        setHallContributors(hallRes.status === "fulfilled" ? hallRes.value : []);
        setHeroBanners(bannersRes.status === "fulfilled" ? bannersRes.value : []);
      } catch (error) {
        console.error(t("loadError"), error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHome();
  }, [lang, t]);

  useEffect(() => {
    if (!accessToken) {
      setFavoriteStories([]);
      setHistoryItems([]);
      setIsPersonalizedLoading(false);
      return;
    }

    const loadPersonalized = async () => {
      setIsPersonalizedLoading(true);
      try {
        const [favoriteRes, historyRes] = await Promise.allSettled([
          apiClient.get<FavoriteResponse>("/favorites", { params: { page: 1, limit: 3, sort: "latest" } }),
          apiClient.get<HistoryResponse>("/history", { params: { page: 1, limit: 3 } }),
        ]);

        const hasUnauthorized = [favoriteRes, historyRes].some(
          (result) => result.status === "rejected" && axios.isAxiosError(result.reason) && result.reason.response?.status === 401,
        );

        if (hasUnauthorized) {
          setFavoriteStories([]);
          setHistoryItems([]);
          return;
        }

        const nextFavorites = favoriteRes.status === "fulfilled" ? (favoriteRes.value.data.data || []) : [];
        const nextHistory = historyRes.status === "fulfilled" ? (historyRes.value.data.data || []) : [];

        setFavoriteStories(nextFavorites);
        setHistoryItems(nextHistory);

        const firstError = [favoriteRes, historyRes].find((result) => result.status === "rejected");
        if (firstError && firstError.status === "rejected") {
          console.error("Failed to load personalized home data", firstError.reason);
        }
      } catch (error) {
        console.error("Failed to load personalized home data", error);
      } finally {
        setIsPersonalizedLoading(false);
      }
    };

    void loadPersonalized();
  }, [accessToken]);

  const activeHero = heroSlides[heroIndex];
  const discoveryFeaturedStories = (trendingStories.length ? trendingStories : popularStories).slice(0, 9);
  const categoryIdBySlug = new Map(allCategories.map((category) => [category.slug, category.id]));
  const categoryTabs = [
    {
      key: "action",
      label: t("actionTitle"),
      stories: actionStories,
      href: categoryIdBySlug.get("action") ? `/explore?categoryId=${categoryIdBySlug.get("action")}` : "/explore",
    },
    {
      key: "xuyen-khong",
      label: t("xuyenKhongTitle"),
      stories: xuyenKhongStories,
      href: categoryIdBySlug.get("xuyen-khong") ? `/explore?categoryId=${categoryIdBySlug.get("xuyen-khong")}` : "/explore",
    },
    {
      key: "shounen",
      label: t("shounenTitle"),
      stories: shounenStories,
      href: categoryIdBySlug.get("shounen") ? `/explore?categoryId=${categoryIdBySlug.get("shounen")}` : "/explore",
    },
    {
      key: "tien-hiep",
      label: t("tienHiepTitle"),
      stories: tienHiepStories,
      href: categoryIdBySlug.get("tien-hiep") ? `/explore?categoryId=${categoryIdBySlug.get("tien-hiep")}` : "/explore",
    },
  ].filter((tab) => tab.stories.length > 0);

  return (
    <div className="space-y-10 md:space-y-8">

      {/* ─── Hero Banner ─────────────────────────────────────────── */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#161616] text-white -mt-8">
        {activeHero ? (
          <div className="absolute inset-y-0 left-1/2 w-2/3 -translate-x-1/2">
            <Image
              src={activeHero.imageUrl || "https://placehold.co/1600x500?text=Hot+Story"}
              alt={activeHero.title}
              fill
              sizes="100vw"
              priority
              className="object-cover object-center"
            />
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#161616] via-[#161616]/90 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#161616] via-[#161616]/90 to-transparent" />
        </div>

        {heroSlides.length > 1 && (
          <button
            onClick={() => setHeroIndex((prev) => (prev === heroSlides.length - 1 ? 0 : prev + 1))}
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-[#3a3b3c]/60 p-3 backdrop-blur-sm transition-all hover:bg-[#3a3b3c]/85 hover:scale-110"
            aria-label="Next slide"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div className="relative z-10 mx-auto w-full px-4 pb-8 pt-6 sm:px-6 md:px-8 lg:w-[70vw] lg:px-0 md:pb-12 md:pt-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300 sm:text-xs">{t("heroBadge")}</p>
          <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl md:mt-3 md:text-5xl">
            {t("heroTitleLine1")}
            <br className="hidden md:block" /> {t("heroTitleLine2")}
          </h1>
          <p className="mt-2 max-w-2xl text-xs text-slate-200 sm:text-sm md:mt-3 md:text-base">
            {activeHero ? (activeHero.subtitle || t("heroFeatured", { title: activeHero.title })) : t("heroFallback")}
          </p>
          <div className="mt-5 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
            {activeHero?.isExternal ? (
              <a
                href={activeHero.href}
                target="_blank"
                rel="noreferrer"
                className="whitespace-nowrap rounded-full bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-amber-300 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                {t("listenNow")}
              </a>
            ) : (
              <Link href={activeHero ? activeHero.href : "/explore"} className="whitespace-nowrap rounded-full bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-amber-300 sm:px-5 sm:py-2.5 sm:text-sm">
                {t("listenNow")}
              </Link>
            )}
            <Link href="/trending" className="whitespace-nowrap rounded-full border border-white/30 px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-white/10 sm:px-5 sm:py-2.5 sm:text-sm">
              {t("viewTrending")}
            </Link>
          </div>
          <div className="mt-6 flex gap-2">
            {heroSlides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setHeroIndex(idx)}
                className={`h-2.5 rounded-full transition-all ${idx === heroIndex ? "w-10 bg-amber-300" : "w-2.5 bg-white/40"}`}
                aria-label={`hero-${idx + 1}`}
              />
            ))}
          </div>
        </div>
        </section>

      {accessToken ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-[#242526]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">{t("continueTitle")}</h2>
              </div>
              <Link href="/profile/history" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-pink-600 hover:bg-slate-50 dark:border-[#303133] dark:text-pink-400 dark:hover:bg-[#3a3b3c]">
                <Headphones className="h-4 w-4" />
                {tNavbar("listeningHistory")}
              </Link>
            </div>

            {isPersonalizedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#3a3b3c]" />
                ))}
              </div>
            ) : historyItems.length > 0 ? (
              <div className="space-y-3">
                {historyItems.map((item) => {
                  const storyTitle = getLocalizedValue(locale, item.story.titleVi, item.story.titleEn, item.story.title);
                  const chapterTitle = getLocalizedValue(locale, item.chapter.titleVi, item.chapter.titleEn, item.chapter.title);
                  const progressPercent = item.chapter.audioDuration
                    ? Math.min(100, Math.round((item.progressSeconds / item.chapter.audioDuration) * 100))
                    : 0;

                  return (
                    <Link
                      key={item.id}
                      href={`/story/${item.story.slug}/chuong-${item.chapter.chapterNumber}`}
                      className="flex items-center gap-4 rounded-2xl bg-white p-3 transition-all hover:-translate-y-0.5 hover:bg-pink-100 dark:bg-[#212121] dark:hover:bg-[#3a3b3c]"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-[#3a3b3c]">
                        <Image
                          src={item.story.thumbnailUrl || "https://placehold.co/120x180?text=No+Cover"}
                          alt={storyTitle}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{storyTitle}</p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{tProfile("chapterTitle", { number: item.chapter.chapterNumber, title: chapterTitle })}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-[#3a3b3c]">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t("continueProgress", { percent: progressPercent })}</p>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-600 text-white shadow-sm">
                        <PlayCircle className="h-5 w-5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-100 p-6 text-sm text-slate-500 dark:bg-[#212121] dark:text-slate-400">
                {t("continueEmpty")}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-[#242526]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">{t("favoritesListTitle")}</h2>
              </div>
              <Link href="/profile?panel=favorites" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-pink-600 hover:bg-slate-50 dark:border-[#303133] dark:text-pink-400 dark:hover:bg-[#3a3b3c]">
                <Heart className="h-4 w-4" />
                {tNavbar("favorites")}
              </Link>
            </div>

            {isPersonalizedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#3a3b3c]" />
                ))}
              </div>
            ) : favoriteStories.length > 0 ? (
              <div className="space-y-3">
                {favoriteStories.map((story) => {
                  const storyTitle = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
                  const categoryName = story.categories?.[0]?.category
                    ? getLocalizedValue(locale, story.categories[0].category.nameVi, story.categories[0].category.nameEn, story.categories[0].category.name)
                    : t("uncategorized");

                  return (
                    <Link
                      key={story.id}
                      href={`/story/${story.slug}`}
                      className="flex items-center gap-4 rounded-2xl bg-white p-3 transition-all hover:-translate-y-0.5 hover:bg-pink-100 dark:bg-[#212121] dark:hover:bg-[#3a3b3c]"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-[#3a3b3c]">
                        <Image
                          src={story.thumbnailUrl || "https://placehold.co/120x180?text=No+Cover"}
                          alt={storyTitle}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{storyTitle}</p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{categoryName}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{story.author?.name || tStoryDetail("authorUpdating")}</p>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-600 text-white shadow-sm">
                        <Heart className="h-5 w-5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-100 p-6 text-sm text-slate-500 dark:bg-[#212121] dark:text-slate-400">
                {t("favoritesEmpty")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="space-y-10 md:space-y-8">
        {/* ─── Hashtag / Category Strip ────────────────────────────── */}
        {topCategories.length > 0 && (
          <section className="space-y-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("hashtagsTitle")}</h2>
              <Link href="/stories" className="text-sm font-semibold text-pink-600 hover:underline dark:text-pink-400">
                {t("viewAll")}
              </Link>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
              {topCategories.slice(0, 6).map((cat, index) => {
                // Màu gradient modern, pastel
                const gradients = [
                  'from-pink-400 to-rose-400',
                  'from-purple-400 to-violet-400',
                  'from-pink-400 to-cyan-400',
                  'from-emerald-400 to-teal-400',
                  'from-amber-400 to-orange-400',
                  'from-fuchsia-400 to-pink-400',
                  'from-indigo-400 to-pink-400',
                  'from-lime-400 to-green-400',
                ];
                const gradient = gradients[index % gradients.length];
                if (cat.imageUrl) {
                  return (
                    <Link
                      key={cat.id}
                      href={`/explore?categoryId=${cat.id}&lang=${lang}`}
                      className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg w-[90%] mx-auto h-10 sm:h-12 md:h-14 flex items-center justify-center overflow-hidden"
                    >
                      {/* Background Image */}
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: cat.imageUrl ? `url('${cat.imageUrl}')` : undefined }}
                      />
                      {/* Dark overlay for readability */}
                      <div className="absolute inset-0 bg-black/40" />

                      {/* Category Name */}
                      <div className="relative z-10 flex items-center justify-center w-full h-full">
                        <span className="text-[11px] sm:text-xs md:text-sm font-bold text-center px-1.5 line-clamp-1 w-full text-white drop-shadow-lg">
                          {getLocalizedValue(locale, cat.nameVi, cat.nameEn, cat.name)}
                        </span>
                      </div>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={cat.id}
                    href={`/explore?categoryId=${cat.id}&lang=${lang}`}
                    className={`group relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg w-[90%] mx-auto h-10 sm:h-12 md:h-14 flex items-center justify-center overflow-hidden`}
                  >
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} group-hover:brightness-110 transition-all`} />
                    
                    {/* Category Name */}
                    <div className="relative z-10 flex items-center justify-center w-full h-full">
                      <span className="text-[11px] sm:text-xs md:text-sm font-bold text-center px-1.5 line-clamp-1 w-full text-white drop-shadow-lg">
                        {getLocalizedValue(locale, cat.nameVi, cat.nameEn, cat.name)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Truyện Rating Cao (Grid 2 hàng x 4) ─ */}
        <section className="relative left-1/2 w-dvw -translate-x-1/2 bg-pink-50/50 py-12 dark:bg-slate-800/50">
          <div className={HOME_AXIS_CLASS}>
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">{locale === "en" ? "High-Rating Stories" : "Truyện Rating Cao"}</h2>
                </div>
                <Link href="/search?sort=rating" className="shrink-0 text-sm font-semibold text-pink-600 hover:underline dark:text-pink-400">
                  {t("viewAll")}
                </Link>
              </div>
              <HighRatingStoriesGrid stories={popularStories} isLoading={isLoading} tone="pink" />
            </div>
          </div>
        </section>

        {/* ─── Truyện Trending ─────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">{t("trendingTitle")}</h2>
            </div>
            <Link href="/trending" className="shrink-0 text-sm font-semibold text-pink-600 hover:underline dark:text-pink-400">
              {t("viewAll")}
            </Link>
          </div>
          <InteractiveStoryShelf stories={discoveryFeaturedStories} />
        </section>
      </div>

      {/* ─── Truyện mới đăng (Stripe layout) ─────────── */}
      <section className="relative left-1/2 w-dvw -translate-x-1/2 bg-pink-50/50 py-12 dark:bg-slate-800/50">
          <div className={HOME_AXIS_CLASS}>
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">{t("newestTitle")}</h2>
              </div>
              <Link href="/new" className="shrink-0 text-sm font-semibold text-pink-600 hover:underline dark:text-pink-400">
                {t("viewAll")}
              </Link>
            </div>
            <div className="bg-transparent">
              <StoryListView chapters={newestChapters} isLoading={isLoading} tone="pink" />
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-10 md:space-y-8">
        <InteractiveStoriesSection />

        {/* ─── Truyện hoàn thành (Grid 2 hàng x 4) ─ */}
        {completedStories.length > 0 && (
          <section className="relative left-1/2 w-dvw -translate-x-1/2 bg-pink-50/50 py-12 dark:bg-slate-800/50">
            <div className={HOME_AXIS_CLASS}>
            <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">{locale === "en" ? "Completed Stories" : "Truyện Hoàn Thành"}</h2>
              </div>
              <Link href="/search?status=completed&sort=rating" className="shrink-0 text-sm font-semibold text-pink-600 hover:underline dark:text-pink-400">
                {t("viewAll")}
              </Link>
            </div>
              <CompletedStoriesGrid stories={completedStories} isLoading={isLoading} tone="pink" />
            </div>
            </div>
          </section>
        )}

        {/* ─── Category Sections ─ */}
        {displayCategories.map((category, index) => {
          const stories = displayCategoryStories[category.id] || [];
          if (stories.length === 0) return null;

          const categoryName = getLocalizedValue(locale, category.nameVi, category.nameEn, category.name);
          const isPinkSection = index % 2 === 1;
          const categorySectionClassName = isPinkSection
            ? "relative left-1/2 w-dvw -translate-x-1/2 bg-pink-50/50 py-12 dark:bg-slate-800/50"
            : "relative left-1/2 w-dvw -translate-x-1/2 bg-white py-12 dark:bg-[#242526]";

          return (
            <section key={category.id} className={categorySectionClassName}>
              <div className={HOME_AXIS_CLASS}>
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                    {locale === "en" ? `${categoryName} Stories` : `Truyện ${categoryName}`}
                  </h2>
                </div>
                <Link 
                  href={`/explore?categoryId=${category.id}`} 
                  className="shrink-0 text-sm font-semibold text-pink-600 hover:underline dark:text-pink-400"
                >
                  {t("viewAll")}
                </Link>
              </div>
              <CategoryStoriesGrid stories={stories} isLoading={isLoading} tone={isPinkSection ? "pink" : "default"} />
              </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* ─── Tabs thể loại (1 carousel duy nhất) ─ */}
      <section className="relative left-1/2 w-dvw -translate-x-1/2 py-12">
        <div className={HOME_AXIS_CLASS}>
          <CategoryTabsSection tabs={categoryTabs} isLoading={isLoading} />
        </div>
      </section>

      {/* ─── Hall of Fame ─────────────────────────────────────────── */}
      <div className="space-y-10 md:space-y-8">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">{t("hallTitle")}</h2>
            </div>
            <Link href="/vinh-danh" className="shrink-0 text-sm font-semibold text-pink-600 hover:underline dark:text-pink-400 whitespace-nowrap">
              {t("viewFullRanking")}
            </Link>
          </div>
          <TopContributorsLeaderboard contributors={hallContributors} />
        </section>

        {/* ─── Trending Keywords ─────────────────────────────────────── */}
        <TrendingKeywords />
      </div>

    </div>
  );
}

