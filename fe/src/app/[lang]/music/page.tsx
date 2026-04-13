"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Flame,
  Headphones,
  ListMusic,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";

import AddToPlaylistButton from "@/components/shared/AddToPlaylistButton";
import InlineAdvertisementCard from "@/components/ads/InlineAdvertisementCard";
import MusicLikeButton from "@/components/shared/MusicLikeButton";
import PlayNextButton from "@/components/shared/PlayNextButton";
import ShareActionButton from "@/components/shared/ShareActionButton";
import Link from "@/components/shared/LocalizedLink";
import { interleaveAds } from "@/lib/ads/interleave-ads";
import { useActiveAdvertisements } from "@/hooks/use-active-advertisements";
import { useDebounce } from "@/hooks/useDebounce";
import { apiClient } from "@/lib/api/api-client";
import { registerMusicPlayback } from "@/lib/music/music-interactions";
import {
  formatCompactCount,
  formatMusicDuration,
  normalizeMusicItem,
} from "@/lib/music/normalize-music";
import {
  isMusicTrackActive,
  toMusicQueue,
  toPlaylistQueue,
  toSingleQueueTrack,
} from "@/lib/music/music-queue";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";
import type { AdvertisementItem } from "@/types/advertisement";
import type { MusicApiItem, MusicTrack } from "@/types/music";

type MusicApiResponse = {
  data: MusicApiItem[];
  meta?: {
    total?: number;
    page?: number;
    lastPage?: number;
  };
};

const PAGE_SIZE = 10;
const PLAYLIST_PREVIEW_COUNT = 5;
const PLAYLIST_MAX_VISIBLE = 10;

