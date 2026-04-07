"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Music2 } from "lucide-react";
import { useTranslations } from "next-intl";

import MusicStickyPlayer, { type MusicTrack } from "@/components/player/MusicStickyPlayer";
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
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [playSignal, setPlaySignal] = useState(0);

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
              category: categoryCycle[index % categoryCycle.length],
            } satisfies MusicTrack;
          })
          .filter((item) => item.audioUrl);

        const nextTracks = mapped.length > 0 ? mapped : fallbackTracks(unknownArtist);
        setTracks(nextTracks);
        setCurrentTrackId((prev) => prev ?? nextTracks[0]?.id ?? null);
      } catch {
        if (cancelled) return;

        const fallback = fallbackTracks(unknownArtist);
        setTracks(fallback);
        setCurrentTrackId((prev) => prev ?? fallback[0]?.id ?? null);
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

  const visibleTracks = useMemo(() => {
    if (selectedCategory === "All") return tracks;
    return tracks.filter((track) => track.category === selectedCategory);
  }, [selectedCategory, tracks]);

  useEffect(() => {
    if (!tracks.length) return;

    setCurrentTrackId((prev) => {
      if (!prev) return tracks[0]?.id ?? null;
      if (tracks.some((track) => track.id === prev)) return prev;
      return tracks[0]?.id ?? null;
    });
  }, [tracks]);

  const currentTrack = useMemo(() => {
    if (!currentTrackId) return tracks[0] || null;
    return tracks.find((track) => track.id === currentTrackId) || tracks[0] || null;
  }, [currentTrackId, tracks]);

  const categoryLabelMap: Record<CategoryValue, string> = {
    All: t("categoryAll"),
    Lofi: t("categoryLofi"),
    Piano: t("categoryPiano"),
    Chill: t("categoryChill"),
    Meditation: t("categoryMeditation"),
  };

  const pickCategory = (category: CategoryValue) => {
    setSelectedCategory(category);

    const candidateTracks = category === "All" ? tracks : tracks.filter((track) => track.category === category);
    if (!candidateTracks.length) return;

    if (!candidateTracks.some((track) => track.id === currentTrackId)) {
      setCurrentTrackId(candidateTracks[0]?.id ?? null);
    }
  };

  const playTrack = (track: MusicTrack) => {
    setCurrentTrackId(track.id);
    setPlaySignal((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 pb-40">
      <section className="rounded-2xl border border-[#2a2a2a] bg-gradient-to-r from-[#1f1f1f] via-[#171717] to-[#121212] p-5 text-zinc-100 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{t("heroEyebrow")}</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("heroTitle")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">{t("heroDescription")}</p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#2d2d2d] bg-[#191919] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
            <Music2 className="h-4 w-4" /> Spotify UI
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {categoryTabs.map((category) => (
            <button
              key={category}
              onClick={() => pickCategory(category)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedCategory === category
                  ? "bg-[#1db954] text-black"
                  : "bg-[#1f1f1f] text-zinc-200 hover:bg-[#292929]"
              }`}
            >
              {categoryLabelMap[category]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100 sm:text-xl">{t("trackListTitle")}</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{categoryLabelMap[selectedCategory]}</p>
        </div>

        {isLoadingTracks ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-[#252525] bg-[#181818] p-2">
                <div className="aspect-square rounded-lg bg-[#2a2a2a]" />
                <div className="mt-2 h-4 w-4/5 rounded bg-[#2a2a2a]" />
                <div className="mt-1 h-3 w-3/5 rounded bg-[#252525]" />
              </div>
            ))}
          </div>
        ) : visibleTracks.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visibleTracks.map((track) => {
              const isActive = currentTrack?.id === track.id;

              return (
                <button
                  key={track.id}
                  onClick={() => playTrack(track)}
                  className={`group rounded-xl border p-2 text-left transition ${
                    isActive
                      ? "border-[#1db954] bg-[#1a2b21]"
                      : "border-[#252525] bg-[#181818] hover:border-[#353535] hover:bg-[#202020]"
                  }`}
                >
                  <div className="aspect-square overflow-hidden rounded-lg">
                    <Image
                      src={track.thumbnailUrl}
                      alt={track.title}
                      width={320}
                      height={320}
                      unoptimized
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="mt-2 min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                    <p className="truncate text-xs text-zinc-400">{track.artist}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-6 text-sm text-zinc-400">{t("emptyTracks")}</div>
        )}
      </section>

      <MusicStickyPlayer
        track={currentTrack}
        playSignal={playSignal}
        labels={{
          nowPlaying: t("nowPlaying"),
          selectTrack: t("selectTrack"),
          fallbackArtist: t("fallbackArtist"),
          sleep: t("sleep"),
          minutes: t("minutesShort"),
          cancelTimer: t("cancelTimer"),
          seekBackwardAria: t("seekBackwardAria"),
          seekForwardAria: t("seekForwardAria"),
          playAria: t("playAria"),
          pauseAria: t("pauseAria"),
          muteAria: t("muteAria"),
          unmuteAria: t("unmuteAria"),
          progressAria: t("progressAria"),
          volumeAria: t("volumeAria"),
          speedTitle: t("speedTitle"),
        }}
      />
    </div>
  );
}
