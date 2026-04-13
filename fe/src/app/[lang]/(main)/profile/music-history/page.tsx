"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clock3, Headphones, Loader2, Music2, PlayCircle, Trash2 } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { formatMusicDuration, formatCompactCount } from "@/lib/music/normalize-music";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

type MusicHistoryItem = {
  id: string;
  progressSeconds: number;
  listenedAt: string;
  music: {
    id: string;
    title: string;
    artist: string;
    thumbnailUrl: string | null;
    audioUrl: string;
    audioDuration: number | null;
    playCount: number;
    likeCount: number;
  };
};

type MusicHistoryResponse = {
  data: MusicHistoryItem[];
  meta?: {
    total?: number;
    page?: number;
    lastPage?: number;
  };
};

export default function ProfileMusicHistoryPage() {
  const t = useTranslations("ProfileMusicHistoryPage");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const accessToken = useUserStore((state) => state.accessToken);
  const playTrack = useAudioStore((state) => state.playTrack);
  const seekTo = useAudioStore((state) => state.seekTo);

  const [items, setItems] = useState<MusicHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<MusicHistoryResponse>("/music/interactions/history", {
        params: {
          page: 1,
          limit: 50,
        },
      });
      setItems(response.data.data || []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      router.push(`/${currentLang}`);
      return;
    }
    void fetchHistory();
  }, [accessToken, currentLang, router]);

  const handleResume = (item: MusicHistoryItem) => {
    playTrack(
      {
        id: item.music.id,
        title: item.music.title,
        author: item.music.artist,
        audioUrl: item.music.audioUrl,
        coverUrl: item.music.thumbnailUrl || "/thumbnaildefault.jpg",
      },
      [],
    );
    if (item.progressSeconds > 0) {
      seekTo(item.progressSeconds);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/music/interactions/history/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // Keep page resilient.
    }
  };

  const handleClear = async () => {
    if (!window.confirm(t("clearConfirm"))) return;
    try {
      await apiClient.delete("/music/interactions/history");
      setItems([]);
    } catch {
      // Keep page resilient.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100">
          <Music2 className="h-6 w-6 text-pink-600" /> {t("title")}
        </h1>
        {items.length > 0 ? (
          <button
            onClick={() => void handleClear()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" /> {t("clearAll")}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#2a2a2a]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const duration = item.music.audioDuration || 0;
            const progress = duration > 0 ? Math.min(100, Math.floor((item.progressSeconds / duration) * 100)) : 0;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:bg-gray-50 dark:border-zinc-800 dark:bg-[#232325] dark:hover:bg-[#2a2a2a]"
              >
                <div className="flex gap-4">
                  <Link href={`/music/${item.music.id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#2b2b2d]">
                    <Image
                      src={item.music.thumbnailUrl || "/thumbnaildefault.jpg"}
                      alt={item.music.title}
                      width={128}
                      height={128}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={`/music/${item.music.id}`} className="block truncate text-sm font-bold text-gray-900 hover:text-pink-600 dark:text-gray-100">
                      {item.music.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{item.music.artist}</p>

                    <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Headphones className="h-3 w-3" /> {formatCompactCount(item.music.playCount)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" /> {formatMusicDuration(item.progressSeconds)} / {formatMusicDuration(item.music.audioDuration)}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#2b2b2d]">
                      <div className="h-full rounded-full bg-pink-600 transition-all" style={{ width: `${progress}%` }} />
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>{dateFormatter.format(new Date(item.listenedAt))}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleResume(item)}
                        className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-700"
                      >
                        <PlayCircle className="h-4 w-4" /> {t("resume")}
                      </button>
                      <button
                        onClick={() => void handleDelete(item.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-zinc-800 dark:text-gray-200 dark:hover:bg-[#2b2b2d]"
                      >
                        <Trash2 className="h-4 w-4" /> {t("delete")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
