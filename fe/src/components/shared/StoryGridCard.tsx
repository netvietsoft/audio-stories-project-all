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
  highligt?: {
    type: "views" | "rating" | "updated" | "branches" | "none";
    label?: string;
    value?: string | number;
  };
};

export default function StoryGridCard({ story, highligt }: StoryGridCardProps) {
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
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200";

  const rating = Number(story.averageRating || 0).toFixed(1);
  const viewsLabel = Number(story.totalViews || 0).toLocaleString(
    locale === "en" ? "en-US" : "vi-VN"
  );
  const categoryName = story.categories?.[0]?.category?.name;

  const formatTimeAgo = (dateString?: string | null) => {
    if (!dateString) return locale === "en" ? "Just now" : "Vừa xong";

    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    if (!Number.isFinite(diffInMs) || diffInMs < 0)
      return locale === "en" ? "Just now" : "Vừa xong";

    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours < 1) return locale === "en" ? "Just now" : "Vừa xong";
    if (diffInHours < 24)
      return locale === "en"
        ? `${diffInHours}h ago`
        : `${diffInHours} giờ trước`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7)
      return locale === "en" ? `${diffInDays}d ago` : `${diffInDays} ngày trước`;

    return date.toLocaleDateString(
      locale === "en" ? "en-US" : "vi-VN"
    );
  };

  return (
    <Link
      href={`/story/${story.slug}`}
      className="group flex gap-4 rounded-2xl border border-slate-200 p-4 transition-all duration-300 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:hover:border-blue-500 dark:hover:shadow-blue-900/20"
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
      <div className="min-w-0 flex-1">
        {/* Title */}
        <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 sm:text-lg">
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Rating */}
          <div className="flex items-center gap-1 text-xs sm:text-sm">
            <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">
              {rating}
            </span>
          </div>

          {/* Views */}
          <div className="flex items-center gap-1 text-xs sm:text-sm">
            <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400">
              {viewsLabel}
            </span>
          </div>

          {/* Status Badge */}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>

          {/* Highlight based on type */}
          {highligt && highligt.type !== "none" && (
            <div className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              <span className="text-lg leading-none">✨</span>
              <span>
                {highligt.label}: {highligt.value}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Favorite Button */}
      <FavoriteButton
        storyId={story.id}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow-md hover:bg-red-50 hover:text-red-500 transition-colors dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-400"
      />
    </Link>
  );
}
