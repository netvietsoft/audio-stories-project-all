"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

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
  author?: { id?: string; name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type PopularStoriesGridProps = {
  stories: StoryItem[];
  isLoading?: boolean;
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[220px] animate-pulse rounded-2xl bg-white/70 dark:bg-slate-900/70" />
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            className="group flex min-h-[220px] gap-3 rounded-2xl bg-white/85 p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/85"
          >
            <div className="relative w-[108px] shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 sm:w-[116px] xl:w-[124px]">
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
                {excerpt || t("updating")}
              </p>

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm text-slate-500 dark:text-slate-400">
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