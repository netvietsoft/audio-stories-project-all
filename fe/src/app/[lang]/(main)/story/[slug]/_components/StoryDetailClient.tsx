"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, ChevronDown, Clock3, Facebook, Globe, Headphones, ListMusic, Lock, Play, PlayCircle, Share2, Star, Zap } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import FavoriteButton from "@/components/shared/FavoriteButton";
import StoryUpdateSubscriptionButton from "@/components/shared/StoryUpdateSubscriptionButton";
import { getLocalizedValue } from "@/lib/story-localization";
import { cleanChapterTitle } from "@/lib/formatChapterTitle";
import { useViewTracking } from "@/hooks/use-view-tracking";

type ChapterItem = {
  id: string;
  title: string;
  titleVi?: string;
  titleEn?: string;
  chapterNumber: number;
  audioDuration: number | null;
  accessType: "free" | "timed" | "vip";
  unlocksAt: string | null;
};

type StoryDetail = {
  id: string;
  title: string;
  titleVi?: string;
  titleEn?: string;
  slug: string;
  description: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  language: string;
  facebookGroupUrl: string | null;
  totalViews: number;
  averageRating: number;
  ratingCount: number;
  updatedAt: string;
  author?: { name: string };
  categories: { category: { id: number; name: string; slug: string } }[];
  chapters: ChapterItem[];
  isInteractive?: boolean;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const totalSeconds = Math.floor(seconds);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const chapterHref = (slug: string, chapterNumber: number) => `/story/${slug}/chuong-${chapterNumber}`;

const getUnlockLabel = (chapter: ChapterItem, t: ReturnType<typeof useTranslations>) => {
  if (chapter.accessType === "free") return null;
  if (chapter.accessType === "vip") return t("unlockVip");
  if (!chapter.unlocksAt) return t("unlockTimed");

  const msLeft = new Date(chapter.unlocksAt).getTime() - Date.now();
  if (msLeft <= 0) return t("unlockOpened");

  const day = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hour = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  if (day > 0) return `${day}d ${hour}h`;
  return `${hour}h`;
};

export default function StoryDetailClient() {
  const t = useTranslations("StoryDetail");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ lang?: string; slug: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const slug = params?.slug;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [siteSocial, setSiteSocial] = useState<Record<string, string | null> | null>(null);
  const [recommendedStories, setRecommendedStories] = useState<StoryDetail[]>([]);
  const [newStories, setNewStories] = useState<StoryDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const fetchDetail = async () => {
      try {
        const response = await apiClient.get<StoryDetail>(`/stories/${slug}`);
        setStory(response.data);
        // fetch site social links (public)
        try {
          const siteRes = await apiClient.get('/settings/site');
          setSiteSocial(siteRes.data);
        } catch (e) {
          setSiteSocial(null);
        }
        // fetch recommended stories
        try {
          const recommendedRes = await apiClient.get<{ data: StoryDetail[] }>('/stories/recommended', {
            params: {
              limit: 6,
              lang: locale,
            },
          });
          setRecommendedStories(recommendedRes.data.data || []);
        } catch (e) {
          setRecommendedStories([]);
        }
        // fetch new stories
        try {
          const newRes = await apiClient.get<{ data: StoryDetail[] }>('/stories/explore', {
            params: {
              sort: 'latest',
              page: 1,
              limit: 6,
              lang: locale,
            },
          });
          setNewStories(newRes.data.data || []);
        } catch (e) {
          setNewStories([]);
        }
      } catch (error) {
        console.error("Error while loading chapter list:", error);
        setStory(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [slug]);

  const firstChapter = useMemo(() => story?.chapters?.[0] || null, [story?.chapters]);
  useViewTracking({
    storyId: story?.id,
    chapterId: firstChapter?.id || null,
  });

  const storyTitle = getLocalizedValue(locale, story?.titleVi, story?.titleEn, story?.title);
  const storyDescription = getLocalizedValue(locale, story?.descriptionVi, story?.descriptionEn, story?.description);
  const hasEn = Boolean(story?.titleEn?.trim() && story?.descriptionEn?.trim());
  const hasVi = Boolean(story?.titleVi?.trim() && story?.descriptionVi?.trim());

  const handleSwitchLanguage = (nextLocale: "vi" | "en") => {
    if (nextLocale === currentLang) return;

    const normalizedPath = (pathname || "/").replace(`/${currentLang}`, "") || "/";
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;
    router.push(`/${nextLocale}${normalizedPath === "/" ? "" : normalizedPath}`);
    router.refresh();
  };

  const onShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: storyTitle,
          text: t("sharePrompt"),
          url,
        });
        return;
      } catch {
        // ignore canceled share
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return;
    }

    window.prompt(t("copiedLink"), url);
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading")}</p>;
  }

  if (!story) {
    return <p className="text-sm text-red-600">{t("notFound")}</p>;
  }

  return (
    <div className="space-y-2 md:space-y-3">
      <section className="flex w-full flex-col items-start gap-3 rounded-xl p-3 sm:p-4 md:flex-row md:items-stretch md:gap-6 md:p-6">
        {/* Thumbnail - proper 2:3 book cover ratio */}
        <div className="w-full md:w-[155px] lg:w-[175px] md:shrink-0 self-center md:self-end">
          <div className="relative w-[140px] md:w-full mx-auto overflow-hidden rounded-lg shadow-xl" style={{ aspectRatio: "2/3" }}>
            <Image
              src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
              alt={storyTitle}
              fill
              priority
              className="object-cover"
            />
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col gap-2 md:gap-3">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">{storyTitle}</h1>

          {/* Metadata grid - centered layout */}
          <div className="flex flex-col gap-y-2 text-sm max-w-md">
            {/* Row 1: Tác giả + Trạng thái */}
            <div className="flex justify-between items-start">
              <div className="text-left">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("author")}</p>
                <p className="font-semibold text-gray-900 dark:text-white">{story.author?.name || t("authorUpdating")}</p>
              </div>
              <div className="text-left w-40">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("status")}</p>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                  story.status === "completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400"
                }`}>
                  {story.status === "completed" ? t("statusCompleted") : t("statusOngoing")}
                </span>
                {story.isInteractive && (
                  <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 ml-1">
                    {t("interactiveStoryBadge")}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Cập nhật lần cuối + Ngôn ngữ */}
            <div className="flex justify-between items-start">
              <div className="text-left">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("lastUpdated")}</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(story.updatedAt)}</p>
              </div>
              <div className="text-left w-40">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("language")}</p>
                <p className="font-medium text-gray-900 dark:text-white">{t("languageCurrent")}</p>
              </div>
            </div>

            {/* Row 3: Độ tuổi */}
            <div className="text-left">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("ageRating")}</p>
              <p className="font-medium text-gray-900 dark:text-white">{t("ageRatingAll")}</p>
            </div>

            {/* Row 4 (bottom): Lượt đọc + Đánh giá */}
            <div className="flex items-center gap-4 pt-1 text-sm border-t border-gray-100 dark:border-gray-800">
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold text-gray-900 dark:text-white">{Number(story.averageRating).toFixed(1)}</span>
                {story.ratingCount > 0 && <span className="text-gray-500 dark:text-gray-400 text-xs">({story.ratingCount})</span>}
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <BookOpen className="h-4 w-4" />
                {t("totalChapters", { count: story.chapters.length })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <Headphones className="h-4 w-4" />
                {Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
              </span>
            </div>
          </div>

          {/* Action buttons - compact single row */}
          <div className="flex w-full flex-wrap items-center gap-2 mt-1">
            {firstChapter ? (
              <Link
                href={chapterHref(story.slug, firstChapter.chapterNumber)}
                className="flex items-center justify-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                {t("readNow")}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400 whitespace-nowrap"
              >
                <Clock3 className="h-3.5 w-3.5" />
                {t("chaptersPendingCta")}
              </button>
            )}

            <StoryUpdateSubscriptionButton
              storyId={story.id}
              className="px-4 py-2 text-sm"
              labelClassName="inline"
            />

            <FavoriteButton
              storyId={story.id}
              size="md"
              icon="heart"
              label={t("favoriteLabel")}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium shadow-sm transition-colors whitespace-nowrap border border-gray-200 dark:border-gray-700"
              activeClassName="bg-red-500 text-white hover:bg-red-600 border-red-500"
              inactiveClassName="bg-white text-black hover:bg-red-50 hover:text-red-600 dark:bg-gray-900 dark:text-white dark:hover:bg-red-900/20 dark:hover:text-red-300"
            />

            <button
              type="button"
              onClick={() => { void onShare(); }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border text-sm shadow-sm transition-colors border-gray-300 bg-white text-black hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-pink-800/60 dark:hover:bg-pink-900/20 dark:hover:text-pink-300 whitespace-nowrap"
              aria-label={t("share")}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{t("share")}</span>
            </button>

            {(hasVi || hasEn) ? (
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <select
                  value={currentLang}
                  onChange={(event) => handleSwitchLanguage(event.target.value as "vi" | "en")}
                  className="appearance-none rounded-full border border-gray-300 bg-white py-2 pl-8 pr-7 text-sm font-medium text-gray-700 shadow-sm transition focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  aria-label={t("languageSwitcherLabel")}
                >
                  {hasVi ? <option value="vi">{t("languageOptionVi")}</option> : null}
                  {hasEn ? <option value="en">{t("languageOptionEn")}</option> : null}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            ) : null}

            {siteSocial?.facebook_url ? (
              <a
                href={siteSocial.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-pink-200 bg-pink-50 text-pink-700 shadow-sm transition-colors hover:bg-pink-100 dark:border-pink-800/60 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/40"
                aria-label={t("joinFacebook")}
                title={t("joinFacebook")}
              >
                <Facebook className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="p-3 sm:p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("introTitle")}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">
          {storyDescription || t("introUpdating")}
        </p>
      </section>

      {/* Tags Section */}
      {story.categories.length > 0 && (
        <section className="p-3 sm:p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {story.categories.map(({ category }) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="inline-flex items-center px-3 py-1.5 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/30 font-medium text-sm transition-colors"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories section moved into metadata grid above */}
      <section className="p-3 sm:p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <ListMusic className="h-5 w-5" /> {t("chapterList")}
          </h2>
          <span className="text-sm text-gray-500">{t("totalChapters", { count: story.chapters.length })}</span>
        </div>

        {story.chapters.length === 0 ? (
          <div className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900">
            <p className="font-semibold">{t("chaptersPendingTitle")}</p>
            <p className="mt-1">{t("chaptersPendingBody", { language: locale === "en" ? t("languageEn") : t("languageVi") })}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {story.chapters.map((chapter) => {
            const unlockLabel = getUnlockLabel(chapter, t);
            return (
              <Link
                key={chapter.id}
                href={chapterHref(story.slug, chapter.chapterNumber)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <PlayCircle className="h-5 w-5 text-pink-600 flex-shrink-0" />

                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t("chapterTitle", {
                      number: chapter.chapterNumber,
                      title: cleanChapterTitle(getLocalizedValue(locale, chapter.titleVi, chapter.titleEn, chapter.title)),
                    })}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {t("readListen")}</span>
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {formatDuration(chapter.audioDuration)}</span>
                    {unlockLabel ? <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300"><Lock className="h-3.5 w-3.5" /> {unlockLabel}</span> : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      {/* Recommended Stories Section */}
      {recommendedStories.length > 0 && (
        <section className="rounded-2xl p-3 sm:p-4 md:p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">{t("youMightLike")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {recommendedStories.map((recommendedStory) => {
              const title = getLocalizedValue(locale, recommendedStory.titleVi, recommendedStory.titleEn, recommendedStory.title);
              return (
                <Link
                  key={recommendedStory.id}
                  href={`/story/${recommendedStory.slug}`}
                  className="group flex flex-col gap-2"
                >
                  <div className="relative w-full overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow" style={{ aspectRatio: "2/3" }}>
                    <Image
                      src={recommendedStory.thumbnailUrl || "https://placehold.co/200x300?text=No+Cover"}
                      alt={title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {recommendedStory.isInteractive && (
                      <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        <Zap className="h-3 w-3 inline" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                      {title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {recommendedStory.author?.name || t("authorUpdating")}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                      <span>{Number(recommendedStory.averageRating).toFixed(1)}</span>
                      <span className="mx-1">•</span>
                      <Headphones className="h-3 w-3" />
                      <span>{Number(recommendedStory.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      {/* New Arrivals Section */}
      {newStories.length > 0 && (
        <section className="rounded-2xlp-3 sm:p-4 md:p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">{t("newArrivals")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {newStories.map((newStory) => {
              const title = getLocalizedValue(locale, newStory.titleVi, newStory.titleEn, newStory.title);
              return (
                <Link
                  key={newStory.id}
                  href={`/story/${newStory.slug}`}
                  className="group flex flex-col gap-2"
                >
                  <div className="relative w-full overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow" style={{ aspectRatio: "2/3" }}>
                    <Image
                      src={newStory.thumbnailUrl || "https://placehold.co/200x300?text=No+Cover"}
                      alt={title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {newStory.isInteractive && (
                      <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        <Zap className="h-3 w-3 inline" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                      {title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {newStory.author?.name || t("authorUpdating")}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                      <span>{Number(newStory.averageRating).toFixed(1)}</span>
                      <span className="mx-1">•</span>
                      <Headphones className="h-3 w-3" />
                      <span>{Number(newStory.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
