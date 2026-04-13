"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/shared/LocalizedLink";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Check, ListMusic, Loader2, Plus, X } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";

type PersonalPlaylist = {
  id: string;
  title: string;
  coverImage: string | null;
  totalTracks: number;
  updatedAt: string;
};

type PersonalPlaylistListResponse = {
  data: PersonalPlaylist[];
};

type PersonalPlaylistCreateResponse = {
  data: PersonalPlaylist;
};

type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

export default function ProfilePlaylistsPage() {
  const locale = useLocale();
  const t = useTranslations("ProfilePlaylistsPage");
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const accessToken = useUserStore((state) => state.accessToken);
  const isAuthHydrated = useUserStore((state) => state.isHydrated);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const [items, setItems] = useState<PersonalPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<PersonalPlaylistListResponse>("/personal-playlists");
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthHydrated) return;
    if (!accessToken) {
      router.push(`/${currentLang}`);
      return;
    }

    void fetchPlaylists();
  }, [accessToken, currentLang, isAuthHydrated, router]);

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
      await apiClient.post<PersonalPlaylistCreateResponse>("/personal-playlists", { title });
      setNewPlaylistTitle("");
      showToast(t("createSuccess"), "success");

      await fetchPlaylists();

      return;
    } catch {
      showToast(t("createFailed"), "error");
    } finally {
      setIsCreating(false);
    }
  };

  const toastClassName =
    toast?.type === "error"
      ? "bg-rose-600"
      : "bg-pink-600";

  const toastIcon =
    toast?.type === "error" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="inline-flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100">
            <ListMusic className="h-6 w-6 text-pink-600" /> {t("title")}
          </h1>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#232325]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={newPlaylistTitle}
              onChange={(event) => setNewPlaylistTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void createPlaylist();
              }}
              placeholder={t("createPlaceholder")}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-pink-400 focus:bg-white dark:border-zinc-700 dark:bg-[#171717] dark:text-gray-100"
            />
            <button
              onClick={() => void createPlaylist()}
              disabled={isCreating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-pink-700 disabled:opacity-60"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {isCreating ? t("creating") : t("createButton")}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#2a2a2a]" />
            ))}
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((playlist) => (
              <article
                key={playlist.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-[#232325]"
              >
                <div className="relative h-36 w-full bg-gray-100 dark:bg-[#1b1b1b]">
                  <Image
                    src={playlist.coverImage || "/thumbnaildefault.jpg"}
                    alt={playlist.title}
                    width={640}
                    height={280}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-2 p-4">
                  <h2 className="line-clamp-1 text-base font-black text-gray-900 dark:text-gray-100">{playlist.title}</h2>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("tracksCount", { count: playlist.totalTracks })}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {t("updatedAt")}: {dateFormatter.format(new Date(playlist.updatedAt))}
                  </p>

                  <Link
                    href={`/profile/playlists/${playlist.id}`}
                    className="inline-flex rounded-full border border-pink-300 bg-pink-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-pink-700 transition hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300"
                  >
                    {t("open")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {t("empty")}
          </p>
        )}
      </div>

      {toast ? (
        <div className={`fixed right-5 top-5 z-[130] inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl ${toastClassName}`}>
          {toastIcon} {toast.message}
        </div>
      ) : null}
    </>
  );
}
