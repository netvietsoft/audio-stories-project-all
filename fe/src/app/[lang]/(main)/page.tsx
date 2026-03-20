"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import axios from "axios";
import { useLocale, useTranslations } from "next-intl";
import { Headphones, Heart, PlayCircle } from "lucide-react";

import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import InfiniteMarqueeSlider from "@/components/shared/InfiniteMarqueeSlider";
import StoryListView from "@/components/shared/StoryListView";
import { InteractiveStoryShelf, TopContributorsLeaderboard } from "@/components/shared/StoryDiscoveryBoard";
import { apiClient } from "@/lib/api/api-client";
import { fetchExploreCached } from "@/lib/api/public-story-cache";
import { getLocalizedValue } from "@/lib/story-localization";
import { useUserStore } from "@/stores/user-store";
import { useRouter } from "next/navigation";

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
const POPULAR_LIMIT = 8;

export default function HomePage() {
  const t = useTranslations("Home");
  const tProfile = useTranslations("ProfilePage");
  const tNavbar = useTranslations("Navbar");
  const tStoryDetail = useTranslations("StoryDetail");
  const tProfileHistory = useTranslations("ProfileHistoryPage");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const router = useRouter();
  const accessToken = useUserStore((state) => state.accessToken);

  const [newestStories, setNewestStories] = useState<StoryItem[]>([]);
  const [newestChapters, setNewestChapters] = useState<any[]>([]);
  const [popularStories, setPopularStories] = useState<StoryItem[]>([]);
  const [trendingStories, setTrendingStories] = useState<StoryItem[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryItem[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [hallContributors, setHallContributors] = useState<HallContributor[]>([]);
  const [heroBanners, setHeroBanners] = useState<BannerItem[]>([]);
  const [favoriteStories, setFavoriteStories] = useState<FavoriteItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isPersonalizedLoading, setIsPersonalizedLoading] = useState(false);
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
          trendingRes,
          catTopRes,
          catFallbackRes,
          authorRes,
          hallRes,
          bannersRes,
        ] = await Promise.allSettled([
          fetchExploreCached<ExploreResponse>({ limit: NEW_LIMIT, lang, sort: "latest" }),
          apiClient.get("/chapters/latest", { params: { limit: 12 } }).then((r) => r.data || []).catch(() => []),
          fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, sort: "rating" }),
          fetchExploreCached<ExploreResponse>({ limit: POPULAR_LIMIT, lang, sort: "views", trendWindow: "week" }),
          apiClient
            .get<{ data: CategoryItem[] }>("/stories/categories/top", { params: { limit: 20, lang } })
            .then((r) => r.data?.data || [])
            .catch(() => []),
          apiClient
            .get<Array<{ id: number; name: string; slug: string }>>("/stories/categories", {
              params: { language: lang }
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
        setTrendingStories(trendingRes.status === "fulfilled" ? (trendingRes.value.data || []) : []);

        const catTop = catTopRes.status === "fulfilled" ? catTopRes.value : [];
        const catFb = catFallbackRes.status === "fulfilled"
          ? (catFallbackRes.value as Array<any>).map((c) => ({ ...c, storiesCount: 0 }))
          : [];
        setTopCategories(catTop.length ? catTop : catFb);
        setAllCategories(catFb);

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
  const discoveryFeaturedStories = (trendingStories.length ? trendingStories : popularStories).slice(0, 7);

  return (
    <div className="space-y-12">

      {/* ─── Hero Banner ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white">
        {activeHero ? (
          <Image
            src={activeHero.imageUrl || "https://placehold.co/1600x500?text=Hot+Story"}
            alt={activeHero.title}
            fill
            sizes="100vw"
            priority
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-800/40 pointer-events-none" />

        {heroSlides.length > 1 && (
          <button
            onClick={() => setHeroIndex((prev) => (prev === heroSlides.length - 1 ? 0 : prev + 1))}
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
            {activeHero ? (activeHero.subtitle || t("heroFeatured", { title: activeHero.title })) : t("heroFallback")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {activeHero?.isExternal ? (
              <a
                href={activeHero.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition-colors"
              >
                {t("listenNow")}
              </a>
            ) : (
              <Link href={activeHero ? activeHero.href : "/explore"} className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition-colors">
                {t("listenNow")}
              </Link>
            )}
            <Link href="/trending" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">
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

      {/* ─── Hashtag / Category Strip ────────────────────────────── */}
      {topCategories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("hashtagsTitle")}</h2>
            <Link href="/categories" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
              {t("viewAll")}
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/explore?categoryId=${cat.id}`}
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
        categories={allCategories.map((c) => ({
          id: c.id,
          name: c.name,
          nameVi: c.nameVi,
          nameEn: c.nameEn
        }))}
        authors={authors}
        value={filterValue}
        onChange={setFilterValue}
        onApply={() => {
          const params = new URLSearchParams();
          if (filterValue.categoryId) params.append("categoryId", filterValue.categoryId);
          if (filterValue.authorId) params.append("authorId", filterValue.authorId);
          if (filterValue.status) params.append("status", filterValue.status);
          if (filterValue.sort && filterValue.sort !== "latest") params.append("sort", filterValue.sort);
          router.push(`/${locale}/explore?${params.toString()}`);
        }}
        isLoading={isLoading}
      />

      {accessToken ? (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("continueTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("continueSubtitle")}</p>
              </div>
              <Link href="/profile/history" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800">
                <Headphones className="h-4 w-4" />
                {tNavbar("listeningHistory")}
              </Link>
            </div>

            {isPersonalizedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
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
                      className="flex items-center gap-4 rounded-2xl bg-white p-3 transition-all hover:-translate-y-0.5 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
                        <Image
                          src={item.story.thumbnailUrl || "https://placehold.co/120x180?text=No+Cover"}
                          alt={storyTitle}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">{storyTitle}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{tProfile("chapterTitle", { number: item.chapter.chapterNumber, title: chapterTitle })}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t("continueProgress", { percent: progressPercent })}</p>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                        <PlayCircle className="h-5 w-5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-100 p-6 text-sm text-slate-500 dark:bg-gray-800/50 dark:text-slate-400">
                {t("continueEmpty")}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("favoritesListTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("favoritesListSubtitle")}</p>
              </div>
              <Link href="/profile?panel=favorites" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800">
                <Heart className="h-4 w-4" />
                {tNavbar("favorites")}
              </Link>
            </div>

            {isPersonalizedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
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
                      className="flex items-center gap-4 rounded-2xl bg-white p-3 transition-all hover:-translate-y-0.5 hover:bg-pink-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
                        <Image
                          src={story.thumbnailUrl || "https://placehold.co/120x180?text=No+Cover"}
                          alt={storyTitle}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">{storyTitle}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{categoryName}</p>
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
              <div className="rounded-2xl bg-gray-100 p-6 text-sm text-slate-500 dark:bg-gray-800/50 dark:text-slate-400">
                {t("favoritesEmpty")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ─── Truyện Trending ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("trendingTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("trendingSubtitle")}</p>
          </div>
          <Link href="/trending" className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {t("viewAll")}
          </Link>
        </div>
        <InteractiveStoryShelf stories={discoveryFeaturedStories} />
      </section>

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
        <div className="rounded-2xl bg-white p-4 dark:bg-gray-900">
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
        <InfiniteMarqueeSlider stories={popularStories} isLoading={isLoading} />
      </section>

      {/* ─── Hall of Fame ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("hallTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("hallSubtitle")}</p>
          </div>
          <Link href="/hall" className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {t("viewFullRanking")}
          </Link>
        </div>
        <TopContributorsLeaderboard contributors={hallContributors} />
      </section>

    </div>
  );
}

