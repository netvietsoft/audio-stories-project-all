"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PlayCircle } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";

type ChapterItem = {
  id: string;
  title: string;
  chapterNumber: number;
  audioDuration: number | null;
  accessType: "free" | "timed" | "vip";
};

type StoryDetail = {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  totalViews: number;
  author?: { name: string };
  chapters: ChapterItem[];
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export default function StoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setTrack = useAudioStore((state) => state.setTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);

  useEffect(() => {
    if (!slug) return;

    const fetchDetail = async () => {
      try {
        const response = await apiClient.get<StoryDetail>(`/stories/${slug}`);
        setStory(response.data);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [slug]);

  const chapterCount = useMemo(() => story?.chapters?.length ?? 0, [story?.chapters]);

  const playChapter = (chapter: ChapterItem, selectedStory: StoryDetail) => {
    // API detail intentionally does not expose r2AudioUrl; this is a safe placeholder until play API is wired.
    setTrack({
      id: chapter.id,
      title: `${selectedStory.title} - Chương ${chapter.chapterNumber}`,
      author: selectedStory.author?.name,
      audioUrl: "",
      coverUrl: selectedStory.thumbnailUrl || undefined,
    });
    togglePlay(true);
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải chi tiết truyện...</p>;
  }

  if (!story) {
    return <p className="text-sm text-red-600">Không tìm thấy truyện.</p>;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-[220px_1fr] dark:border-gray-800 dark:bg-gray-900">
        <img
          src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
          alt={story.title}
          className="aspect-[2/3] w-full rounded-xl object-cover"
        />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{story.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Tác giả: {story.author?.name || "Đang cập nhật"}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Lượt nghe: {Number(story.totalViews || 0).toLocaleString("vi-VN")}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Số chương: {chapterCount}</p>

          <button
            onClick={() => story.chapters[0] && playChapter(story.chapters[0], story)}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <PlayCircle className="h-5 w-5" />
            Nghe ngay
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Danh sách chương</h2>
        <div className="space-y-2">
          {story.chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => playChapter(chapter, story)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Chương {chapter.chapterNumber}: {chapter.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Truy cập: {chapter.accessType}</p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{formatDuration(chapter.audioDuration)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
