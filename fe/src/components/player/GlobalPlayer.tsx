"use client";

import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, ChevronUp, Music2, Pause, Play, SkipBack, SkipForward, Timer, Volume2, VolumeX } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { getOrCreateDeviceId } from "@/lib/tracking/device-id";
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
  const safeT = (key: string, fallback: string) => {
    try {
      // next-intl may throw if key missing at runtime; guard and fallback
      return (t as unknown as (k: string) => string)(key);
    } catch {
      return fallback;
    }
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepMenuRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const lastSyncedProgressRef = useRef<Map<string, number>>(new Map());
  const listenTrackedRef = useRef<Map<string, boolean>>(new Map());

  const accessToken = useUserStore((state) => state.accessToken);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const seekTarget = useAudioStore((state) => state.seekTarget);

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

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }

      if (!minutes) {
        setSleepMinutesLeft(null);
        setShowSleepMenu(false);
        return;
      }

      setSleepMinutesLeft(minutes);
      sleepTimerRef.current = setTimeout(() => {
        togglePlay(false);
        setSleepMinutesLeft(null);
        sleepTimerRef.current = null;
      }, minutes * 60_000);
      setShowSleepMenu(false);
    },
    [togglePlay],
  );

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

  useEffect(() => {
    if (!currentTrack || !isPlaying) return;

    const storyId = currentTrack.storyId;
    const chapterId = currentTrack.chapterId || currentTrack.id;
    if (!storyId || !chapterId) return;

    const key = `${storyId}:${chapterId}`;
    if (listenTrackedRef.current.get(key)) return;

    const timer = window.setTimeout(() => {
      const deviceId = getOrCreateDeviceId();
      if (!deviceId) return;

      void apiClient
        .post("/tracking/listen", {
          storyId,
          chapterId,
          deviceId,
        })
        .then(() => {
          listenTrackedRef.current.set(key, true);
        })
        .catch(() => {
          // Ignore tracking failures to keep playback uninterrupted.
        });
    }, 10_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentTrack, isPlaying]);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const [isVisible, setIsVisible] = useState(true);
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollYRef.current + 2 && currentScrollY > 80) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollYRef.current - 2 || currentScrollY <= 80) {
        setIsVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(
    () => () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!sleepMinutesLeft) return;

    const timer = setInterval(() => {
      setSleepMinutesLeft((prev) => {
        if (!prev) return null;
        if (prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, [sleepMinutesLeft]);

  useEffect(() => {
    if (!showSleepMenu) return;

    const onOutside = (event: MouseEvent) => {
      if (sleepMenuRef.current && !sleepMenuRef.current.contains(event.target as Node)) {
        setShowSleepMenu(false);
      }
    };

    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [showSleepMenu]);

  useEffect(() => {
    if (!currentTrack) {
      setShowSleepMenu(false);
    }
  }, [currentTrack]);

  if (!mounted) {
    return null;
  }

  const hasTrack = Boolean(currentTrack);
  const isStoryTrack = Boolean(currentTrack?.storyId);
  const isMusicTrack = hasTrack && !isStoryTrack;

  const chapterHref =
    hasTrack && currentTrack?.storySlug && currentTrack.chapterNumber
      ? `/story/${currentTrack.storySlug}/chuong-${currentTrack.chapterNumber}`
      : hasTrack && currentTrack?.storySlug
        ? `/story/${currentTrack.storySlug}`
        : undefined;

  const resolvedCoverUrl = currentTrack?.coverUrl || currentTrack?.storyCoverUrl || "/thumbnaildefault.jpg";
  const displayTitle = hasTrack ? currentTrack!.title : safeT("emptyTitle", "Choose something to start listening");
  const displaySubtitle = hasTrack
    ? currentTrack!.author || t("defaultAuthor")
    : safeT("emptySubtitle", "Would you like music or an audio story?");

  const accentRgb = isMusicTrack ? "236 72 153" : "75 85 99";
  const progressPercent = hasTrack ? progress : 0;
  const volumePercent = Math.round(Math.max(0, Math.min(1, volume)) * 100);

  const shellClass = isMusicTrack
    ? "bg-pink-50/95 border-t border-pink-200/80 dark:bg-[#2a1720]/95 dark:border-pink-900/40"
    : "bg-gray-50/90 border-t border-gray-200/70 dark:bg-[#242526]/95 dark:border-[#353738]";
  const hoverToneClass = isMusicTrack ? "hover:bg-pink-100/70 dark:hover:bg-pink-900/20" : "hover:bg-gray-100/80 dark:hover:bg-[#3a3b3c]";
  const ghostControlClass = isMusicTrack
    ? "text-pink-700 hover:bg-pink-100 dark:text-pink-300 dark:hover:bg-pink-900/20"
    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3b3c]";
  const pillClass = isMusicTrack
    ? "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/35"
    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-[#3a3b3c] dark:bg-[#2f3133] dark:text-gray-200 dark:hover:bg-[#3a3b3c]";
  const playButtonClass = isMusicTrack
    ? "bg-pink-600 text-white hover:bg-pink-700"
    : "bg-gray-700 text-white hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
  const thumbClass = isMusicTrack
    ? "[&::-webkit-slider-thumb]:bg-pink-500 [&::-moz-range-thumb]:bg-pink-500"
    : "[&::-webkit-slider-thumb]:bg-gray-600 [&::-moz-range-thumb]:bg-gray-600 dark:[&::-webkit-slider-thumb]:bg-zinc-100 dark:[&::-moz-range-thumb]:bg-zinc-100";
  const disabledClass = "disabled:cursor-not-allowed disabled:opacity-40";

  const handlePrev = () => {
    if (!hasTrack) return;
    playPrev();
    if (isStoryTrack) {
      togglePlay(false);
    }
  };

  const handleNext = () => {
    if (!hasTrack) return;
    playNext();
    if (isStoryTrack) {
      togglePlay(false);
    }
  };

  const handleTogglePlay = () => {
    if (!hasTrack) return;
    togglePlay(!isPlaying);
  };

  const playerIdentity = (
    <>
      <div
        className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-md ${
          isMusicTrack ? "bg-pink-100 dark:bg-pink-950/30" : "bg-gray-200 dark:bg-[#3a3b3c]"
        }`}
      >
        {hasTrack ? (
          <Image src={resolvedCoverUrl} alt={displayTitle} width={40} height={40} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500 dark:text-zinc-300">
            <BookOpen className="h-3.5 w-3.5" />
            <Music2 className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{displayTitle}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{displaySubtitle}</p>
      </div>
    </>
  );

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:px-4 transition-all duration-300 ${shellClass} ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-[72%] opacity-70"
      }`}
      style={{ "--player-accent-rgb": accentRgb } as CSSProperties}
    >
      <div className="mx-auto w-full space-y-2 lg:w-[40vw]">
        <div className="flex items-center gap-3 md:justify-center">
          {chapterHref ? (
            <Link href={chapterHref} className={`flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 transition md:flex-none md:max-w-[60%] ${hoverToneClass}`}>
              {playerIdentity}
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 md:flex-none md:max-w-[60%]">{playerIdentity}</div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <button onClick={handlePrev} disabled={!hasTrack} className={`rounded-full p-2 transition ${ghostControlClass} ${disabledClass}`}>
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={handleTogglePlay} disabled={!hasTrack} className={`rounded-full p-2.5 transition ${playButtonClass} ${disabledClass}`}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={handleNext} disabled={!hasTrack} className={`rounded-full p-2 transition ${ghostControlClass} ${disabledClass}`}>
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsExpandedMobile((prev) => !prev)}
              className={`rounded-full p-2 transition md:hidden ${ghostControlClass}`}
              aria-label={t("audioProgress")}
            >
              <ChevronUp className={`h-4 w-4 transition-transform ${isExpandedMobile ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        <div className={`${isExpandedMobile ? "flex" : "hidden"} items-center gap-2 md:flex md:mx-auto md:w-[82%] lg:w-[68%]`}>
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(hasTrack ? currentTime : 0)}</span>
          <input
            type="range"
            min={0}
            max={hasTrack ? duration || 0 : 0}
            step={1}
            value={hasTrack ? Math.min(currentTime, duration || 0) : 0}
            onChange={(event) => seekTo(Number(event.target.value))}
            disabled={!hasTrack}
            className={`time-slider h-1 w-full appearance-none rounded-full [--time-slider-track:rgb(107_114_128)] dark:[--time-slider-track:rgb(209_213_219)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 ${thumbClass} ${disabledClass}`}
            style={{
              WebkitAppearance: "none",
              appearance: "none",
              background: `linear-gradient(to right, rgb(${accentRgb}) 0%, rgb(${accentRgb}) ${progressPercent}%, var(--time-slider-track) ${progressPercent}%, var(--time-slider-track) 100%)`,
            }}
            aria-label={t("audioProgress")}
          />
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(hasTrack ? duration : 0)}</span>
        </div>

        <div className={`${isExpandedMobile ? "flex" : "hidden"} items-center justify-center gap-2 md:flex md:mx-auto md:w-[82%] md:justify-center lg:w-[68%]`}>
          <button onClick={() => toggleMute()} disabled={!hasTrack} className={`rounded-full p-2 transition ${ghostControlClass} ${disabledClass}`}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            disabled={!hasTrack}
            className={`h-1.5 w-24 cursor-pointer appearance-none rounded-full md:w-28 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 ${thumbClass} ${disabledClass}`}
            style={{
              background: `linear-gradient(to right, rgb(${accentRgb}) 0%, rgb(${accentRgb}) ${volumePercent}%, rgb(209 213 219) ${volumePercent}%, rgb(209 213 219) 100%)`,
            }}
            aria-label={t("volume")}
          />

          <div className="relative" ref={sleepMenuRef}>
            <button
              onClick={() => setShowSleepMenu((prev) => !prev)}
              disabled={!hasTrack}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition ${pillClass} ${disabledClass}`}
              title={safeT("timer", "Timer")}
              aria-label={safeT("timer", "Timer")}
            >
              <Timer className="h-3.5 w-3.5" />
              <span>{sleepMinutesLeft ? `${sleepMinutesLeft}m` : safeT("timer", "Timer")}</span>
            </button>

            {showSleepMenu && hasTrack ? (
              <div className="absolute bottom-10 left-1/2 z-50 min-w-[120px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-[#303133] dark:bg-[#242526]">
                <div className="flex flex-col gap-1">
                  {[15, 30, 60].map((minute) => (
                    <button
                      key={minute}
                      onClick={() => setSleepTimer(minute)}
                      className="rounded-md px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#3a3b3c]"
                    >
                      {minute}m
                    </button>
                  ))}
                  <button
                    onClick={() => setSleepTimer(null)}
                    className="rounded-md px-2 py-1 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    <span>{t("cancel")}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            onClick={cycleSpeed}
            disabled={!hasTrack}
            className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${pillClass} ${disabledClass}`}
            title={t("speedTitle")}
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      {!isExpandedMobile ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#3a3b3c] md:hidden">
          <div className="h-full transition-all" style={{ width: `${progressPercent}%`, backgroundColor: `rgb(${accentRgb})` }} />
        </div>
      ) : null}

      <style jsx>{`
        input[type="range"]:focus::-webkit-slider-thumb,
        input[type="range"]:active::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(var(--player-accent-rgb), 0.12), 0 1px 2px rgba(0, 0, 0, 0.12);
        }
        input[type="range"]:focus::-moz-range-thumb,
        input[type="range"]:active::-moz-range-thumb {
          box-shadow: 0 0 0 4px rgba(var(--player-accent-rgb), 0.12), 0 1px 2px rgba(0, 0, 0, 0.12);
        }

        :global(.dark) input[type="range"]:focus::-webkit-slider-thumb,
        :global(.dark) input[type="range"]:active::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(var(--player-accent-rgb), 0.14), 0 1px 2px rgba(0, 0, 0, 0.35);
        }
        :global(.dark) input[type="range"]:focus::-moz-range-thumb,
        :global(.dark) input[type="range"]:active::-moz-range-thumb {
          box-shadow: 0 0 0 4px rgba(var(--player-accent-rgb), 0.14), 0 1px 2px rgba(0, 0, 0, 0.35);
        }
      `}</style>
    </div>
  );
}
