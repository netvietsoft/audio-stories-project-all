"use client";

import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

type ChapterItem = {
  id: string;
  title: string;
  chapterNumber: number;
  createdAt: string;
  story: {
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    author?: { name: string };
  } | null;
};

interface StoryListViewProps {
  chapters: ChapterItem[];
  isLoading?: boolean;
}

export default function StoryListView({ chapters, isLoading }: StoryListViewProps) {
  const t = useTranslations("StoryListView");

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return "";

    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInHours < 1) return t("justNow");
    if (diffInHours < 24) return t("hoursAgo", { count: diffInHours });

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return t("daysAgo", { count: diffInDays });

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return t("weeksAgo", { count: diffInWeeks });

    const diffInMonths = Math.floor(diffInDays / 30);
    return t("monthsAgo", { count: diffInMonths });
  };
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 animate-pulse"
          >
            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!chapters || chapters.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        {t("noChapters")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
      {chapters.map((chapter) => {
        const story = chapter.story;
        const hasStoryLink = Boolean(story?.slug);
        const storyTitle = story?.title || "Unknown story";
        const chapterHref = hasStoryLink
          ? `/story/${story!.slug}/chuong-${chapter.chapterNumber}`
          : "#";

        return (
          <Link
            key={chapter.id}
            href={chapterHref}
            aria-disabled={!hasStoryLink}
            onClick={(event) => {
              if (!hasStoryLink) {
                event.preventDefault();
              }
            }}
            className={`flex items-center gap-4 p-3 rounded-lg transition-colors group ${
              hasStoryLink
                ? "hover:bg-gray-50 dark:hover:bg-gray-800/30"
                : "opacity-80 cursor-not-allowed"
            }`}
          >
            {/* Left: Thumbnail + Story Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-200 dark:bg-gray-700">
                <Image
                  src={story?.thumbnailUrl || "https://placehold.co/100x100?text=No+Cover"}
                  alt={storyTitle}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {storyTitle}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("statusOngoing")}
                </p>
              </div>
            </div>

            {/* Center: Chapter Info */}
            <div className="hidden md:block text-sm text-gray-600 dark:text-gray-400 w-64 truncate">
              {t("chapterLabel", { number: chapter.chapterNumber, title: chapter.title })}
            </div>

            {/* Right: Time */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 w-28 justify-end shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimeAgo(chapter.createdAt)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
