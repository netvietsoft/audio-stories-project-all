"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, PlayCircle, Trash2 } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

type HistoryItem = {
  id: string;
  progressSeconds: number;
  lastListenedAt: string;
  story: {
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    author?: {
      name: string;
    };
  };
  chapter: {
    id: string;
    chapterNumber: number;
    title: string;
    audioDuration: number | null;
    r2AudioUrl: string | null;
  };
};

type HistoryResponse = {
  data: HistoryItem[];
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export default function ProfileHistoryPage() {
  const router = useRouter();
  const accessToken = useUserStore((state) => state.accessToken);
  const playTrack = useAudioStore((state) => state.playTrack);
  const seekTo = useAudioStore((state) => state.seekTo);

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<HistoryResponse>("/history", {
        params: {
          page: 1,
          limit: 50,
        },
      });
      setItems(response.data.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      router.push("/login");
      return;
    }
    void fetchHistory();
  }, [accessToken, router]);

  const handleResume = (item: HistoryItem) => {
    const href = `/story/${item.story.slug}/chuong-${item.chapter.chapterNumber}`;

    if (item.chapter.r2AudioUrl) {
      playTrack(
        {
          id: item.chapter.id,
          chapterId: item.chapter.id,
          storyId: item.story.id,
          storySlug: item.story.slug,
          chapterNumber: item.chapter.chapterNumber,
          title: `Chương ${item.chapter.chapterNumber}: ${item.chapter.title}`,
          author: item.story.author?.name,
          audioUrl: item.chapter.r2AudioUrl,
          coverUrl: item.story.thumbnailUrl || undefined,
        },
        [],
      );
      seekTo(item.progressSeconds || 0);
    }

    router.push(href);
  };

  const handleDelete = async (id: string) => {
    await apiClient.delete(`/history/${id}`);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClear = async () => {
    await apiClient.delete("/history");
    setItems([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <History className="h-6 w-6" /> Lịch sử nghe
        </h1>
        {items.length > 0 ? (
          <button
            onClick={() => void handleClear()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" /> Xóa toàn bộ
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải lịch sử nghe...</p>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Chưa có dữ liệu nghe gần đây.
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const duration = item.chapter.audioDuration || 0;
          const progress = duration > 0 ? Math.min(100, Math.floor((item.progressSeconds / duration) * 100)) : 0;
          return (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex gap-4">
                <Link href={`/story/${item.story.slug}`} className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                  <img
                    src={item.story.thumbnailUrl || "https://placehold.co/140x200?text=No+Cover"}
                    alt={item.story.title}
                    className="h-full w-full object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{item.story.title}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-gray-600 dark:text-gray-300">
                    Chương {item.chapter.chapterNumber}: {item.chapter.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Đã nghe {formatDuration(item.progressSeconds)} / {formatDuration(item.chapter.audioDuration)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Cập nhật: {new Date(item.lastListenedAt).toLocaleString("vi-VN")}
                  </p>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleResume(item)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <PlayCircle className="h-4 w-4" /> Nghe tiếp
                    </button>
                    <button
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <Trash2 className="h-4 w-4" /> Xóa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
