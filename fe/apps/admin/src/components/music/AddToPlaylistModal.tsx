"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Music2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api/api-client";
import { unwrapData, unwrapList } from "@/lib/api/unwrap";
import { useUserStore } from "@/stores/user-store";

type PlaylistSummary = {
  id: string;
  title: string;
  coverImage: string | null;
  totalTracks: number;
  updatedAt: string;
};

type PlaylistListResponse = {
  data: PlaylistSummary[];
};

type PlaylistCreateResponse = {
  data: PlaylistSummary;
};

type AddTrackResponse = {
  data: {
    added: boolean;
  };
};

type ToastState = {
  message: string;
} | null;

type AddToPlaylistModalProps = {
  isOpen: boolean;
  musicId: string | null;
  musicTitle?: string;
  onClose: () => void;
  onAdded?: () => void;
};

export default function AddToPlaylistModal({
  isOpen,
  musicId,
  musicTitle,
  onClose,
  onAdded,
}: AddToPlaylistModalProps) {
  const t = useTranslations("PlaylistModal");

  const accessToken = useUserStore((state) => state.accessToken);

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingPlaylistId, setAddingPlaylistId] = useState<string | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  const fetchPlaylists = useCallback(async () => {
    if (!accessToken) {
      setPlaylists([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.get<PlaylistListResponse>("/personal-playlists");
      const rows = unwrapList<PlaylistSummary>(response.data);
      setPlaylists(rows);
    } catch {
      setPlaylists([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchPlaylists();
  }, [fetchPlaylists, isOpen]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const createPlaylist = async () => {
    const title = newPlaylistTitle.trim();
    if (!title) return;

    setIsCreating(true);

    try {
      const response = await apiClient.post<PlaylistCreateResponse>("/personal-playlists", {
        title,
      });

      const created = unwrapData<PlaylistSummary>(response.data);
      if (created) {
        setPlaylists((prev) => [created, ...prev]);
        setNewPlaylistTitle("");
      }
    } catch {
      // Keep modal resilient.
    } finally {
      setIsCreating(false);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!musicId) return;

    setAddingPlaylistId(playlistId);

    try {
      await apiClient.post<AddTrackResponse>(`/personal-playlists/${playlistId}/tracks/${musicId}`);
      showToast(t("success"));
      onAdded?.();
    } catch {
      // Keep modal resilient.
    } finally {
      setAddingPlaylistId(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/45" onClick={onClose} />

      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-[28px] border border-pink-200 bg-white shadow-2xl dark:border-pink-900/40 dark:bg-[#171717]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-[#2a2a2a]">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-zinc-100">{t("title")}</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("subtitle")}</p>
              {musicTitle ? <p className="mt-1 text-xs text-pink-600 dark:text-pink-300">{musicTitle}</p> : null}
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-[#252525]"
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[55vh] overflow-auto px-6 py-5">
            {!accessToken ? (
              <p className="rounded-2xl border border-pink-200 bg-pink-50 p-4 text-sm font-medium text-pink-700 dark:border-pink-900/40 dark:bg-pink-950/20 dark:text-pink-300">
                {t("loginRequired")}
              </p>
            ) : isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#222]" />
                ))}
              </div>
            ) : playlists.length ? (
              <div className="space-y-2.5">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-[#303030] dark:bg-[#1f1f1f]"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#2a2a2a]">
                      {playlist.coverImage ? (
                        <Image
                          src={playlist.coverImage}
                          alt={playlist.title}
                          width={96}
                          height={96}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Music2 className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-800 dark:text-zinc-100">{playlist.title}</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">{t("tracksCount", { count: playlist.totalTracks })}</p>
                    </div>

                    <button
                      onClick={() => void addToPlaylist(playlist.id)}
                      disabled={addingPlaylistId === playlist.id || !musicId}
                      className="inline-flex items-center gap-1.5 rounded-full bg-pink-600 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-pink-700 disabled:opacity-60"
                    >
                      {addingPlaylistId === playlist.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {t("add")}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-[#2f2f2f] dark:text-zinc-400">
                {t("empty")} {t("creatingHint")}
              </p>
            )}
          </div>

          {accessToken ? (
            <div className="border-t border-slate-100 px-6 py-4 dark:border-[#2a2a2a]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={newPlaylistTitle}
                  onChange={(event) => setNewPlaylistTitle(event.target.value)}
                  placeholder={t("inputPlaceholder")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-pink-400 dark:border-[#333] dark:bg-[#121212] dark:text-zinc-100"
                />
                <button
                  onClick={() => void createPlaylist()}
                  disabled={isCreating}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-pink-700 disabled:opacity-60"
                >
                  {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {isCreating ? t("creating") : t("createButton")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div className="fixed right-5 top-5 z-[130] inline-flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-xl">
          <Check className="h-4 w-4" /> {toast.message}
        </div>
      ) : null}
    </>
  );
}
