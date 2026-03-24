"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Eye, Star } from "lucide-react";

import Link from "@/components/shared/LocalizedLink";
import { getLocalizedValue } from "@/lib/story-localization";
import FavoriteButton from "@/components/shared/FavoriteButton";

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

type CompletedStoriesGridProps = {
  stories: StoryItem[];
  isLoading?: boolean;
};

const formatRating = (rating?: number | string) => {
  const num = Number(rating || 0);
  return Number.isFinite(num) && num > 0 ? num.toFixed(1) : "N/A";
};

export default function CompletedStoriesGrid({ stories, isLoading = false }: CompletedStoriesGridProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const emptyMessage = locale === "en" ? "No stories available." : "Chưa có truyện để hiển thị.";

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      {displayStories.map((story) => {
        const title = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
        const categoryName = story.categories?.[0]?.category?.name;
        const rating = formatRating(story.averageRating);
        const viewsLabel = Number(story.totalViews || 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN");

        return (
          <Link
            key={story.id}
            href={`/story/${story.slug}`}
            className="group block overflow-hidden rounded-2xl bg-slate-900/95 shadow-sm ring-1 ring-slate-800/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative">
              <Image
                src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
                alt={title}
                width={320}
                height={320}
                sizes="(max-width: 640px) 48vw, (max-width: 768px) 32vw, (max-width: 1024px) 24vw, 18vw"
                className="aspect-[2/3] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

              <div className="absolute left-2 top-2 flex flex-col gap-1">
                <span className="inline-flex rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {t("full")}
                </span>
                {categoryName ? (
                  <span className="inline-flex rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {categoryName}
                  </span>
                ) : null}
              </div>

              <FavoriteButton
                storyId={story.id}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/45 p-1.5 text-white shadow-sm backdrop-blur-sm hover:bg-black/65 hover:text-red-400"
              />

              <div className="absolute inset-x-0 bottom-0 p-2.5 text-white sm:p-3">
                <h3 className="line-clamp-1 truncate text-sm font-extrabold leading-tight">{title}</h3>
                <p className="mt-0.5 line-clamp-1 text-xs text-white/85">{story.author?.name || t("updating")}</p>

                <div className="mt-1.5 flex items-center justify-between gap-2 text-sm font-semibold sm:text-base">
                  <div className="flex items-center gap-1 text-amber-300">
                    <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" />
                    <span>{rating}</span>
                  </div>

                  <div className="flex items-center gap-1 text-white/90">
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{viewsLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
