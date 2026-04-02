"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { BookOpenText, Eye, GitBranch, Star } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper/types";
import "swiper/css";

import Link from "@/components/shared/LocalizedLink";
import { apiClient } from "@/lib/api/api-client";
import { getLocalizedValue } from "@/lib/story-localization";

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
  totalViews: number;
  averageRating?: number | string;
  totalChapters?: number;
  author?: { id?: string; name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type ExploreResponse = {
  data: StoryItem[];
};

type StoryDetailResponse = {
  chapters?: Array<{ id: string; variants?: Array<{ id: string }> }>;
  totalChapters?: number;
};

const formatRating = (rating?: number | string) => {
  const num = Number(rating || 0);
  if (!Number.isFinite(num) || num <= 0) return "N/A";
  return num.toFixed(1);
};

const getChapterCount = (story: StoryItem) => {
  const count = Number(story.totalChapters || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const getBranchCount = (story: StoryItem & { totalBranches?: number }) => {
  const count = Number(story.totalBranches || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

export default function InteractiveStoriesSection() {
  const t = useTranslations("Home");
  const tStory = useTranslations("StoryDetail");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const swiperRef = useRef<SwiperInstance | null>(null);

  useEffect(() => {
    const loadStories = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<ExploreResponse>("/stories/explore", {
          params: {
            lang,
            sort: "views",
            isInteractive: true,
            limit: 5,
          },
        });

        const unique = Array.from(
          new Map((response.data?.data || []).map((story) => [story.id, story])).values(),
        );

        const sorted = unique
          .sort((a, b) => {
            const byViews = Number(b.totalViews || 0) - Number(a.totalViews || 0);
            if (byViews !== 0) return byViews;
            return Number(b.averageRating || 0) - Number(a.averageRating || 0);
          })
          .slice(0, 5);

        const detailResults = await Promise.allSettled(
          sorted.map((story) => apiClient.get<StoryDetailResponse>(`/stories/${story.slug}`)),
        );

        const withChapterCount = sorted.map((story, index) => {
          const detail = detailResults[index];
          if (detail?.status !== "fulfilled") return story;

          const payload = detail.value.data;
          const chapterCount = Number(payload?.totalChapters || payload?.chapters?.length || 0);
          const branchCount = Array.isArray(payload?.chapters)
            ? payload.chapters.reduce((sum, chapter) => sum + (chapter?.variants?.length || 0), 0)
            : 0;

          return {
            ...story,
            totalChapters: Number.isFinite(chapterCount) ? chapterCount : story.totalChapters,
            totalBranches: Number.isFinite(branchCount) ? branchCount : 0,
          };
        });

        setStories(withChapterCount);
        setActiveIndex(0);
      } catch (error) {
        console.error("Failed to load interactive stories section", error);
        setStories([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadStories();
  }, [lang]);

  const activeStory = useMemo(() => stories[activeIndex] || stories[0], [activeIndex, stories]);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 lg:grid-cols-2 lg:gap-x-4 lg:gap-y-2">
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="aspect-[2/3] w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          </div>
          <div className="aspect-[3/2] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800 lg:aspect-auto" />
        </div>
      </section>
    );
  }

  if (!stories.length) return null;

  return (
    <section className="relative left-1/2 w-dvw -translate-x-1/2 bg-slate-200/70 py-10 dark:bg-slate-800/70">
      <div className="mx-auto w-full space-y-3 px-3 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw]">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("interactiveSectionTitle")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("interactiveSectionSubtitle")}</p>
          </div>
          <Link
            href="/interactive"
            className="shrink-0 text-sm font-extrabold text-pink-600 transition-colors hover:text-pink-500 whitespace-nowrap"
          >
            {t("viewAll")}
          </Link>
        </div>

        <div className="hidden lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-8">
          <div className="lg:col-span-8 flex min-h-[560px] flex-col justify-between">
            {activeStory ? (
              <>
              {/* KHỐI TRÊN: Thông tin (mb-auto đẩy khối dưới xuống đáy) */}
              <div className="mb-auto pb-6">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/story/${activeStory.slug}`}
                    className="line-clamp-2 text-3xl font-black leading-tight text-slate-900 transition-colors hover:text-pink-700 dark:text-white dark:hover:text-pink-300"
                  >
                    {getLocalizedValue(locale, activeStory.titleVi, activeStory.titleEn, activeStory.title)}
                  </Link>
                  <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
                    - {activeStory.author?.name || tStory("authorUpdating")}
                  </span>
                </div>
                <div className="mb-4 mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {(activeStory.categories?.length ? activeStory.categories : [{ category: { id: 0, name: t("uncategorized"), slug: "uncategorized" } }]).map((item) => (
                    <span
                      key={item.category.id}
                      className="rounded-full bg-pink-50 px-2.5 py-1 font-semibold text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
                    >
                      #{item.category.name}
                    </span>
                  ))}
                </div>
                <p className="line-clamp-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {getLocalizedValue(
                    locale,
                    activeStory.descriptionVi,
                    activeStory.descriptionEn,
                    activeStory.description,
                  ) || t("storyIntroFallback")}
                </p>
                {/* Đã xóa nút Đọc ngay cũ ở đây */}
              </div>

              {/* KHỐI DƯỚI: Đính chặt vào đáy (mt-auto) */}
              <div className="mt-auto w-full">
                {/* KHU VỰC THỐNG KÊ & NÚT ĐỌC NGAY NẰM CÙNG HÀNG */}
                <div className="mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-y-1 lg:gap-x-4 lg:gap-y-0">
                  {/* 4 Ô Thống kê đã thu nhỏ */}
                  <div className="grid grid-cols-4 gap-x-4 gap-y-1 sm:gap-x-4 sm:gap-y-1 flex-1 w-full">
                    <div className="rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600 flex flex-col items-center justify-center">
                      <p className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-extrabold text-pink-700 dark:text-pink-300">
                        <BookOpenText className="h-3.5 w-3.5" />
                        {getChapterCount(activeStory).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}
                      </p>
                      <p className="mt-1 text-center text-[10px] sm:text-xs text-slate-500">{t("chaptersLabel")}</p>
                    </div>
                    <div className="rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600 flex flex-col items-center justify-center">
                      <p className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-extrabold text-pink-700 dark:text-pink-300">
                        <Eye className="h-3.5 w-3.5" />
                        {Number(activeStory.totalViews || 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}
                      </p>
                      <p className="mt-1 text-center text-[10px] sm:text-xs text-slate-500">{t("viewsLabel")}</p>
                    </div>
                    <div className="rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600 flex flex-col items-center justify-center">
                      <p className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-extrabold text-pink-700 dark:text-pink-300">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {formatRating(activeStory.averageRating)}
                      </p>
                      <p className="mt-1 text-center text-[10px] sm:text-xs text-slate-500">{t("ratingLabel")}</p>
                    </div>
                    <div className="rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600 flex flex-col items-center justify-center">
                      <p className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-extrabold text-pink-700 dark:text-pink-300">
                        <GitBranch className="h-3.5 w-3.5" />
                        {getBranchCount(activeStory)}
                      </p>
                      <p className="mt-1 text-center text-[10px] sm:text-xs text-slate-500">{t("branchesLabel")}</p>
                    </div>
                  </div>

                  {/* Nút Đọc ngay */}
                  <Link
                    href={`/story/${activeStory.slug}`}
                    className="shrink-0 inline-flex items-center justify-center rounded-2xl lg:rounded-full bg-pink-600 px-6 py-2 h-[48px] text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-pink-500 whitespace-nowrap"
                  >
                    {t("readNow")}
                  </Link>
                </div>

                {/* Lưới 5 thumbnail ở đáy */}
                <div className="grid grid-cols-5 gap-2">
                  {stories.map((story, index) => {
                    const title = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
                    const isActive = index === activeIndex;

                    return (
                      <button
                        key={story.id}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`group relative overflow-hidden rounded-xl ring-2 transition-all ${
                          isActive
                            ? "ring-red-500 shadow-lg"
                            : "ring-transparent hover:ring-red-300 hover:shadow-md"
                        }`}
                        aria-label={title}
                      >
                        <Image
                          src={story.thumbnailUrl || "/thumbnaildefault.jpg"}
                          alt={title}
                          width={170}
                          height={255}
                          loading="lazy"
                          className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              </>
            ) : null}
          </div>

          {activeStory ? (
            <div className="lg:col-span-4 h-full">
              <Link
                href={`/story/${activeStory.slug}`}
                aria-label={t("startInteraction")}
                className="relative block h-full min-h-[560px] w-full overflow-hidden rounded-2xl shadow-lg"
              >
                <Image
                  src={activeStory.thumbnailUrl || "/thumbnaildefault.jpg"}
                  alt={getLocalizedValue(locale, activeStory.titleVi, activeStory.titleEn, activeStory.title)}
                  width={780}
                  height={1040}
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="h-full w-full object-cover"
                />
              </Link>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 lg:hidden">
        {activeStory ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-baseline gap-2">
              <Link
                href={`/story/${activeStory.slug}`}
                className="line-clamp-2 text-xl font-extrabold text-slate-900 transition-colors hover:text-pink-700 dark:text-white dark:hover:text-pink-300"
              >
                {getLocalizedValue(locale, activeStory.titleVi, activeStory.titleEn, activeStory.title)}
              </Link>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">- {activeStory.author?.name || tStory("authorUpdating")}</span>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-300">
              {activeStory.categories?.[0]?.category?.name || t("uncategorized")}
            </p>
            <p className="mt-3 line-clamp-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {getLocalizedValue(
                locale,
                activeStory.descriptionVi,
                activeStory.descriptionEn,
                activeStory.description,
              ) || t("storyIntroFallback")}
            </p>
            <Link
              href={`/story/${activeStory.slug}`}
              className="mt-4 inline-flex items-center rounded-full bg-pink-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-pink-500"
            >
              {t("readNow")}
            </Link>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/90 px-2 py-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600">
                <p className="flex items-center justify-center gap-1.5 font-extrabold text-pink-700 dark:text-pink-300">
                  <BookOpenText className="h-3.5 w-3.5" />
                  {getChapterCount(activeStory).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}
                </p>
                <p className="mt-1 text-center text-slate-500">{t("chaptersLabel")}</p>
              </div>
              <div className="rounded-xl bg-white/90 px-2 py-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600">
                <p className="flex items-center justify-center gap-1.5 font-extrabold text-pink-700 dark:text-pink-300">
                  <Eye className="h-3.5 w-3.5" />
                  {Number(activeStory.totalViews || 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}
                </p>
                <p className="mt-1 text-center text-slate-500">{t("viewsLabel")}</p>
              </div>
              <div className="rounded-xl bg-white/90 px-2 py-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600">
                <p className="flex items-center justify-center gap-1.5 font-extrabold text-pink-700 dark:text-pink-300">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {formatRating(activeStory.averageRating)}
                </p>
                <p className="mt-1 text-center text-slate-500">{t("ratingLabel")}</p>
              </div>
              <div className="rounded-xl bg-white/90 px-2 py-2 shadow-sm ring-1 ring-pink-200 dark:bg-slate-800 dark:ring-slate-600">
                <p className="flex items-center justify-center gap-1.5 font-extrabold text-pink-700 dark:text-pink-300">
                  <GitBranch className="h-3.5 w-3.5" />
                  {getBranchCount(activeStory)}
                </p>
                <p className="mt-1 text-center text-slate-500">{t("branchesLabel")}</p>
              </div>
            </div>

          </div>
        ) : null}

        <div>
          <Swiper
            modules={[Autoplay]}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            onSlideChange={(swiper) => {
              setActiveIndex(swiper.realIndex);
            }}
            autoplay={{ delay: 3000, disableOnInteraction: false }}
            loop={stories.length > 1}
            spaceBetween={10}
            slidesPerView={3.1}
          >
            {stories.map((story) => {
              const title = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);

              return (
                <SwiperSlide key={story.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const index = stories.findIndex((item) => item.id === story.id);
                      if (index >= 0) {
                        swiperRef.current?.slideToLoop(index);
                        setActiveIndex(index);
                      }
                    }}
                    className="block w-full overflow-hidden rounded-xl"
                    aria-label={title}
                  >
                    <Image
                      src={story.thumbnailUrl || "/thumbnaildefault.jpg"}
                      alt={title}
                      width={220}
                      height={330}
                      loading="lazy"
                      className="aspect-[2/3] w-full rounded-xl object-cover"
                    />
                  </button>
                </SwiperSlide>
              );
            })}
          </Swiper>

          <div className="mt-3 flex items-center justify-center gap-2">
            {stories.map((story, index) => (
              <button
                key={story.id}
                type="button"
                onClick={() => {
                  swiperRef.current?.slideToLoop(index);
                  setActiveIndex(index);
                }}
                aria-label={`interactive-story-${index + 1}`}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeIndex ? "w-6 bg-pink-600" : "w-2.5 bg-slate-300 dark:bg-slate-600"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
