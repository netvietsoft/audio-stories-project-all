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
  variant?: "default" | "newly-posted";
};

export default function StoryCard({ story, className, variant = "default" }: StoryCardProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const statusLabel = story.status === "completed" ? t("full") : t("ongoing");
  const firstCategory = story.categories?.[0]?.category;
  const categoryLabel = firstCategory 
    ? getLocalizedValue(locale, firstCategory.nameVi, firstCategory.nameEn, firstCategory.name)
    : t("updating");
  const rating = Number(story.averageRating || 0).toFixed(1);
  const localizedTitle = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);

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

  return (
    <Link
      href={`/story/${story.slug}`}
      className={`block relative w-[130px] sm:w-[150px] md:w-full shrink-0 aspect-[3/4] rounded-lg overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-shadow ${className || ""}`}
    >
      <Image
        src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
        alt={localizedTitle}
        fill
        sizes="(max-width: 768px) 150px, 250px"
        className="object-cover transition-transform duration-500 group-hover:scale-110"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none z-0" />

      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          {statusLabel}
        </span>
        <span className="bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
          {categoryLabel}
        </span>
      </div>

      <FavoriteButton
        storyId={story.id}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 hover:text-red-400 transition-colors pointer-events-auto"
      />

      <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 z-10 pointer-events-none flex flex-col">
        <h3 className="text-white font-bold text-sm md:text-base leading-tight line-clamp-2 mb-1">
          {localizedTitle}
        </h3>

        <p className="text-gray-300 text-[10px] md:text-xs truncate mb-1.5 md:mb-2">
          {story.author?.name || t("updating")}
        </p>

        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-1 text-[10px] md:text-xs text-yellow-400 font-medium">
            <Star className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" />
            <span>{rating}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-300">
            <Eye className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>{Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
