"use client";

import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, Pause, Play, SkipBack, SkipForward, Timer, Volume2, VolumeX } from "lucide-react";

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

    console.log("[Tracking FE] Bat dau dem 10s cho luot NGHE...", { storyId, chapterId });

    const timer = window.setTimeout(() => {
      const deviceId = getOrCreateDeviceId();
      if (!deviceId) return;

      void apiClient
        .post("/tracking/listen", {
          storyId,
          chapterId,
          deviceId,
        })
        .then((response) => {
          console.log("[Tracking FE] 🎧 Da gui luot NGHE thanh cong len server!", response.data);
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

  const resolvedCoverUrl = currentTrack?.coverUrl || currentTrack?.storyCoverUrl || "/thumbnaildefault.jpg";

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

  if (!mounted || !currentTrack) {
    return null;
  }

  const chapterHref =
    currentTrack.storySlug && currentTrack.chapterNumber
      ? `/story/${currentTrack.storySlug}/chuong-${currentTrack.chapterNumber}`
      : currentTrack.storySlug
        ? `/story/${currentTrack.storySlug}`
        : undefined;

  const isStoryTrack = Boolean(currentTrack.storyId);
  const handlePrev = () => {
    playPrev();
    if (isStoryTrack) {
      togglePlay(false);
    }
  };

  const handleNext = () => {
    playNext();
    if (isStoryTrack) {
      togglePlay(false);
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-50/90 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md dark:bg-[#242526]/95 sm:px-4 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-[72%] opacity-70"
      }`}
    >
      <div className="mx-auto w-full space-y-2 lg:w-[40vw]">
        <div className="flex items-center gap-3 md:justify-center">
          {chapterHref ? (
            <Link href={chapterHref} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 transition hover:bg-gray-100/80 dark:hover:bg-[#3a3b3c] md:flex-none md:max-w-[60%]">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-[#3a3b3c]">
                <Image
                  src={resolvedCoverUrl}
                  alt={currentTrack.title}
                  width={40}
                  height={40}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{currentTrack.title}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{currentTrack.author || t("defaultAuthor")}</p>
              </div>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none md:max-w-[60%]">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-[#3a3b3c]">
                <Image
                  src={resolvedCoverUrl}
                  alt={currentTrack.title}
                  width={40}
                  height={40}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{currentTrack.title}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{currentTrack.author || t("defaultAuthor")}</p>
              </div>
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <button onClick={handlePrev} className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3b3c]">
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={() => togglePlay(!isPlaying)} className="rounded-full bg-pink-600 p-2.5 text-white hover:bg-pink-700">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={handleNext} className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3b3c]">
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsExpandedMobile((prev) => !prev)}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3b3c] md:hidden"
              aria-label={t("audioProgress")}
            >
              <ChevronUp className={`h-4 w-4 transition-transform ${isExpandedMobile ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        <div className={`${isExpandedMobile ? "flex" : "hidden"} items-center gap-2 md:flex md:mx-auto md:w-[82%] lg:w-[68%]`}>
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="time-slider h-1 w-full appearance-none rounded-full accent-pink-600 [--time-slider-track:rgb(107_114_128)] dark:[--time-slider-track:rgb(209_213_219)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-pink-500 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-pink-500"
            style={{
              WebkitAppearance: "none",
              appearance: "none",
              background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${Math.min((currentTime / (duration || 1)) * 100, 100)}%, var(--time-slider-track) ${Math.min((currentTime / (duration || 1)) * 100, 100)}%, var(--time-slider-track) 100%)`,
            }}
            aria-label={t("audioProgress")}
          />
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(duration)}</span>
        </div>

        <div className={`${isExpandedMobile ? "flex" : "hidden"} items-center justify-center gap-2 md:flex md:mx-auto md:w-[82%] md:justify-center lg:w-[68%]`}>
          <button onClick={() => toggleMute()} className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3b3c]">
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="h-1.5 w-24 cursor-pointer appearance-none rounded-full md:w-28 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-pink-500 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-pink-500"
            style={{
              background: `linear-gradient(to right, rgb(236 72 153) 0%, rgb(236 72 153) ${Math.round(volume * 100)}%, rgb(209 213 219) ${Math.round(volume * 100)}%, rgb(209 213 219) 100%)`,
            }}
            aria-label={t("volume")}
          />

          <div className="relative" ref={sleepMenuRef}>
            <button
              onClick={() => setShowSleepMenu((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md border border-pink-200 bg-pink-50 px-2 py-1 text-xs font-semibold text-pink-700 hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/35"
              title={t("timer")}
              aria-label={t("timer")}
            >
              <Timer className="h-3.5 w-3.5" />
              <span>{sleepMinutesLeft ? `${sleepMinutesLeft}m` : t("timer")}</span>
            </button>

            {showSleepMenu ? (
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
            className="rounded-md border border-pink-200 bg-pink-50 px-2 py-1 text-xs font-semibold text-pink-700 hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/35"
            title={t("speedTitle")}
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      {!isExpandedMobile ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#3a3b3c] md:hidden">
          <div className="h-full bg-pink-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <style jsx>{`
        /* Focus/active ring to match app accent */
        input[type="range"]:focus::-webkit-slider-thumb,
        input[type="range"]:active::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(236,72,153,0.12), 0 1px 2px rgba(0,0,0,0.12);
        }
        input[type="range"]:focus::-moz-range-thumb,
        input[type="range"]:active::-moz-range-thumb {
          box-shadow: 0 0 0 4px rgba(236,72,153,0.12), 0 1px 2px rgba(0,0,0,0.12);
        }

        /* Dark mode focus ring */
        :global(.dark) input[type="range"]:focus::-webkit-slider-thumb,
        :global(.dark) input[type="range"]:active::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(236,72,153,0.14), 0 1px 2px rgba(0,0,0,0.35);
        }
        :global(.dark) input[type="range"]:focus::-moz-range-thumb,
        :global(.dark) input[type="range"]:active::-moz-range-thumb {
          box-shadow: 0 0 0 4px rgba(236,72,153,0.14), 0 1px 2px rgba(0,0,0,0.35);
        }
      `}</style>
    </div>
  );
}

