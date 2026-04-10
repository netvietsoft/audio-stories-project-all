"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock3,
  Flame,
  Headphones,
  Heart,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";

import AddToPlaylistModal from "@/components/music/AddToPlaylistModal";
import InlineAdvertisementCard from "@/components/ads/InlineAdvertisementCard";
import ShareActionButton from "@/components/shared/ShareActionButton";
import Link from "@/components/shared/LocalizedLink";
import { useActiveAdvertisements } from "@/hooks/use-active-advertisements";
import { useDebounce } from "@/hooks/useDebounce";
import { apiClient } from "@/lib/api/api-client";
import {
  formatCompactCount,
  formatMusicDuration,
  normalizeMusicItem,
} from "@/lib/music/normalize-music";
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

const toSingleQueueTrack = (track: MusicTrack) => ({
  id: track.id,
  title: track.title,
  author: track.artist,
  audioUrl: track.audioUrl,
  coverUrl: track.thumbnailUrl || "/thumbnaildefault.jpg",
});

const toPlaylistQueue = (track: MusicTrack) =>
  track.playlistTracks.map((item, index) => ({
    id: `playlist:${track.id}:${item.id}:${index}`,
    title: item.title,
    author: item.artist,
    audioUrl: item.audioUrl,
    coverUrl: item.thumbnailUrl || track.thumbnailUrl || "/thumbnaildefault.jpg",
  }));

