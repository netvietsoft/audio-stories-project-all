"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Music2, Grid, List, Play, Pause } from "lucide-react";
import { useTranslations } from "next-intl";

import GlobalPlayer from "@/components/player/GlobalPlayer";
import MusicCard, { type MusicCardTrack } from "@/components/player/MusicCard";
import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";

const categoryCycle = ["Lofi", "Piano", "Chill", "Meditation"] as const;
const categoryTabs = ["All", ...categoryCycle] as const;

type CategoryValue = (typeof categoryTabs)[number];

type MusicApiItem = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  audioUrl: string;
};

type MusicApiResponse = {
  data: MusicApiItem[];
};

type MusicTrack = MusicCardTrack & {
  audioUrl: string;
  category: (typeof categoryCycle)[number];
};

const fallbackTracks = (unknownArtist: string): MusicTrack[] => [
  {
    id: "fallback-1",
    title: "Night Rain Lofi",
    artist: unknownArtist,
    category: "Lofi",
    thumbnailUrl: "https://picsum.photos/seed/music-fallback-1/800/800",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "fallback-2",
    title: "Piano Sunrise",
    artist: unknownArtist,
    category: "Piano",
    thumbnailUrl: "https://picsum.photos/seed/music-fallback-2/800/800",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "fallback-3",
    title: "Coastline Drift",
    artist: unknownArtist,
    category: "Chill",
    thumbnailUrl: "https://picsum.photos/seed/music-fallback-3/800/800",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    id: "fallback-4",
    title: "Deep Breath",
    artist: unknownArtist,
    category: "Meditation",
    thumbnailUrl: "https://picsum.photos/seed/music-fallback-4/800/800",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
];

export default function MusicPage() {
  const t = useTranslations("MusicPage");

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryValue>("All");
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const _loadedDur = useRef(new Set<string>());

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const setQueue = useAudioStore((state) => state.setQueue);
  const setTrack = useAudioStore((state) => state.setTrack);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);

  const unknownArtist = t("unknownArtist");
  const selectTrackLabel = t("selectTrack");

  useEffect(() => {
    const audioStore = useAudioStore.getState();
    audioStore.togglePlay(false);
    audioStore.setTrack(null);

    document.querySelectorAll("audio").forEach((node) => {
      if (!node.paused) {
        node.pause();
      }
    });
  }, []);

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
          .map((item, index) => {
            return {
              id: item.id,
              title: item.title?.trim() || `${selectTrackLabel} ${index + 1}`,
              artist: item.artist?.trim() || unknownArtist,
              thumbnailUrl: item.thumbnailUrl || "/thumbnaildefault.jpg",
              audioUrl: item.audioUrl,
              category: categoryCycle[index % categoryCycle.length] as MusicTrack["category"],
            } satisfies MusicTrack;
          })
          .filter((item) => item.audioUrl) as MusicTrack[];

        const nextTracks = mapped.length > 0 ? mapped : fallbackTracks(unknownArtist);
        setTracks(nextTracks);
      } catch {
        if (cancelled) return;

        const fallback = fallbackTracks(unknownArtist);
        setTracks(fallback);
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
  }, [selectTrackLabel, unknownArtist]);

  const queueForStore = useMemo(
    () =>
      tracks.map((track) => ({
        id: track.id,
        title: track.title,
        author: track.artist,
        audioUrl: track.audioUrl,
        coverUrl: track.thumbnailUrl,
      })),
    [tracks],
  );

  useEffect(() => {
    if (!queueForStore.length) return;
    setQueue(queueForStore);

    if (!currentTrack || !queueForStore.some((item) => item.id === currentTrack.id)) {
      setTrack(queueForStore[0] ?? null);
      togglePlay(false);
    }
  }, [currentTrack, queueForStore, setQueue, setTrack, togglePlay]);

  const visibleTracks = useMemo(() => {
    if (selectedCategory === "All") return tracks;
    return tracks.filter((track) => track.category === selectedCategory);
  }, [selectedCategory, tracks]);

  const categoryLabelMap: Record<CategoryValue, string> = {
    All: t("categoryAll"),
    Lofi: t("categoryLofi"),
    Piano: t("categoryPiano"),
    Chill: t("categoryChill"),
    Meditation: t("categoryMeditation"),
  };

  const pickCategory = (category: CategoryValue) => {
    setSelectedCategory(category);
  };

  const playOrToggleTrack = (track: MusicTrack) => {
    const mappedTrack = {
      id: track.id,
      title: track.title,
      author: track.artist,
      audioUrl: track.audioUrl,
      coverUrl: track.thumbnailUrl,
    };

    if (currentTrack?.id === track.id) {
      togglePlay(!isPlaying);
      return;
    }

    playTrack(mappedTrack, queueForStore);
  };

  const selectTrack = (track: MusicTrack) => {
    setTrack({
      id: track.id,
      title: track.title,
      author: track.artist,
      audioUrl: track.audioUrl,
      coverUrl: track.thumbnailUrl,
    });
    togglePlay(false);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || !isFinite(seconds) || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Load metadata durations (preload metadata only) for visible tracks
  useEffect(() => {
    const loaders: HTMLAudioElement[] = [];

    visibleTracks.forEach((track) => {
      if (!track.audioUrl) return;
      if (_loadedDur.current.has(track.id)) return;
      _loadedDur.current.add(track.id);

      try {
        const a = new Audio();
        a.preload = "metadata";
        a.src = track.audioUrl;

        const onLoaded = () => {
          setDurations((prev) => ({ ...prev, [track.id]: isFinite(a.duration) ? a.duration : 0 }));
          a.removeEventListener("loadedmetadata", onLoaded);
          a.removeEventListener("error", onError);
        };

        const onError = () => {
          a.removeEventListener("loadedmetadata", onLoaded);
          a.removeEventListener("error", onError);
        };

        a.addEventListener("loadedmetadata", onLoaded);
        a.addEventListener("error", onError);
        loaders.push(a);
      } catch {
        // ignore per-track errors
      }
    });

    return () => {
      loaders.forEach((a) => {
        try {
          a.src = "";
        } catch {}
      });
    };
  }, [visibleTracks]);

  return (
    <div className="space-y-6 pb-40">
      <section className="rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-100 via-pink-50 to-white p-5 text-gray-900 sm:p-7 dark:border-pink-900/40 dark:from-[#2a1720] dark:via-[#20171b] dark:to-[#161616] dark:text-zinc-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-pink-500 dark:text-pink-300">{t("heroEyebrow")}</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("heroTitle")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-700 dark:text-zinc-300">{t("heroDescription")}</p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-pink-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-pink-700 dark:border-pink-900/50 dark:bg-[#1f1f1f] dark:text-pink-300">
            <Music2 className="h-4 w-4" /> Spotify UI
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {categoryTabs.map((category) => (
              <button
                key={category}
                onClick={() => pickCategory(category)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedCategory === category
                    ? "bg-pink-600 text-white"
                    : "bg-white text-gray-700 hover:bg-pink-50 dark:bg-[#1f1f1f] dark:text-zinc-200 dark:hover:bg-[#292929]"
                }`}
              >
                {categoryLabelMap[category]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Grid view"
              title={t("viewGrid")}
              onClick={() => setViewType("grid")}
              className={`rounded-full p-2 transition ${
                viewType === "grid" ? "bg-pink-600 text-white" : "bg-white text-pink-600 hover:bg-pink-50 dark:bg-[#1f1f1f] dark:text-pink-300"
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>

            <button
              aria-label="List view"
              title={t("viewList")}
              onClick={() => setViewType("list")}
              className={`rounded-full p-2 transition ${
                viewType === "list" ? "bg-pink-600 text-white" : "bg-white text-pink-600 hover:bg-pink-50 dark:bg-[#1f1f1f] dark:text-pink-300"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 sm:text-xl">{t("trackListTitle")}</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-pink-500 dark:text-pink-300">{categoryLabelMap[selectedCategory]}</p>
        </div>

        {isLoadingTracks ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-pink-100 bg-white p-2 dark:border-[#252525] dark:bg-[#181818]">
                <div className="aspect-square rounded-lg bg-pink-100 dark:bg-[#2a2a2a]" />
                <div className="mt-2 h-4 w-4/5 rounded bg-pink-100 dark:bg-[#2a2a2a]" />
                <div className="mt-1 h-3 w-3/5 rounded bg-pink-50 dark:bg-[#252525]" />
              </div>
            ))}
          </div>
        ) : visibleTracks.length > 0 ? (
          viewType === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleTracks.map((track) => {
                const isActive = currentTrack?.id === track.id;
                const cardPlaying = isActive && isPlaying;

                return (
                  <MusicCard
                    key={track.id}
                    track={track}
                    isActive={isActive}
                    isPlaying={cardPlaying}
                    mobilePlayBottomRight={true}
                    playAriaLabel={`${t("playAria")}: ${track.title}`}
                    pauseAriaLabel={`${t("pauseAria")}: ${track.title}`}
                    onSelect={() => selectTrack(track)}
                    onPlayPause={() => playOrToggleTrack(track)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleTracks.map((track, idx) => {
                const isActive = currentTrack?.id === track.id;
                const playing = isActive && isPlaying;
                return (
                  <div
                    key={track.id}
                    className={`group flex items-center gap-4 rounded-lg px-4 py-3 transition hover:bg-pink-500/10 ${
                      playing ? "bg-pink-50" : "bg-transparent"
                    }`}
                  >
                    <div className="w-8 text-sm font-mono text-gray-500 dark:text-zinc-400">{String(idx + 1).padStart(2, "0")}</div>

                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative">
                        <img
                          src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
                          alt={track.title}
                          className={`h-14 w-14 rounded-md object-cover`}
                        />

                        {playing && (
                          <div className="absolute left-0 right-0 bottom-0 flex items-end justify-center pb-1 pointer-events-none z-20">
                            <div className="wave-bars large text-pink-500 dark:text-pink-300" style={{ width: 64, height: 40 }}>
                              <span className="wave-bar" />
                              <span className="wave-bar" />
                              <span className="wave-bar" />
                              <span className="wave-bar" />
                              <span className="wave-bar" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className={`truncate font-medium ${isActive ? "text-pink-500 dark:text-pink-300" : "text-gray-900 dark:text-zinc-100"}`}>{track.title}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-zinc-400">{track.artist}</div>
                      </div>
                    </div>

                    <div className="ml-auto mr-4 hidden text-sm text-gray-500 dark:text-zinc-400 sm:block">{formatDuration(durations[track.id])}</div>

                    <div>
                      <button
                        aria-label={playing ? t("pauseAria") : t("playAria")}
                        onClick={() => playOrToggleTrack(track)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                          playing ? "bg-pink-600 text-white" : "bg-pink-50 text-pink-600 hover:bg-pink-100 dark:bg-[#1f1f1f] dark:text-pink-300"
                        }`}
                      >
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-pink-200 bg-pink-50 p-6 text-sm text-pink-700 dark:border-[#2b2b2b] dark:bg-[#171717] dark:text-zinc-400">{t("emptyTracks")}</div>
        )}
      </section>

      <GlobalPlayer />
    </div>
  );
}
