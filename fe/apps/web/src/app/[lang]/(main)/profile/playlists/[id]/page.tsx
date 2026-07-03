"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Loader2, Pause, Pencil, Play, Trash2, X } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

type MusicTrack = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  description: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

type PlaylistTrackItem = {
  playlistId: string;
  musicId: string;
  orderIndex: number;
  addedAt: string;
  music: MusicTrack;
};

type PlaylistDetail = {
  id: string;
  title: string;
  coverImage: string | null;
  totalTracks: number;
  updatedAt: string;
  tracks: PlaylistTrackItem[];
};

type PlaylistDetailResponse = {
  data: PlaylistDetail;
};

type PlaylistRenameResponse = {
  data?: {
    title?: string;
  };
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export default function PlaylistDetailPage() {
  const params = useParams<{ lang?: string; id?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const playlistId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const t = useTranslations("ProfilePlaylistDetailPage");

  const router = useRouter();
  const accessToken = useUserStore((state) => state.accessToken);
  const isAuthHydrated = useUserStore((state) => state.isHydrated);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingMusicId, setPendingMusicId] = useState<string | null>(null);
  const [isDeletingPlaylist, setIsDeletingPlaylist] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const renameInFlightRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  const queueForStore = useMemo(() => {
    if (!playlist) return [];

    return playlist.tracks.map((item) => ({
      id: item.music.id,
      title: item.music.title,
      author: item.music.artist,
      audioUrl: item.music.audioUrl,
      coverUrl: item.music.thumbnailUrl || "/thumbnaildefault.jpg",
    }));
  }, [playlist]);

  const fetchDetail = async () => {
    if (!playlistId) {
      setLoadError(t("loadFailed"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await apiClient.get<PlaylistDetailResponse>(`/personal-playlists/${playlistId}`);
      const data = response.data?.data;
      if (!data) {
        throw new Error("No data");
      }
      setPlaylist(data);
      setTitleInput(data.title);
    } catch {
      setPlaylist(null);
      setLoadError(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAuthHydrated) return;
    if (!accessToken) {
      router.push(`/${currentLang}`);
      return;
    }

    void fetchDetail();
  }, [accessToken, currentLang, isAuthHydrated, playlistId, router, t]);

  const startRename = () => {
    if (!playlist || isSavingTitle) return;
    setTitleInput(playlist.title);
    setIsEditingTitle(true);
  };

  const cancelRename = () => {
    setTitleInput(playlist?.title || "");
    setIsEditingTitle(false);
  };

  const commitRename = async () => {
    if (!playlistId || !playlist) return;

    const nextTitle = titleInput.trim();

    if (!nextTitle) {
      showToast(t("renameRequired"));
      setTitleInput(playlist.title);
      setIsEditingTitle(false);
      return;
    }

    if (nextTitle === playlist.title.trim()) {
      setIsEditingTitle(false);
      return;
    }

    if (renameInFlightRef.current) {
      return;
    }

    renameInFlightRef.current = true;
    setIsSavingTitle(true);

    try {
      const response = await apiClient.patch<PlaylistRenameResponse>(`/personal-playlists/${playlistId}`, {
        title: nextTitle,
      });

      const updatedTitle = response.data?.data?.title?.trim() || nextTitle;

      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              title: updatedTitle,
            }
          : prev,
      );
      setTitleInput(updatedTitle);
      setIsEditingTitle(false);
      showToast(t("renameSuccess"));
    } catch {
      showToast(t("renameFailed"));
    } finally {
      setIsSavingTitle(false);
      renameInFlightRef.current = false;
    }
  };

  const handlePlayTrack = (music: MusicTrack) => {
    if (currentTrack?.id === music.id) {
      togglePlay(!isPlaying);
      return;
    }

    playTrack(
      {
        id: music.id,
        title: music.title,
        author: music.artist,
        audioUrl: music.audioUrl,
        coverUrl: music.thumbnailUrl || "/thumbnaildefault.jpg",
      },
      queueForStore,
    );
  };

  const removeTrack = async (musicId: string) => {
    if (!playlistId) return;
    if (!window.confirm(t("removeTrackConfirm"))) return;

    setPendingMusicId(musicId);

    try {
      await apiClient.delete(`/personal-playlists/${playlistId}/tracks/${musicId}`);
      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.filter((item) => item.musicId !== musicId),
              totalTracks: Math.max(0, prev.totalTracks - 1),
            }
          : prev,
      );
    } catch {
      // Keep page resilient.
    } finally {
      setPendingMusicId(null);
    }
  };

  const deletePlaylist = async () => {
    if (!playlistId) return;
    if (!window.confirm(t("deletePlaylistConfirm"))) return;

    setIsDeletingPlaylist(true);

    try {
      await apiClient.delete(`/personal-playlists/${playlistId}`);
      router.push(`/${currentLang}/profile/playlists`);
    } catch {
      setIsDeletingPlaylist(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/profile/playlists"
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-[#202020] dark:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>

        {playlist ? (
          <button
            onClick={() => void deletePlaylist()}
            disabled={isDeletingPlaylist}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
          >
            {isDeletingPlaylist ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("deletePlaylist")}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-zinc-800 dark:bg-[#232325] dark:text-zinc-300">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}</span>
        </div>
      ) : loadError || !playlist ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {loadError || t("loadFailed")}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#232325]">
            <div className="grid gap-0 sm:grid-cols-[240px_1fr]">
              <div className="h-52 bg-gray-100 dark:bg-[#1c1c1c]">
                <Image
                  src={playlist.coverImage || "/thumbnaildefault.jpg"}
                  alt={playlist.title}
                  width={720}
                  height={420}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-start gap-2">
                  {isEditingTitle ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        autoFocus
                        value={titleInput}
                        onChange={(event) => setTitleInput(event.target.value)}
                        onBlur={() => void commitRename()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitRename();
                            return;
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                        placeholder={t("renamePlaceholder")}
                        className="w-full rounded-lg border border-pink-300 bg-white px-3 py-1.5 text-lg font-black text-gray-900 outline-none transition focus:border-pink-500 dark:border-pink-900/60 dark:bg-[#1a1a1a] dark:text-gray-100"
                      />
                      <button
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void commitRename()}
                        disabled={isSavingTitle}
                        className="inline-flex items-center gap-1 rounded-full bg-pink-600 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-pink-700 disabled:opacity-60"
                      >
                        {isSavingTitle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {t("renameSave")}
                      </button>
                      <button
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={cancelRename}
                        disabled={isSavingTitle}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:border-[#3a3a3a] dark:text-zinc-300"
                      >
                        <X className="h-3.5 w-3.5" /> {t("renameCancel")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">{playlist.title}</h1>
                      <button
                        onClick={startRename}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2a2a2a]"
                        aria-label={t("renameAria")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("tracksCount", { count: playlist.totalTracks })}</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            {playlist.tracks.length ? (
              playlist.tracks.map((item, index) => {
                const isActive = currentTrack?.id === item.music.id;
                const rowPlaying = isActive && isPlaying;

                return (
                  <article
                    key={`${item.playlistId}-${item.musicId}`}
                    className="rounded-2xl border border-gray-200 bg-white p-3 transition hover:bg-gray-50 dark:border-zinc-800 dark:bg-[#232325] dark:hover:bg-[#2a2a2a]"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handlePlayTrack(item.music)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                          rowPlaying
                            ? "bg-pink-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#2a2a2a] dark:text-zinc-200"
                        }`}
                      >
                        {rowPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>

                      <p className="hidden w-7 text-center text-sm font-black text-gray-400 sm:block">{index + 1}</p>

                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-gray-100 dark:bg-[#2a2a2a]">
                        <Image
                          src={item.music.thumbnailUrl || "/thumbnaildefault.jpg"}
                          alt={item.music.title}
                          width={96}
                          height={96}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link href={`/music/${item.music.slug}`} className="block truncate text-sm font-black text-gray-900 hover:text-pink-600 dark:text-gray-100">
                          {item.music.title}
                        </Link>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.music.artist}</p>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{formatDuration(item.music.audioDuration)}</p>
                      </div>

                      <button
                        onClick={() => void removeTrack(item.musicId)}
                        disabled={pendingMusicId === item.musicId}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
                      >
                        {pendingMusicId === item.musicId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {t("remove")}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-zinc-700 dark:text-gray-400">
                {t("empty")}
              </p>
            )}
          </section>

          <div>
            <Link
              href="/music"
              className="inline-flex rounded-full border border-pink-300 bg-pink-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-pink-700 transition hover:bg-pink-100 dark:border-pink-900/50 dark:bg-pink-950/20 dark:text-pink-300"
            >
              {t("openMusic")}
            </Link>
          </div>
        </>
      )}

      {toastMessage ? (
        <div className="fixed right-5 top-5 z-[130] inline-flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-xl">
          <Check className="h-4 w-4" /> {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
