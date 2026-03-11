"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, Clock3, ListMusic, Lock, PlayCircle } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import FavoriteButton from "@/components/shared/FavoriteButton";

type ChapterItem = {
  id: string;
  title: string;
  chapterNumber: number;
  audioDuration: number | null;
  accessType: "free" | "timed" | "vip";
  unlocksAt: string | null;
};

type StoryDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  updatedAt: string;
  author?: { name: string };
  chapters: ChapterItem[];
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const totalSeconds = Math.floor(seconds);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const chapterHref = (slug: string, chapterNumber: number) => `/story/${slug}/chuong-${chapterNumber}`;

const getUnlockLabel = (chapter: ChapterItem, t: ReturnType<typeof useTranslations>) => {
  if (chapter.accessType === "free") return null;
  if (chapter.accessType === "vip") return t("unlockVip");
  if (!chapter.unlocksAt) return t("unlockTimed");

  const msLeft = new Date(chapter.unlocksAt).getTime() - Date.now();
  if (msLeft <= 0) return t("unlockOpened");

  const day = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hour = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  if (day > 0) return `${day}d ${hour}h`;
  return `${hour}h`;
};

export default function StoryDetailClient() {
  const t = useTranslations("StoryDetail");
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const fetchDetail = async () => {
      try {
        const response = await apiClient.get<StoryDetail>(`/stories/${slug}`);
        setStory(response.data);
      } catch (error) {
        console.error("Error while loading chapter list:", error);
        setStory(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [slug]);

  const firstChapter = useMemo(() => story?.chapters?.[0] || null, [story?.chapters]);

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading")}</p>;
  }

  if (!story) {
    return <p className="text-sm text-red-600">{t("notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="h-36 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
            <Image
              src={story.thumbnailUrl || "https://placehold.co/300x450?text=No+Cover"}
              alt={story.title}
              width={96}
              height={144}
              priority
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{story.title}</h1>
              <FavoriteButton storyId={story.id} size="md" className="bg-gray-900/50 hover:bg-gray-900/70" />
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t("author")}: <b>{story.author?.name || t("authorUpdating")}</b></p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t("listens", { count: Number(story.totalViews || 0).toLocaleString() })}</p>
            <p className="mt-3 line-clamp-3 text-sm text-gray-600 dark:text-gray-300">{story.description || t("descriptionUpdating")}</p>

            {firstChapter ? (
              <Link
                href={chapterHref(story.slug, firstChapter.chapterNumber)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <PlayCircle className="h-4 w-4" /> {t("listenFromFirst")}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("introTitle")}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">
          {story.description || t("introUpdating")}
        </p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <ListMusic className="h-5 w-5" /> {t("chapterList")}
          </h2>
          <span className="text-sm text-gray-500">{t("totalChapters", { count: story.chapters.length })}</span>
        </div>

        <div className="space-y-2">
          {story.chapters.map((chapter) => {
            const unlockLabel = getUnlockLabel(chapter, t);
            return (
              <Link
                key={chapter.id}
                href={chapterHref(story.slug, chapter.chapterNumber)}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t("chapterTitle", { number: chapter.chapterNumber, title: chapter.title })}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {t("readListen")}</span>
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {formatDuration(chapter.audioDuration)}</span>
                    {unlockLabel ? <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300"><Lock className="h-3.5 w-3.5" /> {unlockLabel}</span> : null}
                  </div>
                </div>

                <PlayCircle className="h-5 w-5 shrink-0 text-blue-600" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
