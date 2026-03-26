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

type HighRatingStoriesGridProps = {
  stories: StoryItem[];
  isLoading?: boolean;
};

const formatRating = (rating?: number | string) => {
  const num = Number(rating || 0);
  return Number.isFinite(num) && num > 0 ? num.toFixed(1) : "N/A";
};

export default function HighRatingStoriesGrid({ stories, isLoading = false }: HighRatingStoriesGridProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const viewsSuffix = locale === "en" ? "views" : "lượt đọc";
  const emptyMessage = locale === "en" ? "No stories available." : "Chưa có truyện để hiển thị.";

  const formatViews = (views: number) => new Intl.NumberFormat("en-US").format(views || 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[220px] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  const displayStories = stories.slice(0, 6);

  if (!displayStories.length) {
    return (
      <div className="rounded-2xl bg-white/80 p-6 text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:grid-cols-3">
      {displayStories.map((story) => {
        const title = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
        const description = getLocalizedValue(locale, story.descriptionVi, story.descriptionEn, story.description || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const categoryName = story.categories?.[0]?.category?.name;
        const statusLabel = story.status === "completed" ? t("full") : t("ongoing");
        const rating = formatRating(story.averageRating);

        return (
          <Link
            key={story.id}
            href={`/story/${story.slug}`}
            className="group flex min-h-[220px] gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="relative w-[108px] shrink-0 overflow-hidden rounded-lg sm:w-[116px] xl:w-[124px]">
              <Image
                src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
                alt={title}
                width={176}
                height={264}
                className="aspect-[2/3] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <div className="min-w-0 flex flex-1 flex-col">
              <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300 xl:text-lg">
                {title}
              </h3>

              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400 xl:text-sm">
                <span className="text-pink-600 dark:text-pink-400">{categoryName || t("updating")}</span>
                <span className="mx-1">·</span>
                <span>{story.author?.name || t("updating")}</span>
              </p>

              <p className="mt-2 line-clamp-4 text-sm text-slate-700 dark:text-slate-300">
                {description || t("updating")}
              </p>

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-300">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  {rating}
                </span>
                <span>{formatViews(story.totalViews)} {viewsSuffix}</span>
                <span>{statusLabel}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