export default function MusicPage() {
  const t = useTranslations("MusicPage");
  const searchParams = useSearchParams();

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>({});

  const debouncedSearchTerm = useDebounce(searchTerm, 350);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastPlayPingRef = useRef<Map<string, number>>(new Map());

  const accessToken = useUserStore((state) => state.accessToken);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);

  const activeAds = useActiveAdvertisements({ limit: 8 });

  useEffect(() => {
    const queryTag = searchParams.get("tag")?.trim().toLowerCase() || "all";
    const queryKeyword = searchParams.get("keyword")?.trim() || "";

    setActiveTag((prev) => (prev === queryTag ? prev : queryTag));
    setSearchTerm((prev) => (prev === queryKeyword ? prev : queryKeyword));
  }, [searchParams]);

  const fetchTracks = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingInitial(true);
      }

      try {
        const response = await apiClient.get<MusicApiResponse>("/music", {
          params: {
            page: targetPage,
            limit: PAGE_SIZE,
            ...(debouncedSearchTerm.trim() ? { search: debouncedSearchTerm.trim() } : {}),
            ...(activeTag !== "all" ? { tag: activeTag } : {}),
          },
        });

        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        const mappedRows = rows
          .map((item, index) => normalizeMusicItem(item, (targetPage - 1) * PAGE_SIZE + index))
          .filter((item) => Boolean(item.audioUrl));

        setTracks((prev) => {
          if (!append) {
            return mappedRows;
          }

          const existing = new Set(prev.map((item) => item.id));
          const nextRows = mappedRows.filter((item) => !existing.has(item.id));
          return [...prev, ...nextRows];
        });

        const nextPage = Math.max(1, response.data?.meta?.page || targetPage);
        const nextLastPage = Math.max(1, response.data?.meta?.lastPage || 1);
        const nextTotal = Math.max(0, response.data?.meta?.total || 0);

        setPage(nextPage);
        setLastPage(nextLastPage);
        setTotal(nextTotal);
      } catch {
        if (!append) {
          setTracks([]);
          setPage(1);
          setLastPage(1);
          setTotal(0);
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoadingInitial(false);
        }
      }
    },
    [activeTag, debouncedSearchTerm],
  );

  useEffect(() => {
    setExpandedPlaylists({});
    void fetchTracks(1, false);
  }, [fetchTracks]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    if (isLoadingInitial || isLoadingMore || page >= lastPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        void fetchTracks(page + 1, true);
      },
      { rootMargin: "280px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchTracks, isLoadingInitial, isLoadingMore, lastPage, page]);

  const queueForStore = useMemo(() => toMusicQueue(tracks), [tracks]);

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
      .slice(0, 12);
  }, [tracks]);

  const trendingTracks = useMemo(() => [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 5), [tracks]);

  const registerPlayback = async (targetId: string) => {
    const now = Date.now();
    const lastPing = lastPlayPingRef.current.get(targetId) || 0;

    if (now - lastPing < 45_000) {
      return;
    }

    lastPlayPingRef.current.set(targetId, now);

    setTracks((prev) =>
      prev.map((track) =>
        track.id === targetId
          ? {
              ...track,
              playCount: track.playCount + 1,
            }
          : track,
      ),
    );

    try {
      await registerMusicPlayback(targetId, Boolean(accessToken));
    } catch {
      // Keep playback responsive even when tracking endpoints fail.
    }
  };

  const handlePlayOrToggle = (track: MusicTrack) => {
    const playlistQueue = track.contentType === "playlist" ? toPlaylistQueue(track) : [];
    const isCurrentMatch =
      track.contentType === "single"
        ? currentTrack?.id === track.id
        : playlistQueue.some((item) => item.id === currentTrack?.id);

    if (isCurrentMatch) {
      togglePlay(!isPlaying);
      return;
    }

    if (track.contentType === "playlist") {
      if (!playlistQueue.length) return;
      const firstTrack = playlistQueue[0];
      if (!firstTrack) return;
      playTrack(firstTrack, playlistQueue);
      void registerPlayback(track.id);
      return;
    }

    playTrack(toSingleQueueTrack(track), queueForStore);
    void registerPlayback(track.id);
  };

  const handlePlayPlaylistItem = (parentTrack: MusicTrack, childIndex: number) => {
    const playlistQueue = toPlaylistQueue(parentTrack);
    const targetTrack = playlistQueue[childIndex];
    if (!targetTrack) return;

    const isCurrentMatch = currentTrack?.id === targetTrack.id;
    if (isCurrentMatch) {
      togglePlay(!isPlaying);
      return;
    }

    playTrack(targetTrack, playlistQueue);
    void registerPlayback(parentTrack.id);
  };

  const toggleExpand = (trackId: string) => {
    setExpandedPlaylists((prev) => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  const flowItems = useMemo(
    () =>
      interleaveAds<MusicTrack, AdvertisementItem>(tracks, activeAds, {
        every: 6,
        getAdId: (_ad, track, index) => `ad-${track.id}-${index}`,
      }),
    [activeAds, tracks],
  );

  // ─── Render helpers ───────────────────────────

  const renderSingleCard = (track: MusicTrack) => {
    const active = isMusicTrackActive(track, currentTrack);
    const playing = active && isPlaying;
    const targetTracks = [toSingleQueueTrack(track)];

    return (
      <article
        key={track.id}
        className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-[#171717] ${
          active
            ? "border-pink-400 ring-1 ring-pink-300/50 dark:border-pink-700 dark:ring-pink-900/30"
            : "border-slate-200 dark:border-[#2d2d2d]"
        }`}
      >
        <div className="flex gap-4">
          {/* Thumbnail + Play button */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28 dark:bg-[#242424]">
            <Image
              src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
              alt={track.title || "thumbnail"}
              width={224}
              height={224}
              unoptimized
              className="h-full w-full object-cover"
            />
            <button
              onClick={() => handlePlayOrToggle(track)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100"
              aria-label={playing ? t("pauseNow") : t("playNow")}
            >
              {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
            </button>
            {active ? (
              <div className="absolute bottom-1 right-1 rounded-full bg-orange-500 p-0.5">
                <Headphones className="h-3 w-3 text-white" />
              </div>
            ) : null}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/music/${track.slug}`}
                  className="block truncate text-base font-black text-slate-900 hover:text-pink-600 dark:text-zinc-100"
                >
                  {track.title}
                </Link>
                <p className="truncate text-sm text-slate-500 dark:text-zinc-400">{track.artist}</p>
              </div>
              {track.updatedAt ? (
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#242424] dark:text-zinc-400">
                  {new Date(track.updatedAt!).toLocaleDateString()}
                </span>
              ) : null}
            </div>

            {track.description ? (
              <p className="line-clamp-1 text-xs text-slate-500 dark:text-zinc-400">{track.description}</p>
            ) : null}

            {track.tags && track.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {track.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-600 dark:bg-pink-950/30 dark:text-pink-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
              <Clock3 className="h-3 w-3" /> {formatMusicDuration(track.audioDuration)}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Headphones className="h-3 w-3" /> {formatCompactCount(track.playCount)}
              </span>
              <MusicLikeButton
                musicId={track.id}
                initialLiked={false}
                likeCount={track.likeCount}
                compact
              />
              <Link href={`/music/${track.slug}`} className="inline-flex items-center gap-1 hover:text-pink-600">
                <MessageCircle className="h-3 w-3" /> {formatCompactCount(track.commentCount)}
              </Link>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ShareActionButton
                title={track.title}
                text={`${track.title} - ${track.artist}`}
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/music/${track.slug}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-pink-300 hover:text-pink-600 dark:border-[#3a3a3a] dark:text-zinc-400"
                iconClassName="h-3.5 w-3.5"
              />
              <PlayNextButton
                targetId={track.id}
                tracks={targetTracks}
                compact
              />
              <AddToPlaylistButton
                musicId={track.id}
                musicTitle={track.title}
                compact
              />
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderPlaylistCard = (track: MusicTrack) => {
    const active = isMusicTrackActive(track, currentTrack);
    const playing = active && isPlaying;
    const isExpanded = Boolean(expandedPlaylists[track.id]);
    const childTracks = track.playlistTracks;
    const visibleTracks = isExpanded ? childTracks.slice(0, PLAYLIST_MAX_VISIBLE) : childTracks.slice(0, PLAYLIST_PREVIEW_COUNT);
    const hasMoreTracks = childTracks.length > PLAYLIST_PREVIEW_COUNT;

    return (
      <article
        key={track.id}
        className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:bg-[#171717] ${
          active
            ? "border-pink-400 ring-1 ring-pink-300/50 dark:border-pink-700 dark:ring-pink-900/30"
            : "border-slate-200 dark:border-[#2d2d2d]"
        }`}
      >
        <div className="flex gap-4 p-4">
          {/* Thumbnail + Play button */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28 dark:bg-[#242424]">
            <Image
              src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
              alt={track.title || "thumbnail"}
              width={224}
              height={224}
              unoptimized
              className="h-full w-full object-cover"
            />
            <button
              onClick={() => handlePlayOrToggle(track)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100"
              aria-label={playing ? t("pauseNow") : t("playNow")}
            >
              {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
            </button>
            <div className="absolute left-1 top-1 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              <ListMusic className="h-3 w-3" /> {childTracks.length}
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/music/${track.slug}`}
                  className="block truncate text-base font-black text-slate-900 hover:text-pink-600 dark:text-zinc-100"
                >
                  {track.title}
                </Link>
                <p className="truncate text-sm text-slate-500 dark:text-zinc-400">{track.artist}</p>
              </div>
              {track.updatedAt ? (
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#242424] dark:text-zinc-400">
                  {new Date(track.updatedAt!).toLocaleDateString()}
                </span>
              ) : null}
            </div>

            {track.description ? (
              <p className="line-clamp-1 text-xs text-slate-500 dark:text-zinc-400">{track.description}</p>
            ) : null}

            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
              <Clock3 className="h-3 w-3" />{" "}
              {formatMusicDuration(track.audioDuration)}
              <span className="ml-2 font-semibold text-pink-600 dark:text-pink-300">{t("tracksCount", { count: childTracks.length })}</span>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Headphones className="h-3 w-3" /> {formatCompactCount(track.playCount)}
              </span>
              <MusicLikeButton
                musicId={track.id}
                initialLiked={false}
                likeCount={track.likeCount}
                compact
              />
              <ShareActionButton
                title={track.title}
                text={`${track.title} - ${track.artist}`}
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/music/${track.slug}`}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-pink-600 dark:text-zinc-400"
                iconClassName="h-3 w-3"
              />
            </div>
          </div>
        </div>

        {/* Playlist child tracks */}
        <div className={`border-t border-slate-100 dark:border-[#2a2a2a] ${isExpanded && childTracks.length > PLAYLIST_MAX_VISIBLE ? "max-h-[420px] overflow-y-auto" : ""}`}>
          {visibleTracks.map((child, index) => {
            const childActive = currentTrack?.id?.includes(child.id);
            const childPlaying = childActive && isPlaying;

            return (
              <div
                key={`${track.id}-${child.id}-${index}`}
                className="group/child flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 transition hover:bg-slate-50 last:border-b-0 dark:border-[#222] dark:hover:bg-[#1e1e1e]"
              >
                <button
                  onClick={() => handlePlayPlaylistItem(track, index + (isExpanded ? 0 : 0))}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    childPlaying
                      ? "bg-pink-500 text-white"
                        : "bg-slate-100 text-slate-600 group-hover/child:bg-pink-100 group-hover/child:text-pink-600 dark:bg-[#2a2a2a] dark:text-zinc-300"
                  }`}
                >
                  {childPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
                </button>

                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-[#2a2a2a]">
                  <Image
                    src={child.thumbnailUrl || track.thumbnailUrl || "/thumbnaildefault.jpg"}
                    alt={child.title}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </div>

                <span className="w-6 shrink-0 text-center text-[11px] font-bold text-slate-400 dark:text-zinc-500">{index + 1}</span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">{child.title}</p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">{child.artist}</p>
                </div>

                <span className="hidden shrink-0 text-[11px] text-slate-500 sm:block dark:text-zinc-400">
                  {formatMusicDuration(child.audioDuration)}
                </span>

                {/* Hover actions */}
                <div className="flex items-center gap-1 opacity-0 transition group-hover/child:opacity-100">
                  <MusicLikeButton
                    musicId={child.id}
                    initialLiked={false}
                    likeCount={child.likeCount}
                    compact
                  />
                  <ShareActionButton
                    title={child.title}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-orange-500"
                    iconClassName="h-3 w-3"
                  />
                  <AddToPlaylistButton
                    musicId={child.id}
                    musicTitle={child.title}
                    compact
                    className="!h-7 !w-7"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand/collapse */}
        {hasMoreTracks ? (
          <div className="border-t border-slate-100 px-4 py-2.5 dark:border-[#2a2a2a]">
            <button
              onClick={() => toggleExpand(track.id)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-black uppercase tracking-[0.12em] text-pink-600 transition hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-950/20"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> {t("collapsePlaylist")}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> {t("expandPlaylist", { count: childTracks.length })}
                </>
              )}
            </button>
          </div>
        ) : null}
      </article>
    );
  };

  // ─── Main JSX ─────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 pb-40">
      {/* Hero */}
      <section className="overflow-hidden rounded-[32px] border border-pink-200/70 bg-gradient-to-br from-pink-50 via-rose-50 to-white p-6 text-slate-900 shadow-sm sm:p-8 dark:border-pink-900/30 dark:from-[#2a101a] dark:via-[#1d1117] dark:to-[#121212] dark:text-zinc-100">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-pink-500 dark:text-pink-300">{t("heroEyebrow")}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{t("heroTitle")}</h1>
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-zinc-300">{t("heroDescription")}</p>
          </div>

          <div className="rounded-2xl border border-pink-300/70 bg-white/70 px-4 py-3 text-right backdrop-blur dark:border-pink-900/50 dark:bg-black/20">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-500 dark:text-pink-300">{t("deckStats")}</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{total || tracks.length}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("tracksOnline")}</p>
          </div>
        </div>
      </section>

      {/* Grid: sidebar + main */}
      <section className="grid gap-6 xl:grid-cols-[minmax(260px,28%)_minmax(0,72%)]">
        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Search */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">{t("searchLabel")}</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("trackListTitle")}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-medium outline-none transition focus:border-pink-400 focus:bg-white dark:border-[#303030] dark:bg-[#101010] dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">{t("tagsLabel")}</p>
              {activeTag !== "all" ? (
                <button
                  onClick={() => setActiveTag("all")}
                  className="text-[11px] font-bold text-pink-500 hover:underline"
                >
                  {t("resetFilter")}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => setActiveTag(tag.key === activeTag ? "all" : tag.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                    tag.key === activeTag
                      ? "border-pink-400 bg-pink-500 text-white dark:border-pink-600"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-pink-300 hover:text-pink-600 dark:border-[#333] dark:bg-[#1e1e1e] dark:text-zinc-300"
                  }`}
                >
                  {tag.key} <span className="ml-1 opacity-60">{tag.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trending */}
          {trendingTracks.length > 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2d2d2d] dark:bg-[#171717]">
              <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
                <Flame className="h-3.5 w-3.5 text-pink-500" /> {t("trendingTitle")}
              </p>
              <div className="space-y-2">
                {trendingTracks.map((track, index) => {
                  const isActive = isMusicTrackActive(track, currentTrack);
                  return (
                    <div key={track.id} className="group flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-slate-50 dark:hover:bg-[#1e1e1e]">
                      <span className="w-5 text-center text-xs font-black text-slate-300 dark:text-zinc-600">{index + 1}</span>
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#242424]">
                        <Image
                          src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
                          alt={track.title}
                          width={72}
                          height={72}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                        <button
                          onClick={() => handlePlayOrToggle(track)}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          {isActive && isPlaying ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-800 dark:text-zinc-100">{track.title}</p>
                        <p className="truncate text-[10px] text-slate-500 dark:text-zinc-400">{track.artist}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">{formatCompactCount(track.playCount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>

        {/* Main track list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
              {t("trackListTitle")}{" "}
              <span className="text-pink-500">({total || tracks.length})</span>
            </p>
          </div>

          {isLoadingInitial ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#1e1e1e]" />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-[#333] dark:text-zinc-400">
              {t("emptyResults")}
            </div>
          ) : (
            <div className="space-y-4">
              {flowItems.map((row) => {
                if (row.type === "ad") {
                  return (
                    <div key={row.id}>
                      <InlineAdvertisementCard ad={row.ad} />
                    </div>
                  );
                }

                const track = row.item;
                return (
                  <div key={track.id}>
                    {track.contentType === "playlist"
                      ? renderPlaylistCard(track)
                      : renderSingleCard(track)}
                  </div>
                );
              })}
            </div>
          )}

          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
              <span className="text-sm text-slate-500 dark:text-zinc-400">{t("loadMore")}</span>
            </div>
          ) : null}

          <div ref={sentinelRef} className="h-1" />
        </div>
      </section>
    </div>
  );
}
