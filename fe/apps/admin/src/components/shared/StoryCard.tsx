import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { Eye, Star } from "lucide-react";
import FavoriteButton from "@/components/shared/FavoriteButton";
import { getLocalizedValue } from "@/lib/story-localization";
import { cleanChapterTitle } from "@/lib/formatChapterTitle";

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
  lang?: string;
  showFavoriteButton?: boolean;
  compactMobile?: boolean;
  profileCompact?: boolean;
  hideMobileStats?: boolean;
};

const content = {
  vi: {
    statusOngoing: "Đang ra",
    statusCompleted: "Full",
  },
  en: {
    statusOngoing: "Ongoing",
    statusCompleted: "Completed",
  },
} as const;

export default function StoryCard({
  story,
  className,
  variant = "default",
  lang,
  showFavoriteButton = true,
  compactMobile = false,
  profileCompact = false,
  hideMobileStats = false,
}: StoryCardProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const resolvedLang = lang === "en" ? "en" : (locale === "en" ? "en" : "vi");
  const localContent = content[resolvedLang];
  const statusLabel = story.status === "completed" ? localContent.statusCompleted : localContent.statusOngoing;
  const rating = Number(story.averageRating || 0).toFixed(1);
  const localizedTitle = getLocalizedValue(resolvedLang, story.titleVi, story.titleEn, story.title);
  const localizedDescription = getLocalizedValue(resolvedLang, story.descriptionVi, story.descriptionEn, story.description || "");
  const shortDescription = localizedDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const formatTimeAgo = (dateString?: string | null) => {
    if (!dateString) return resolvedLang === "en" ? "Just now" : "Vừa xong";

    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    if (!Number.isFinite(diffInMs) || diffInMs < 0) return resolvedLang === "en" ? "Just now" : "Vừa xong";

    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours < 1) return resolvedLang === "en" ? "Just now" : "Vừa xong";
    if (diffInHours < 24) return resolvedLang === "en" ? `${diffInHours}h ago` : `${diffInHours} giờ trước`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return resolvedLang === "en" ? `${diffInDays}d ago` : `${diffInDays} ngày trước`;

    return date.toLocaleDateString(resolvedLang === "en" ? "en-US" : "vi-VN");
  };

  const latestChapterLabel = (() => {
    const chapterNum = story.latestChapterNumber;
    const chapterTitle = story.latestChapterTitle;

    if (chapterNum && chapterTitle) return t("chapterLabel", { number: chapterNum, title: cleanChapterTitle(chapterTitle) });
    if (chapterNum) return t("chapterNumber", { number: chapterNum });
    if (chapterTitle) return chapterTitle;
    return t("latestChapterUpdating");
  })();

  const viewsLabel = Number(story.totalViews || 0).toLocaleString(resolvedLang === "en" ? "en-US" : "vi-VN");
  const statusClass =
    story.status === "completed"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
      : "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-200";

  if (variant === "overlay") {
    const firstCategory = story.categories?.[0]?.category?.name;

    return (
      <Link
        href={`/story/${story.slug}`}
        className={`group block overflow-hidden rounded-2xl bg-slate-900/95 shadow-sm ring-1 ring-slate-800/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${className || ""}`}
      >
        <div className="relative">
          <Image
            src={story.thumbnailUrl || "/thumbnaildefault.jpg"}
            alt={localizedTitle}
            width={400}
            height={600}
            loading="lazy"
            sizes="(max-width: 640px) 62vw, (max-width: 1024px) 31vw, 22vw"
            className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

          <div className="absolute left-2 top-2 flex flex-col gap-1">
            <span className="inline-flex rounded-md bg-pink-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              {statusLabel}
            </span>
            {firstCategory ? (
              <span className="inline-flex rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                {firstCategory}
              </span>
            ) : null}
          </div>

          {showFavoriteButton ? (
            <FavoriteButton
              storyId={story.id}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/45 p-1.5 text-white shadow-sm backdrop-blur-sm hover:bg-black/65 hover:text-red-400"
            />
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <h3 className="line-clamp-2 text-base font-extrabold leading-tight">{localizedTitle}</h3>
            <p className="mt-0.5 truncate text-sm text-white/85">{story.author?.name || t("updating")}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/85">
              {shortDescription || t("updating")}
            </p>

            {/* Rating and views removed from thumbnail overlay */}
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
            src={story.thumbnailUrl || "/thumbnaildefault.jpg"}
            alt={localizedTitle}
            width={400}
            height={600}
            loading="lazy"
            sizes="(max-width: 768px) 160px, 260px"
            className="aspect-[3/4] w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
            {statusLabel}
          </span>

          {showFavoriteButton ? (
            <FavoriteButton
              storyId={story.id}
              className="absolute right-2 top-2 z-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 hover:text-red-400 transition-colors pointer-events-auto"
            />
          ) : null}
        </div>

        <h3 className="mt-3 line-clamp-1 text-base font-bold text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{localizedTitle}</h3>

        <p className="line-clamp-1 text-xs text-slate-500 dark:text-gray-400">
          {story.author?.name || t("updating")}
        </p>

        <div className="mt-2 flex items-center justify-between bg-white/70 dark:bg-gray-900/70 rounded-lg px-2 py-2">
          <span className="line-clamp-1 text-sm font-medium text-pink-400">{latestChapterLabel}</span>
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
      className={`group flex h-full flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
        isFeatured
          ? "bg-amber-50/70 shadow-sm hover:shadow-lg hover:shadow-amber-100/60 dark:bg-slate-900/90 dark:hover:shadow-none"
          : "bg-white/90 shadow-sm hover:shadow-md dark:bg-gray-900/80"
      } ${className || ""}`}
    >
      <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-800">
        <Image
          src={story.thumbnailUrl || "/thumbnaildefault.jpg"}
          alt={localizedTitle}
          width={400}
          height={600}
          loading="lazy"
          sizes={isFeatured ? "(max-width: 768px) 180px, 260px" : "(max-width: 768px) 150px, 230px"}
          className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
          {statusLabel}
        </span>

        {showFavoriteButton ? (
          <FavoriteButton
            storyId={story.id}
            className="absolute right-2 top-2 z-10 rounded-full bg-white/85 p-1.5 text-slate-600 shadow-sm hover:bg-white hover:text-red-400 dark:bg-slate-900/70 dark:text-slate-200"
          />
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col ${profileCompact ? "min-h-[62px] p-1.5 pt-1.5" : compactMobile && hideMobileStats ? "min-h-[65px] p-1 pt-1" : "min-h-[96px] p-2 pt-2"}`}>
        <h3
          className={`${profileCompact ? "line-clamp-1" : "line-clamp-2"} font-bold text-gray-900 transition-colors group-hover:text-pink-700 dark:text-white dark:group-hover:text-pink-300 ${
            profileCompact
              ? "text-[12px]"
              : compactMobile && hideMobileStats
                ? "text-[11px] sm:text-[13px]"
                : compactMobile
                  ? "text-[13px] sm:text-sm"
                  : "text-sm"
          }`}
        >
          {localizedTitle}
        </h3>

        <p className={`truncate text-gray-500 dark:text-gray-400 ${profileCompact ? "mt-0.5 text-[10px]" : compactMobile && hideMobileStats ? "mt-0.5 text-[9px] sm:text-[10px]" : compactMobile ? "text-[11px] sm:text-xs" : "text-xs"}`}>
          {story.author?.name || t("updating")}
        </p>

        <div
          className={`${hideMobileStats ? "hidden md:flex" : compactMobile || profileCompact ? "flex" : "hidden sm:flex"} mt-auto items-center justify-between gap-1.5 ${profileCompact ? "pt-0.5 text-[10px]" : "pt-1 text-xs"} text-gray-500 dark:text-gray-400`}
        >
          <div className="flex min-w-0 items-center gap-1">
            <Eye className={`${profileCompact ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
            <span>{viewsLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className={`${profileCompact ? "h-3 w-3" : "h-3.5 w-3.5"} text-amber-500`} fill="currentColor" />
            <span>{rating}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

