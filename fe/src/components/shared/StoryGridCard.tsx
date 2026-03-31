"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Star, Eye } from "lucide-react";

import Link from "@/components/shared/LocalizedLink";
import FavoriteButton from "@/components/shared/FavoriteButton";
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
  createdAt?: string;
  updatedAt?: string;
  latestChapterTitle?: string | null;
  latestChapterNumber?: number | null;
  author?: { name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type StoryGridCardProps = {
  story: StoryItem;
  highlightMode?: "new" | "trending" | "interactive" | "default";
  highlightValue?: string | number;
};

export default function StoryGridCard({
  story,
  highlightMode = "default",
  highlightValue,
}: StoryGridCardProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();

  const localizedTitle = getLocalizedValue(
    locale,
    story.titleVi,
    story.titleEn,
    story.title
  );
  const localizedDescription = getLocalizedValue(
    locale,
    story.descriptionVi,
    story.descriptionEn,
    story.description || ""
  );
  const shortDescription = localizedDescription
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  const statusLabel =
    story.status === "completed"
      ? locale === "en"
        ? "Full"
        : "Full"
      : locale === "en"
        ? "Ongoing"
        : "Đang ra";
  const statusClass =
    story.status === "completed"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
      : "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-200";

  const rating = Number(story.averageRating || 0).toFixed(1);
  const viewsLabel = Number(story.totalViews || 0).toLocaleString(
    locale === "en" ? "en-US" : "vi-VN"
  );
  const categoryName = story.categories?.[0]?.category?.name;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return locale === "en" ? "N/A" : "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return locale === "en" ? "N/A" : "N/A";
    return date.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN");
  };

  const resolvedHighlight = (() => {
    if (highlightMode === "new") {
      return {
        label: locale === "en" ? "Last Updated" : "Cập nhật",
        value: formatDate(story.updatedAt || story.createdAt),
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      };
    }

    if (highlightMode === "trending") {
      return {
        label: locale === "en" ? "Views" : "Lượt xem",
        value: viewsLabel,
        className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
      };
    }

    if (highlightMode === "interactive") {
      return {
        label: locale === "en" ? "Branches" : "Diễn biến",
        value: highlightValue ?? "?",
        className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
      };
    }

    return null;
  })();

  return (
    <Link
      href={`/story/${story.slug}`}
      className="group relative flex items-stretch gap-4 rounded-2xl border border-slate-200 p-4 transition-all duration-300 hover:border-pink-300 hover:shadow-md dark:border-slate-800 dark:hover:border-pink-500 dark:hover:shadow-pink-900/20"
    >
      {/* Thumbnail - Small Left Side */}
      <div className="relative w-24 shrink-0 overflow-hidden rounded-lg sm:w-28">
        <Image
          src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
          alt={localizedTitle}
          width={112}
          height={168}
          className="aspect-[2/3] h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content - Right Side */}
      <div className="min-w-0 flex flex-1 flex-col h-full">
        {/* Title */}
        <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-slate-900 transition-colors group-hover:text-pink-600 dark:text-white dark:group-hover:text-pink-400 sm:text-lg">
          {localizedTitle}
        </h3>

        {/* Author & Category */}
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {story.author?.name || t("updating")}
          </span>
          <span>·</span>
          <span className="text-pink-600 dark:text-pink-400">
            {categoryName || t("updating")}
          </span>
        </div>

        {/* Description */}
        <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
          {shortDescription || t("nodesc")}
        </p>

        {/* Stats & Highlight */}
        <div className="mt-auto pt-4 flex flex-wrap items-center gap-3">
          {/* Rating */}
          <div className="flex items-center gap-1 text-xs sm:text-sm">
            <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">
              {rating}
            </span>
          </div>

          {/* Views */}
          {highlightMode !== "trending" && (
            <div className="flex items-center gap-1 text-xs sm:text-sm">
              <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-slate-600 dark:text-slate-400">{viewsLabel}</span>
            </div>
          )}

          {/* Status Badge */}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>

          {/* Highlight based on type */}
          {resolvedHighlight && (
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${resolvedHighlight.className}`}>
              <span>
                {resolvedHighlight.label}: {resolvedHighlight.value}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Favorite Button */}
      <FavoriteButton
        storyId={story.id}
        className="absolute right-4 top-4 z-10 border border-slate-200/80 shadow-md dark:border-slate-700/80"
        inactiveClassName="bg-white/95 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        activeClassName="bg-rose-100 text-rose-600 hover:bg-rose-200 hover:text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/70 dark:hover:text-rose-200"
      />
    </Link>
  );
}

