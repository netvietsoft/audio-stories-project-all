"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Star } from "lucide-react";

import Link from "@/components/shared/LocalizedLink";
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
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  author?: { id?: string; name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type PopularStoriesGridProps = {
  stories: StoryItem[];
  isLoading?: boolean;
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const formatRating = (rating?: number | string) => {
  const num = Number(rating || 0);
  return Number.isFinite(num) && num > 0 ? num.toFixed(1) : "N/A";
};

export default function PopularStoriesGrid({ stories, isLoading = false }: PopularStoriesGridProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const viewsSuffix = locale === "en" ? "views" : "lượt đọc";
  const emptyMessage = locale === "en" ? "No stories available." : "Chưa có truyện để hiển thị.";

  const formatViews = (views: number) => {
    return new Intl.NumberFormat("en-US").format(views || 0);
  };

    if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[180px] animate-pulse rounded-xl bg-white/70 dark:bg-slate-900/70 sm:h-[200px]" />
        ))}
      </div>
    );
  }

  const displayStories = stories.slice(0, 8);

  if (!displayStories.length) {
    return (
      <div className="rounded-2xl bg-white/80 p-6 text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
      {displayStories.map((story) => {
        const title = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
        const description = getLocalizedValue(locale, story.descriptionVi, story.descriptionEn, story.description || "");
        const excerpt = stripHtml(description);
        const categoryName = story.categories?.[0]?.category?.name;
        const statusLabel = story.status === "completed" ? t("full") : t("ongoing");

        return (
            <Link
            key={story.id}
            href={`/story/${story.slug}`}
            className="group flex min-h-[180px] flex-col gap-y-1 rounded-xl bg-white/85 p-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/85 sm:gap-y-1 sm:p-2"
          >
            <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 sm:h-32">
              <Image
                src={story.thumbnailUrl || "/thumbnaildefault.jpg"}
                alt={title}
                width={120}
                height={180}
                loading="lazy"
                className="aspect-[2/3] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <div className="min-w-0 flex flex-1 flex-col">
              <h3 className="line-clamp-2 text-xs font-extrabold leading-tight text-slate-900 transition-colors group-hover:text-pink-700 dark:text-white dark:group-hover:text-pink-300 sm:text-sm">
                {title}
              </h3>

              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                <span className="text-pink-600 dark:text-pink-400">{categoryName || t("updating")}</span>
                <span className="mx-1">·</span>
                <span>{story.author?.name || t("updating")}</span>
              </p>

              <p className="mt-1 line-clamp-2 text-xs text-slate-700 dark:text-slate-300 sm:line-clamp-3 sm:text-sm">
                {excerpt || t("updating")}
              </p>

              <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-2 sm:gap-x-3 sm:gap-y-2 sm:pt-3">
                {/* Rating with stars */}
                <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-1.5 py-1 dark:bg-amber-900/30 sm:gap-1.5 sm:px-2.5 sm:py-1.5">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500 sm:h-4 sm:w-4" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 sm:text-sm">{formatRating(story.averageRating)}</span>
                </div>

                <span className="text-xs text-slate-500 dark:text-slate-400 sm:text-xs">{formatViews(story.totalViews)} {viewsSuffix}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 sm:text-xs">{statusLabel}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}