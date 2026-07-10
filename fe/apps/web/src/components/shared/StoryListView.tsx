"use client";

import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cleanChapterTitle } from "@/lib/formatChapterTitle";

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
    tone?: "default" | "pink";
}

export default function StoryListView({ chapters, isLoading, tone = "default" }: StoryListViewProps) {
  const t = useTranslations("StoryListView");
  const isPinkTone = tone === "pink";

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
      <div className="grid grid-cols-1 gap-x-4 gap-y-0 px-4 sm:px-0 lg:grid-cols-2">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-lg bg-transparent animate-pulse"
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

  const validChapters = (Array.isArray(chapters) ? chapters : []).filter((chapter) => chapter?.story?.slug);

  if (!validChapters.length) {
    return (
      <div className="px-4 py-12 text-center text-gray-500 sm:px-0 dark:text-gray-400">
        {t("noChapters")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-0 px-4 sm:px-0 lg:grid-cols-2">
      {validChapters.map((chapter) => {
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
            className={`group flex w-full items-center justify-between gap-x-4 rounded-2xl px-3 py-2 transition-all ${
              hasStoryLink
                ? isPinkTone
                  ? "bg-transparent hover:bg-pink-50/40 dark:hover:bg-white/5"
                  : "bg-transparent hover:bg-pink-50/50 dark:hover:bg-white/5"
                : "opacity-80 cursor-not-allowed"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-x-4">
              <div className={`relative h-14 w-10 shrink-0 overflow-hidden rounded ${isPinkTone ? "bg-pink-50/50 dark:bg-[#3a3b3c]" : "bg-gray-200 dark:bg-gray-700"}`}>
                <Image
                  src={story?.thumbnailUrl || "/thumbnaildefault.jpg"}
                  alt={storyTitle}
                  fill
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-col">
                <h3 className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-pink-600 dark:text-gray-100 dark:group-hover:text-pink-400">
                  {storyTitle}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("statusOngoing")}
                </p>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 px-1 md:flex">
              <p className="truncate text-sm text-gray-600 dark:text-gray-300">
                {t("chapterLabel", { number: chapter.chapterNumber, title: cleanChapterTitle(chapter.title) })}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{formatTimeAgo(chapter.createdAt)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}