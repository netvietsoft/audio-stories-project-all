import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { Eye, Star } from "lucide-react";
import FavoriteButton from "@/components/shared/FavoriteButton";
import { getLocalizedValue } from "@/lib/story-localization";

type StoryCardStory = {
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
  latestChapterCreatedAt?: string | null;
  author?: {
    name: string;
  };
  categories?: Array<{
    category: {
      name: string;
      nameVi?: string | null;
      nameEn?: string | null;
    };
  }>;
};

type StoryCardProps = {
  story: StoryCardStory;
  className?: string;
  variant?: "default" | "newly-posted" | "featured" | "overlay";
};

export default function StoryCard({ story, className, variant = "default" }: StoryCardProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const statusLabel = story.status === "completed" ? t("full") : t("ongoing");
  const rating = Number(story.averageRating || 0).toFixed(1);
  const localizedTitle = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
  const localizedDescription = getLocalizedValue(locale, story.descriptionVi, story.descriptionEn, story.description || "");
  const shortDescription = localizedDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const formatTimeAgo = (dateString?: string | null) => {
    if (!dateString) return locale === "en" ? "Just now" : "Vừa xong";

    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    if (!Number.isFinite(diffInMs) || diffInMs < 0) return locale === "en" ? "Just now" : "Vừa xong";

    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours < 1) return locale === "en" ? "Just now" : "Vừa xong";
    if (diffInHours < 24) return locale === "en" ? `${diffInHours}h ago` : `${diffInHours} giờ trước`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return locale === "en" ? `${diffInDays}d ago` : `${diffInDays} ngày trước`;

    return date.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN");
  };

  const latestChapterLabel = (() => {
    const chapterNum = story.latestChapterNumber;
    const chapterTitle = story.latestChapterTitle;

    if (chapterNum && chapterTitle) return `Chương ${chapterNum}: ${chapterTitle}`;
    if (chapterNum) return `Chương ${chapterNum}`;
    if (chapterTitle) return chapterTitle;
    return locale === "en" ? "Latest chapter updating..." : "Chương mới đang cập nhật...";
  })();

  const viewsLabel = Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN");
  const statusClass =
    story.status === "completed"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200";

  if (variant === "overlay") {
    const firstCategory = story.categories?.[0]?.category?.name;

    return (
      <Link
        href={`/story/${story.slug}`}
        className={`group block overflow-hidden rounded-2xl bg-slate-900/95 shadow-sm ring-1 ring-slate-800/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${className || ""}`}
      >
        <div className="relative">
          <Image
            src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
            alt={localizedTitle}
            width={400}
            height={600}
            sizes="(max-width: 640px) 62vw, (max-width: 1024px) 31vw, 22vw"
            className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

          <div className="absolute left-2 top-2 flex flex-col gap-1">
            <span className="inline-flex rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              {statusLabel}
            </span>
            {firstCategory ? (
              <span className="inline-flex rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                {firstCategory}
              </span>
            ) : null}
          </div>

          <FavoriteButton
            storyId={story.id}
            className="absolute right-2 top-2 z-10 rounded-full bg-black/45 p-1.5 text-white shadow-sm backdrop-blur-sm hover:bg-black/65 hover:text-red-400"
          />

          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <h3 className="line-clamp-2 text-base font-extrabold leading-tight">{localizedTitle}</h3>
            <p className="mt-0.5 truncate text-sm text-white/85">{story.author?.name || t("updating")}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/85">
              {shortDescription || t("updating")}
            </p>

            <div className="mt-2 flex items-center justify-between gap-2 text-base font-semibold">
              <div className="flex items-center gap-1 text-amber-300">
                <Star className="h-4 w-4" fill="currentColor" />
                <span>{rating}</span>
              </div>

              <div className="flex items-center gap-1 text-white/90">
                <Eye className="h-4 w-4" />
                <span>{viewsLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "newly-posted") {
    return (
      <Link
        href={`/story/${story.slug}`}
        className={`block rounded-xl bg-gray-50 dark:bg-gray-900/60 p-2.5 group hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-300 ${className || ""}`}
      >
        <div className="relative overflow-hidden rounded-lg">
          <Image
            src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
            alt={localizedTitle}
            width={400}
            height={600}
            sizes="(max-width: 768px) 160px, 260px"
            className="aspect-[3/4] w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
            {statusLabel}
          </span>

          <FavoriteButton
            storyId={story.id}
            className="absolute right-2 top-2 z-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 hover:text-red-400 transition-colors pointer-events-auto"
          />
        </div>

        <h3 className="mt-3 line-clamp-1 text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{localizedTitle}</h3>

        <p className="line-clamp-1 text-xs text-slate-500 dark:text-gray-400">
          {story.author?.name || t("updating")}
        </p>

        <div className="mt-2 flex items-center justify-between bg-white/70 dark:bg-gray-900/70 rounded-lg px-2 py-2">
          <span className="line-clamp-1 text-sm font-medium text-blue-400">{latestChapterLabel}</span>
          <span className="ml-2 shrink-0 text-xs text-slate-400 dark:text-gray-500">
            {formatTimeAgo(story.latestChapterCreatedAt || story.updatedAt || story.createdAt)}
          </span>
        </div>
      </Link>
    );
  }

  const isFeatured = variant === "featured";

  return (
    <Link
      href={`/story/${story.slug}`}
      className={`group block rounded-2xl p-2 transition-all duration-300 hover:-translate-y-1 ${
        isFeatured
          ? "bg-amber-50/70 shadow-sm hover:shadow-lg hover:shadow-amber-100/60 dark:bg-slate-900/90 dark:hover:shadow-none"
          : "bg-white/90 shadow-sm hover:shadow-md dark:bg-gray-900/80"
      } ${className || ""}`}
    >
      <div className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        <Image
          src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
          alt={localizedTitle}
          width={400}
          height={600}
          sizes={isFeatured ? "(max-width: 768px) 180px, 260px" : "(max-width: 768px) 150px, 230px"}
          className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
          {statusLabel}
        </span>

        <FavoriteButton
          storyId={story.id}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/85 p-1.5 text-slate-600 shadow-sm hover:bg-white hover:text-red-400 dark:bg-slate-900/70 dark:text-slate-200"
        />
      </div>

      <div className="mt-2 space-y-1">
        <h3 className="mt-2 line-clamp-2 text-sm font-bold text-gray-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
          {localizedTitle}
        </h3>

        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{story.author?.name || t("updating")}</p>

        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span>{viewsLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
            <span>{rating}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
