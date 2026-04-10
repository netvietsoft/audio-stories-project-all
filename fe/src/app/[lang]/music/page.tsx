"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock3,
  Flame,
  Headphones,
  Heart,
  ListMusic,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";

import AddToPlaylistModal from "@/components/music/AddToPlaylistModal";
import Link from "@/components/shared/LocalizedLink";
import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

type MusicTrack = {
  id: string;
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

type MusicApiResponse = {
  data: MusicTrack[];
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const formatCount = (value?: number) => {
  if (!value || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

export default function MusicPage() {
  const t = useTranslations("MusicPage");
  const searchParams = useSearchParams();

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState("all");
  const [playlistTargetTrack, setPlaylistTargetTrack] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const lastPlayPingRef = useRef<Map<string, number>>(new Map());

  const accessToken = useUserStore((state) => state.accessToken);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);

  useEffect(() => {
    const queryTag = searchParams.get("tag")?.trim().toLowerCase();
    if (queryTag) {
      setActiveTag(queryTag);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      setIsLoadingTracks(true);

      try {
        const response = await apiClient.get<MusicApiResponse>("/music", {
          params: {
            page: 1,
            limit: 120,
          },
        });

        if (cancelled) return;

        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        const mapped = rows
          .filter((item) => Boolean(item.audioUrl))
          .map((item, index) => ({
            ...item,
            title: item.title?.trim() || `${t("selectTrack")} ${index + 1}`,
            artist: item.artist?.trim() || t("unknownArtist"),
            tags: normalizeTags(item.tags),
            playCount: item.playCount || 0,
            likeCount: item.likeCount || 0,
            commentCount: item.commentCount || 0,
          }));

        setTracks(mapped);
      } catch {
        if (cancelled) return;
        setTracks([]);
      } finally {
        if (!cancelled) {
          setIsLoadingTracks(false);
        }
      }
    };

    void loadTracks();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleTracks = useMemo(() => {
    return tracks.filter((track) => {
      const hitSearch =
        !normalizedSearch ||
        track.title.toLowerCase().includes(normalizedSearch) ||
        track.artist.toLowerCase().includes(normalizedSearch) ||
        (track.description || "").toLowerCase().includes(normalizedSearch);
      const hitTag = activeTag === "all" || track.tags.some((tag) => tag.toLowerCase() === activeTag);
      return hitSearch && hitTag;
    });
  }, [activeTag, normalizedSearch, tracks]);

  const queueForStore = useMemo(
    () =>
      visibleTracks.map((track) => ({
        id: track.id,
        title: track.title,
        author: track.artist,
        audioUrl: track.audioUrl,
        coverUrl: track.thumbnailUrl || "/thumbnaildefault.jpg",
      })),
    [visibleTracks],
  );

  const tagOptions = useMemo(() => {
    const map = new Map<string, number>();

    tracks.forEach((track) => {
      track.tags.forEach((tag) => {
        const key = tag.toLowerCase();
        map.set(key, (map.get(key) || 0) + 1);
      });
    });

    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [tracks]);

  const trendingTracks = useMemo(
    () => [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 5),
    [tracks],
  );

  const currentTrackStats = useMemo(() => {
    if (!currentTrack) return null;
    return tracks.find((track) => track.id === currentTrack.id) || null;
  }, [currentTrack, tracks]);

  const registerPlayback = async (trackId: string) => {
    const now = Date.now();
    const lastPing = lastPlayPingRef.current.get(trackId) || 0;

    if (now - lastPing < 45_000) {
      return;
    }

    lastPlayPingRef.current.set(trackId, now);

    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
              ...track,
              playCount: track.playCount + 1,
            }
          : track,
      ),
    );

    try {
      await apiClient.post(`/music/${trackId}/play`);
      if (accessToken) {
        await apiClient.post(`/music/interactions/${trackId}/history`);
      }
    } catch {
      // Playback should stay responsive even when tracking endpoints fail.
    }
  };

  const handlePlayOrToggle = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      togglePlay(!isPlaying);
      return;
    }

    playTrack(
      {
        id: track.id,
        title: track.title,
        author: track.artist,
        audioUrl: track.audioUrl,
        coverUrl: track.thumbnailUrl || "/thumbnaildefault.jpg",
      },
      queueForStore,
    );

    void registerPlayback(track.id);
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 pb-40">
      <section className="overflow-hidden rounded-[32px] border border-orange-200/70 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-6 text-slate-900 shadow-sm sm:p-8 dark:border-orange-900/30 dark:from-[#24170f] dark:via-[#1d1612] dark:to-[#121212] dark:text-zinc-100">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500 dark:text-orange-300">{t("heroEyebrow")}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{t("heroTitle")}</h1>
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-zinc-300">{t("heroDescription")}</p>
          </div>

          <div className="rounded-2xl border border-orange-300/70 bg-white/70 px-4 py-3 text-right backdrop-blur dark:border-orange-900/50 dark:bg-black/20">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500 dark:text-orange-300">{t("deckStats")}</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{tracks.length}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("tracksOnline")}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(260px,30%)_minmax(0,70%)]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">{t("searchLabel")}</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("trackListTitle")}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-medium outline-none transition focus:border-orange-400 focus:bg-white dark:border-[#303030] dark:bg-[#101010] dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">{t("tagsLabel")}</p>
              <button
                onClick={() => setActiveTag("all")}
                className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-500 hover:text-orange-600"
              >
                {t("reset")}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTag("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  activeTag === "all"
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#232323] dark:text-zinc-300"
                }`}
              >
                {t("all")}
              </button>

              {tagOptions.map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => setActiveTag(tag.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeTag === tag.key
                      ? "bg-orange-500 text-white"
                      : "bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-300"
                  }`}
                >
                  #{tag.key} <span className="ml-1 opacity-75">{tag.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
              <Flame className="h-4 w-4 text-orange-500" /> {t("trending")}
            </p>

            <div className="space-y-2.5">
              {trendingTracks.length ? (
                trendingTracks.map((track, index) => (
                  <button
                    key={track.id}
                    onClick={() => handlePlayOrToggle(track)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-[#232323]"
                  >
                    <span className="w-5 text-xs font-black text-slate-400">{index + 1}</span>
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#232323]">
                      <Image
                        src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
                        alt={track.title}
                        width={80}
                        height={80}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-zinc-100">{track.title}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{t("playsLabel", { count: formatCount(track.playCount) })}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-zinc-400">{t("emptyTracks")}</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">{t("nowPlaying")}</p>
            {currentTrack && currentTrackStats ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-[#232323]">
                  <Image
                    src={currentTrackStats.thumbnailUrl || "/thumbnaildefault.jpg"}
                    alt={currentTrackStats.title}
                    width={420}
                    height={240}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                </div>
                <div>
                  <p className="truncate text-sm font-black text-slate-900 dark:text-zinc-100">{currentTrackStats.title}</p>
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-zinc-400">{currentTrackStats.artist}</p>
                </div>
                <Link
                  href={`/music/${currentTrackStats.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black uppercase tracking-[0.13em] text-white transition hover:bg-orange-600"
                >
                  <ListMusic className="h-3.5 w-3.5" /> {t("openDetail")}
                </Link>
                <button
                  onClick={() =>
                    setPlaylistTargetTrack({
                      id: currentTrackStats.id,
                      title: currentTrackStats.title,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-pink-300 bg-pink-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.13em] text-pink-700 transition hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("addToPlaylist")}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-zinc-400">{t("selectTrack")}</p>
            )}
          </div>
        </aside>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-[#2a2a2a] sm:px-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-zinc-100">{t("trackListTitle")}</h2>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
                {t("tracksCount", { count: visibleTracks.length })}
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-slate-600 dark:bg-[#222] dark:text-zinc-300">
              {activeTag === "all" ? t("allTags") : `#${activeTag}`}
            </div>
          </div>

          {isLoadingTracks ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#222]" />
              ))}
            </div>
          ) : visibleTracks.length ? (
            <div className="divide-y divide-slate-100 dark:divide-[#242424]">
              {visibleTracks.map((track, index) => {
                const isActive = currentTrack?.id === track.id;
                const isRowPlaying = isActive && isPlaying;

                return (
                  <article
                    key={track.id}
                    className={`group px-4 py-4 transition sm:px-6 ${
                      isActive
                        ? "bg-orange-50/60 dark:bg-orange-950/20"
                        : "hover:bg-slate-50/80 dark:hover:bg-[#1f1f1f]"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <button
                        onClick={() => handlePlayOrToggle(track)}
                        aria-label={isRowPlaying ? t("pauseAria") : t("playAria")}
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                          isRowPlaying
                            ? "bg-orange-500 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#272727] dark:text-zinc-200"
                        }`}
                      >
                        {isRowPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>

                      <p className="hidden w-8 shrink-0 text-center text-sm font-black text-slate-400 sm:block">
                        {String(index + 1).padStart(2, "0")}
                      </p>

                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-[#232323]">
                        <Image
                          src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
                          alt={track.title}
                          width={128}
                          height={128}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3
                            className={`truncate text-base font-black ${
                              isActive ? "text-orange-600 dark:text-orange-300" : "text-slate-900 dark:text-zinc-100"
                            }`}
                          >
                            {track.title}
                          </h3>
                          {track.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <p className="truncate text-sm font-medium text-slate-500 dark:text-zinc-400">{track.artist}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Headphones className="h-3.5 w-3.5" /> {formatCount(track.playCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5" /> {formatCount(track.likeCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" /> {formatCount(track.commentCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" /> {formatDuration(track.audioDuration)}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/music/${track.id}`}
                        className="hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-orange-300 hover:text-orange-600 dark:border-[#303030] dark:text-zinc-300 sm:inline-flex"
                      >
                        {t("detail")}
                      </Link>
                      <button
                        onClick={() =>
                          setPlaylistTargetTrack({
                            id: track.id,
                            title: track.title,
                          })
                        }
                        className="inline-flex rounded-full border border-pink-300 bg-pink-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-pink-700 transition hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> {t("playlist")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-sm font-medium text-slate-500 dark:text-zinc-400">{t("emptyTracks")}</div>
          )}
        </div>
      </section>

      <AddToPlaylistModal
        isOpen={Boolean(playlistTargetTrack)}
        musicId={playlistTargetTrack?.id || null}
        musicTitle={playlistTargetTrack?.title}
        onClose={() => setPlaylistTargetTrack(null)}
      />
    </div>
  );
}