const toGlobalQueue = (tracks: MusicTrack[]) =>
  tracks.flatMap((track) => (track.contentType === "playlist" ? toPlaylistQueue(track) : [toSingleQueueTrack(track)]));

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
  const [playlistTargetTrack, setPlaylistTargetTrack] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 350);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastPlayPingRef = useRef<Map<string, number>>(new Map());

  const accessToken = useUserStore((state) => state.accessToken);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const enqueueNext = useAudioStore((state) => state.enqueueNext);
  const enqueueManyNext = useAudioStore((state) => state.enqueueManyNext);

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

  const queueForStore = useMemo(() => toGlobalQueue(tracks), [tracks]);

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

  const isTrackActive = useCallback(
    (track: MusicTrack) => {
      if (!currentTrack) return false;
      if (track.contentType === "single") {
        return currentTrack.id === track.id;
      }

      return toPlaylistQueue(track).some((item) => item.id === currentTrack.id);
    },
    [currentTrack],
  );

  const currentTrackStats = useMemo(() => {
    if (!currentTrack) return null;

    const singleMatch = tracks.find((track) => track.id === currentTrack.id);
    if (singleMatch) return singleMatch;

    return (
      tracks.find((track) => track.contentType === "playlist" && toPlaylistQueue(track).some((item) => item.id === currentTrack.id)) ||
      null
    );
  }, [currentTrack, tracks]);

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
      await apiClient.post(`/music/${targetId}/play`);
      if (accessToken) {
        await apiClient.post(`/music/interactions/${targetId}/history`);
      }
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

  const handlePlayNext = (track: MusicTrack) => {
    if (track.contentType === "playlist") {
      const playlistQueue = toPlaylistQueue(track);
      if (playlistQueue.length) {
        enqueueManyNext(playlistQueue);
      }
      return;
    }

    enqueueNext(toSingleQueueTrack(track));
  };

  const flowItems = useMemo(() => {
    const items: Array<{ type: "track"; track: MusicTrack } | { type: "ad"; id: string; ad: AdvertisementItem }> = [];

    tracks.forEach((track, index) => {
      items.push({ type: "track", track });

      if ((index + 1) % 6 === 0 && activeAds.length > 0) {
        const ad = activeAds[Math.floor(index / 6) % activeAds.length];
        if (ad) {
          items.push({
            type: "ad",
            id: `ad-${track.id}-${index}`,
            ad,
          });
        }
      }
    });

    return items;
  }, [activeAds, tracks]);

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
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{total || tracks.length}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("tracksOnline")}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(260px,28%)_minmax(0,72%)]">
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
                      <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{t("playsLabel", { count: formatCompactCount(track.playCount) })}</p>
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
                {t("tracksCount", { count: total || tracks.length })}
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-slate-600 dark:bg-[#222] dark:text-zinc-300">
              {activeTag === "all" ? t("allTags") : `#${activeTag}`}
            </div>
          </div>

          {isLoadingInitial ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#222]" />
              ))}
            </div>
          ) : tracks.length ? (
            <div className="space-y-3 p-4 sm:p-6">
              {flowItems.map((item) => {
                if (item.type === "ad") {
                  return <InlineAdvertisementCard key={item.id} ad={item.ad} />;
                }

                const track = item.track;
                const isActive = isTrackActive(track);
                const isRowPlaying = isActive && isPlaying;
                const progressPercent = isActive && duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
                const isExpanded = Boolean(expandedPlaylists[track.id]);
                const previewTracks = track.playlistTracks.slice(0, isExpanded ? 10 : 5);

                return (
                  <article
                    key={track.id}
                    className={`rounded-2xl border px-4 py-4 transition sm:px-5 ${
                      isActive
                        ? "border-orange-300 bg-orange-50/60 dark:border-orange-800/60 dark:bg-orange-950/20"
                        : "border-slate-200 hover:border-orange-200 hover:bg-slate-50/80 dark:border-[#2f2f2f] dark:hover:bg-[#1f1f1f]"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <button
                        onClick={() => handlePlayOrToggle(track)}
                        aria-label={isRowPlaying ? t("pauseAria") : t("playAria")}
                        className="relative h-[110px] w-full overflow-hidden rounded-2xl bg-slate-100 lg:h-[120px] lg:w-[180px]"
                      >
                        <Image
                          src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
                          alt={track.title}
                          width={360}
                          height={240}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${isRowPlaying ? "bg-orange-500" : "bg-black/65"} text-white`}>
                            {isRowPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                          </span>
                        </span>
                      </button>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`truncate text-lg font-black ${isActive ? "text-orange-600 dark:text-orange-300" : "text-slate-900 dark:text-zinc-100"}`}>
                            {track.title}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                              track.contentType === "playlist"
                                ? "bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            }`}
                          >
                            {track.contentType === "playlist" ? t("playlistBadge") : t("singleBadge")}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                            <Clock3 className="h-3.5 w-3.5" /> {t("updatedAt")}: {new Date(track.updatedAt || track.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="line-clamp-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">{track.description?.trim() || track.artist}</p>

                        <div className="flex flex-wrap gap-2">
                          {track.tags.slice(0, 4).map((tag) => (
                            <button
                              key={`${track.id}-${tag}`}
                              onClick={() => setActiveTag(tag.toLowerCase())}
                              className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-200 dark:bg-orange-950/30 dark:text-orange-300"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Headphones className="h-3.5 w-3.5" /> {formatCompactCount(track.playCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5" /> {formatCompactCount(track.likeCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" /> {formatMusicDuration(track.audioDuration)}
                          </span>
                          {track.contentType === "playlist" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] dark:bg-[#222]">
                              <ListMusic className="h-3.5 w-3.5" /> {t("playlistTracks", { count: track.playlistTracks.length })}
                            </span>
                          ) : null}
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-[#2a2a2a]">
                          <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>

                        {track.contentType === "playlist" && track.playlistTracks.length ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#2f2f2f] dark:bg-[#111]">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                                {t("playlistTracks", { count: track.playlistTracks.length })}
                              </p>
                              {track.playlistTracks.length > 5 ? (
                                <button
                                  onClick={() =>
                                    setExpandedPlaylists((prev) => ({
                                      ...prev,
                                      [track.id]: !prev[track.id],
                                    }))
                                  }
                                  className="text-[11px] font-bold uppercase tracking-[0.12em] text-orange-600 hover:text-orange-700"
                                >
                                  {isExpanded ? t("collapseList") : t("expandList")}
                                </button>
                              ) : null}
                            </div>

                            <div className={`space-y-1.5 ${isExpanded ? "max-h-56 overflow-y-auto pr-1" : ""}`}>
                              {previewTracks.map((item, index) => (
                                <button
                                  key={`${track.id}-${item.id}-${index}`}
                                  onClick={() => {
                                    const playlistQueue = toPlaylistQueue(track);
                                    const selectedTrack = playlistQueue[index];

                                    if (!selectedTrack) return;

                                    playTrack(selectedTrack, playlistQueue);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white dark:hover:bg-[#1f1f1f]"
                                >
                                  <span className="w-5 shrink-0 text-[11px] font-black text-slate-400">{index + 1}</span>
                                  <span className="truncate text-xs font-semibold text-slate-700 dark:text-zinc-200">{item.title}</span>
                                  <span className="ml-auto shrink-0 text-[11px] text-slate-500 dark:text-zinc-400">{formatMusicDuration(item.audioDuration)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-[176px] lg:flex-col">
                        <button
                          onClick={() => handlePlayOrToggle(track)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600 lg:flex-none"
                        >
                          {isRowPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          {isRowPlaying ? t("pauseAria") : t("playAria")}
                        </button>

                        <button
                          onClick={() => handlePlayNext(track)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-orange-300 hover:text-orange-600 dark:border-[#343434] dark:bg-[#1b1b1b] dark:text-zinc-200"
                        >
                          <Plus className="h-3.5 w-3.5" /> {t("playNext")}
                        </button>

                        <ShareActionButton
                          title={track.title}
                          text={track.description || track.artist}
                          label={t("share")}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-orange-300 hover:text-orange-600 dark:border-[#343434] dark:bg-[#1b1b1b] dark:text-zinc-200"
                          iconClassName="h-3.5 w-3.5"
                        />

                        <button
                          onClick={() => setPlaylistTargetTrack({ id: track.id, title: track.title })}
                          disabled={track.contentType === "playlist"}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-pink-300 bg-pink-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-pink-700 transition hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300 lg:flex-none"
                        >
                          <Plus className="h-3.5 w-3.5" /> {track.contentType === "playlist" ? t("playlistOnlyHint") : t("playlist")}
                        </button>

                        <Link
                          href={`/music/${track.id}`}
                          className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-orange-300 hover:text-orange-600 dark:border-[#343434] dark:text-zinc-300 lg:flex-none"
                        >
                          {t("detail")}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}

              <div ref={sentinelRef} className="h-1 w-full" />

              {isLoadingMore ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 dark:border-[#2f2f2f] dark:bg-[#111] dark:text-zinc-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("loadingMore")}
                </div>
              ) : null}

              {!isLoadingMore && page >= lastPage ? (
                <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">{t("noMore")}</p>
              ) : null}
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
