"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
// using native <img> to preserve original aspect ratio without cropping
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
    <div className="space-y-4 md:space-y-6">
      <section className="flex w-full flex-col items-start gap-3 rounded-xl bg-white p-3 sm:p-4 dark:bg-gray-900 md:flex-row md:items-stretch md:gap-6 md:p-6 md:max-h-[320px]">
        <div className="w-full shrink-0 flex justify-center md:w-[220px] lg:w-[260px] md:flex-shrink-0 md:self-stretch rounded-[10px] overflow-hidden">
          <img
            src={story.thumbnailUrl || "https://placehold.co/600x600?text=No+Cover"}
            alt={storyTitle}
            className="w-auto md:h-full object-contain md:object-bottom rounded-[10px]"
          />
        </div>

        <div className="flex w-full flex-1 flex-col gap-2 md:gap-3">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">{storyTitle}</h1>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("genre")}</p>
              <div className="flex flex-wrap gap-1">
                {story.categories.length > 0
                  ? story.categories.map(({ category }) => (
                      <Link
                        key={category.id}
                        href={`/categories/${category.slug}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        {category.name}
                      </Link>
                    ))
                  : <span className="text-gray-700 dark:text-gray-300 font-medium">—</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("lastUpdated")}</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(story.updatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("author")}</p>
              <p className="font-semibold text-gray-900 dark:text-white">{story.author?.name || t("authorUpdating")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("status")}</p>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                story.status === "completed"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
              }`}>
                {story.status === "completed" ? t("statusCompleted") : t("statusOngoing")}
              </span>
              {story.isInteractive && (
                <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                  {t("interactiveStoryBadge")}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("language")}</p>
              <p className="font-medium text-gray-900 dark:text-white">{t("languageCurrent")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("genre")}</p>
              <div className="flex flex-wrap gap-2">
                {story.categories.length > 0 ? (
                  story.categories.map(({ category }) => (
                    <span key={category.id} className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      {category.name}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-700 dark:text-gray-300 font-medium">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 py-2 rounded-xl bg-white/80 px-3 dark:bg-gray-950/50 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span className="font-semibold text-gray-900 dark:text-white">{Number(story.averageRating).toFixed(1)}</span>
              {story.ratingCount > 0 && <span className="text-gray-500 dark:text-gray-400">({story.ratingCount})</span>}
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <BookOpen className="h-4 w-4" />
              {t("totalChapters", { count: story.chapters.length })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <Headphones className="h-4 w-4" />
              {t("listens", { count: Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN") })}
            </span>
          </div>

          {/* Action buttons - single horizontal row on larger screens */}
          <div className="flex w-full items-center gap-3 mt-auto">
            <div className="flex gap-3 flex-1 flex-wrap md:flex-nowrap">
              {firstChapter ? (
                <Link
                  href={chapterHref(story.slug, firstChapter.chapterNumber)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium transition-colors w-full md:flex-[2] whitespace-nowrap text-sm"
                >
                  <Play className="h-3.5 w-3.5" />
                  {t("listenFromFirst")}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 rounded-full bg-gray-200 px-4 py-2 font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400 w-full md:flex-[2]"
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {t("chaptersPendingCta")}
                </button>
              )}

              <FavoriteButton
                storyId={story.id}
                size="md"
                icon="heart"
                label={t("favorite")}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium shadow-sm transition-colors w-full md:flex-1"
                labelClassName="whitespace-nowrap text-sm"
                activeClassName="bg-red-500 text-white hover:bg-red-600"
                inactiveClassName="bg-white text-black hover:bg-red-50 hover:text-red-600 dark:bg-gray-900 dark:text-white dark:hover:bg-red-900/20 dark:hover:text-red-300"
              />

              <StoryUpdateSubscriptionButton storyId={story.id} className="flex items-center justify-center gap-2 px-4 py-2 rounded-full w-full md:flex-1" labelClassName="whitespace-nowrap text-sm" />

              <button
                type="button"
                onClick={() => {
                  void onShare();
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-full w-full md:flex-1 border shadow-sm transition-colors border-gray-300 bg-white text-black hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-blue-800/60 dark:hover:bg-blue-900/20 dark:hover:text-blue-300 whitespace-nowrap text-sm"
              >
                <Share2 className="h-3.5 w-3.5" />
                {t("share")}
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {(hasVi || hasEn) ? (
                <div className="relative w-full sm:w-auto sm:min-w-[140px]">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                  <select
                    value={currentLang}
                    onChange={(event) => handleSwitchLanguage(event.target.value as "vi" | "en")}
                    className="appearance-none w-full rounded-full border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm font-medium text-gray-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    aria-label={t("languageSwitcherLabel")}
                  >
                    {hasVi ? <option value="vi">{t("languageOptionVi")}</option> : null}
                    {hasEn ? <option value="en">{t("languageOptionEn")}</option> : null}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              ) : null}

              {siteSocial?.facebook_url ? (
                <a
                  href={siteSocial.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition-colors hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                  aria-label={t("joinFacebook")}
                  title={t("joinFacebook")}
                >
                  <Facebook className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("introTitle")}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">
          {storyDescription || t("introUpdating")}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900">
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
                <PlayCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />

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
    </div>
  );
}
