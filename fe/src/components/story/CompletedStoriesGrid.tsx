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
  tone?: "default" | "pink";
};

const formatRating = (rating?: number | string) => {
  const num = Number(rating || 0);
  return Number.isFinite(num) && num > 0 ? num.toFixed(1) : "N/A";
};

export default function CompletedStoriesGrid({ stories, isLoading = false, tone = "default" }: CompletedStoriesGridProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const isPinkTone = tone === "pink";
  const emptyMessage = locale === "en" ? "No stories available." : "Chưa có truyện để hiển thị.";

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-1 md:gap-x-4 md:gap-y-1">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  const displayStories = stories.slice(0, 12);

  if (!displayStories.length) {
    return (
      <div className={`rounded-2xl p-6 text-sm ${isPinkTone ? "bg-pink-50/50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400" : "bg-white/80 text-slate-500 dark:bg-slate-900/70 dark:text-slate-400"}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-1 md:gap-x-4 md:gap-y-1">
      {displayStories.map((story, index) => {
        const title = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
        const categoryName = story.categories?.[0]?.category?.name;
        const rating = formatRating(story.averageRating);
        const viewsLabel = Number(story.totalViews || 0).toLocaleString(lang === "en" ? "en-US" : "vi-VN");

        // show first 6 on mobile (3x2), show up to 12 on md+ (6x2)
        const visibilityClass = index >= 12 ? "hidden" : index >= 6 ? "hidden md:block" : "";

        return (
          <div key={story.id} className={`${visibilityClass} group`}>
            <Link
              href={`/story/${story.slug}`}
              className={`block overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isPinkTone ? "bg-pink-50/50 dark:bg-slate-800/50" : "bg-slate-900/95 ring-1 ring-slate-800/60"}`}
            >
              <div className="relative">
                <Image
                  src={story.thumbnailUrl || "/thumbnaildefault.jpg"}
                  alt={title}
                  width={128}
                  height={192}
                  loading="lazy"
                  sizes="(max-width: 640px) 30vw, (max-width: 768px) 20vw, (max-width: 1024px) 15vw, 11vw"
                  className="aspect-[5/7] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <FavoriteButton
                  storyId={story.id}
                  className="absolute right-2 top-2 z-10 rounded-full bg-black/45 p-1.5 text-white shadow-sm backdrop-blur-sm hover:bg-black/65 hover:text-red-400"
                />
              </div>
            </Link>

            <div className="mt-1 px-1">
              <Link href={`/story/${story.slug}`}>
                <h3 className="line-clamp-2 text-sm font-bold leading-tight text-gray-900 hover:text-pink-600 dark:text-white dark:hover:text-pink-400">
                  {title}
                </h3>
              </Link>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{story.author?.name || t("updating")}</p>
              {categoryName ? (
                <p className="mt-0.5 text-xs text-pink-600 dark:text-pink-400">{categoryName}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
