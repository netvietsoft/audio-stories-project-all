"use client";

import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export default function GlobalPlayer() {
  const t = useTranslations("Player");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const lastSyncedProgressRef = useRef<Map<string, number>>(new Map());

  const accessToken = useUserStore((state) => state.accessToken);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const seekTarget = useAudioStore((state) => state.seekTarget);

  const setTrack = useAudioStore((state) => state.setTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const playNext = useAudioStore((state) => state.playNext);
  const playPrev = useAudioStore((state) => state.playPrev);
  const seekTo = useAudioStore((state) => state.seekTo);
  const clearSeekTarget = useAudioStore((state) => state.clearSeekTarget);
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime);
  const setDuration = useAudioStore((state) => state.setDuration);
  const setVolume = useAudioStore((state) => state.setVolume);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  const speedOptions = [0.75, 1, 1.25, 1.5, 2] as const;

  const syncHistory = useCallback(
    async (force = false) => {
      if (!accessToken || !currentTrack) return;

      const storyId = currentTrack.storyId;
      const chapterId = currentTrack.chapterId || currentTrack.id;
      if (!storyId || !chapterId) return;

      const liveTime = Math.floor(audioRef.current?.currentTime || 0);
      if (!force && liveTime < 3) return;

      const key = `${storyId}:${chapterId}`;
      const lastSynced = lastSyncedProgressRef.current.get(key) || 0;
      if (!force && liveTime <= lastSynced) return;

      try {
        await apiClient.post("/history/sync", {
          storyId,
          chapterId,
          progressSeconds: liveTime,
        });
        lastSyncedProgressRef.current.set(key, liveTime);
      } catch {
        // Keep player resilient if history sync is temporarily unavailable.
      }
    },
    [accessToken, currentTrack],
  );

  const cycleSpeed = () => {
    const currentIndex = speedOptions.findIndex((item) => item === playbackRate);
    const nextIndex = currentIndex < 0 ? 1 : (currentIndex + 1) % speedOptions.length;
    const nextRate = speedOptions[nextIndex] ?? 1;
    setPlaybackRate(nextRate);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      playNext();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audioRef.current = null;
    };
  }, [mounted, playNext, setCurrentTime, setDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      audio.load();
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack || !currentTrack.audioUrl) {
      audio.pause();
      return;
    }

    if (isPlaying) {
      void audio.play().catch(() => {
        togglePlay(false);
      });
      return;
    }

    audio.pause();
  }, [currentTrack, isPlaying, togglePlay]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTarget === null) return;
    audio.currentTime = seekTarget;
    setCurrentTime(seekTarget);
    clearSeekTarget();
  }, [clearSeekTarget, seekTarget, setCurrentTime]);

  useEffect(() => {
    if (!isPlaying) {
      void syncHistory(true);
      return;
    }

    const timer = setInterval(() => {
      void syncHistory(false);
    }, 10_000);

    return () => {
      clearInterval(timer);
      void syncHistory(true);
    };
  }, [isPlaying, syncHistory]);

  useEffect(() => {
    return () => {
      void syncHistory(true);
    };
  }, [syncHistory]);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  if (!mounted || !currentTrack) {
    return null;
  }

  const chapterHref =
    currentTrack.storySlug && currentTrack.chapterNumber
      ? `/story/${currentTrack.storySlug}/chuong-${currentTrack.chapterNumber}`
      : currentTrack.storySlug
        ? `/story/${currentTrack.storySlug}`
        : undefined;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/85 px-3 py-2 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/85 sm:px-4 transition-transform duration-300 ${isVisible ? "translate-y-0" : "translate-y-full"}`}>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        {chapterHref ? (
          <Link href={chapterHref} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 transition hover:bg-gray-100/80 dark:hover:bg-gray-800/70">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-800">
              {currentTrack.coverUrl ? (
                <Image
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  width={40}
                  height={40}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
              {/* Mobile Play/Pause Overlay */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePlay(!isPlaying);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20 text-white sm:hidden"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{currentTrack.title}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{currentTrack.author || t("defaultAuthor")}</p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-800">
              {currentTrack.coverUrl ? (
                <Image
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  width={40}
                  height={40}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{currentTrack.title}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{currentTrack.author || t("defaultAuthor")}</p>
            </div>
          </div>
        )}

        <div className="hidden items-center gap-2 sm:flex">
          <button onClick={playPrev} className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={() => togglePlay(!isPlaying)}
            className="rounded-full bg-blue-600 p-2.5 text-white hover:bg-blue-700"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={playNext} className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden w-full max-w-sm items-center gap-2 md:flex">
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="w-full accent-blue-600"
            aria-label={t("audioProgress")}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={cycleSpeed}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            title={t("speedTitle")}
          >
            {playbackRate}x
          </button>
          <button
            onClick={() => toggleMute()}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="hidden w-20 accent-blue-600 md:block"
            aria-label={t("volume")}
          />
          <button
            onClick={() => {
              void syncHistory(true);
              togglePlay(false);
              setTrack(null);
            }}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800 md:hidden">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
