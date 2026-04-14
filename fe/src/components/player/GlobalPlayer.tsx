"use client";

import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, ChevronUp, Music2 } from "lucide-react";
import ShuffleRepeatControls from "@/components/player/ShuffleRepeatControls";
import PlayerTransportControls from "@/components/player/PlayerTransportControls";
import VolumeControl from "@/components/player/VolumeControl";
import SpeedControl from "@/components/player/SpeedControl";
import SleepTimerControl from "@/components/player/SleepTimerControl";

import { apiClient } from "@/lib/api/api-client";
import { clampVolume, resolveNextPlaybackRate } from "@/lib/player/control-helpers";
import { getOrCreateDeviceId } from "@/lib/tracking/device-id";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const resolveFiniteDuration = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return value;
};

const resolveMusicInteractionId = (trackId?: string | null) => {
  if (!trackId) return null;

  // Playlist queue tracks use a synthetic id format: playlist:<playlistId>:<musicId>:<index>
  if (trackId.startsWith("playlist:")) {
    const parts = trackId.split(":");
    const childMusicId = parts[2];
    return childMusicId || null;
  }

  return trackId;
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
  const [isVisible, setIsVisible] = useState(true);
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);
  const lastSyncedProgressRef = useRef<Map<string, number>>(new Map());
  const lastSyncedMusicProgressRef = useRef<Map<string, number>>(new Map());
  const lastMusicSyncedAtRef = useRef<Map<string, number>>(new Map());
  const listenTrackedRef = useRef<Map<string, boolean>>(new Map());
  const lastScrollYRef = useRef(0);
  const previousTrackIdRef = useRef<string | null>(null);

  const accessToken = useUserStore((state) => state.accessToken);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const isShuffle = useAudioStore((state) => state.isShuffle);
  const repeatMode = useAudioStore((state) => state.repeatMode);
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
  const toggleShuffle = useAudioStore((state) => state.toggleShuffle);
  const cycleRepeatMode = useAudioStore((state) => state.cycleRepeatMode);
  const consumeQueuedTrack = useAudioStore((state) => state.consumeQueuedTrack);

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

  const syncMusicHistory = useCallback(
    async (force = false) => {
      if (!accessToken || !currentTrack) return;
      if (currentTrack.storyId) return;

      const musicId = resolveMusicInteractionId(currentTrack.id);
      if (!musicId) return;

      const liveTime = Math.floor(audioRef.current?.currentTime || 0);
      const liveDuration = resolveFiniteDuration(audioRef.current?.duration || 0);
      const clampedLiveTime = liveDuration > 0 ? Math.min(liveTime, Math.floor(liveDuration)) : liveTime;
      if (!force && clampedLiveTime < 3) return;

      const lastSynced = lastSyncedMusicProgressRef.current.get(musicId) || 0;
      const now = Date.now();
      const lastSyncedAt = lastMusicSyncedAtRef.current.get(musicId) || 0;

      if (!force && (clampedLiveTime <= lastSynced || now - lastSyncedAt < 5_000)) {
        return;
      }

      try {
        await apiClient.patch(`/music/interactions/${musicId}/history`, {
          progressSeconds: clampedLiveTime,
        });
        lastSyncedMusicProgressRef.current.set(musicId, clampedLiveTime);
        lastMusicSyncedAtRef.current.set(musicId, now);
      } catch {
        // Keep player resilient if music history sync is temporarily unavailable.
      }
    },
    [accessToken, currentTrack],
  );

  const cycleSpeed = () => {
    setPlaybackRate(resolveNextPlaybackRate(playbackRate));
  };

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      const liveDuration = resolveFiniteDuration(audio.duration);
      const liveTime = Math.max(0, audio.currentTime || 0);
      setCurrentTime(liveDuration > 0 ? Math.min(liveTime, liveDuration) : liveTime);
    };

    const handleLoadedMetadata = () => {
      // Real media metadata duration must override any fallback duration from DB.
      const realDuration = resolveFiniteDuration(audio.duration);
      const liveTime = Math.max(0, audio.currentTime || 0);
      setDuration(realDuration);
      setCurrentTime(realDuration > 0 ? Math.min(liveTime, realDuration) : liveTime);
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
  }, [playNext, setCurrentTime, setDuration]);

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

    const applySeek = () => {
      const target = Math.max(0, seekTarget);
      audio.currentTime = target;
      setCurrentTime(target);
      clearSeekTarget();
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      applySeek();
      return;
    }

    const handleLoadedMetadata = () => {
      applySeek();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [clearSeekTarget, seekTarget, setCurrentTime]);

  useEffect(() => {
    const previousTrackId = previousTrackIdRef.current;
    const activeTrackId = currentTrack?.id || null;

    if (previousTrackId && previousTrackId !== activeTrackId) {
      consumeQueuedTrack(previousTrackId);
    }

    previousTrackIdRef.current = activeTrackId;
  }, [consumeQueuedTrack, currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack || isPlaying) return;
    if (!duration || duration <= 0) return;
    if (currentTime < duration - 0.25) return;

    consumeQueuedTrack(currentTrack.id);
  }, [consumeQueuedTrack, currentTime, currentTrack, duration, isPlaying]);

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
    if (!currentTrack || currentTrack.storyId) return;

    if (!isPlaying) {
      void syncMusicHistory(true);
      return;
    }

    const timer = setInterval(() => {
      void syncMusicHistory(false);
    }, 8_000);

    return () => {
      clearInterval(timer);
      void syncMusicHistory(true);
    };
  }, [currentTrack, isPlaying, syncMusicHistory]);

  useEffect(() => {
    return () => {
      void syncMusicHistory(true);
    };
  }, [syncMusicHistory]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void syncHistory(true);
      void syncMusicHistory(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      void syncHistory(true);
      void syncMusicHistory(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncHistory, syncMusicHistory]);

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

  const safeDuration = useMemo(() => resolveFiniteDuration(duration), [duration]);
  const safeCurrentTime = useMemo(
    () => (safeDuration > 0 ? Math.min(Math.max(0, currentTime), safeDuration) : Math.max(0, currentTime)),
    [currentTime, safeDuration],
  );

  const progress = useMemo(() => {
    if (!safeDuration) return 0;
    return Math.min(100, Math.max(0, (safeCurrentTime / safeDuration) * 100));
  }, [safeCurrentTime, safeDuration]);

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

  if (typeof window === "undefined") {
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
  const modeButtonInactiveClass = isMusicTrack
    ? "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/35"
    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-[#3a3b3c] dark:bg-[#2f3133] dark:text-gray-200 dark:hover:bg-[#3a3b3c]";
  const modeButtonActiveClass = isMusicTrack
    ? "border-pink-500 bg-pink-500 text-white hover:bg-pink-600 dark:border-pink-400 dark:bg-pink-500"
    : "border-gray-700 bg-gray-700 text-white hover:bg-gray-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  const playButtonClass = isMusicTrack
    ? "bg-pink-600 text-white hover:bg-pink-700"
    : "bg-gray-700 text-white hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
  const thumbClassName = isMusicTrack
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

  const seekBy = (seconds: number) => {
    if (!hasTrack) return;
    seekTo(safeCurrentTime + seconds);
  };

  const playerIdentity = (
    <>
      <div
        className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-md ${
          isMusicTrack ? "bg-pink-100 dark:bg-pink-950/30" : "bg-gray-200 dark:bg-[#3a3b3c]"
        }`}
      >
        {hasTrack ? (
          <Image src={resolvedCoverUrl} alt={displayTitle || "Cover"} width={40} height={40} loading="lazy" className="h-full w-full object-cover" />
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
            <PlayerTransportControls
              isPlaying={isPlaying}
              canControl={hasTrack}
              canSeek={hasTrack}
              showSeekButtons
              onPrev={handlePrev}
              onBack10={() => seekBy(-10)}
              onTogglePlay={handleTogglePlay}
              onForward10={() => seekBy(10)}
              onNext={handleNext}
              className="flex items-center gap-1"
              buttonClassName={`rounded-full p-2 transition ${ghostControlClass} ${disabledClass}`}
              playButtonClassName={`rounded-full p-2.5 transition ${playButtonClass} ${disabledClass}`}
              seekButtonClassName={`hidden sm:inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[10px] font-semibold transition ${ghostControlClass} ${disabledClass}`}
              disabledClassName=""
            />
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
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(hasTrack ? safeCurrentTime : 0)}</span>
          <input
            type="range"
            min={0}
            max={hasTrack ? safeDuration || 0 : 0}
            step={1}
            value={hasTrack ? safeCurrentTime : 0}
            onChange={(event) => seekTo(Number(event.target.value))}
            disabled={!hasTrack}
            className={`time-slider h-1 w-full appearance-none rounded-full [--time-slider-track:rgb(107_114_128)] dark:[--time-slider-track:rgb(209_213_219)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 ${thumbClassName} ${disabledClass}`}
            style={{
              WebkitAppearance: "none",
              appearance: "none",
              background: `linear-gradient(to right, rgb(${accentRgb}) 0%, rgb(${accentRgb}) ${progressPercent}%, var(--time-slider-track) ${progressPercent}%, var(--time-slider-track) 100%)`,
            }}
            aria-label={t("audioProgress")}
          />
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(hasTrack ? safeDuration : 0)}</span>
        </div>

        <div className={`${isExpandedMobile ? "flex" : "hidden"} items-center justify-center gap-2 md:flex md:mx-auto md:w-[82%] md:justify-center lg:w-[68%]`}>
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            disabled={!hasTrack}
            accentRgb={accentRgb}
            onVolumeChange={(v) => setVolume(clampVolume(v))}
            onToggleMute={() => toggleMute()}
            buttonClassName={`rounded-full p-2 transition ${ghostControlClass}`}
            thumbClassName={thumbClassName}
          />

          <SleepTimerControl
            disabled={!hasTrack}
            onSleepTriggered={() => togglePlay(false)}
            buttonClassName={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition ${pillClass}`}
            label={safeT("timer", "Timer")}
          />

          <SpeedControl
            playbackRate={playbackRate}
            disabled={!hasTrack}
            onCycleSpeed={cycleSpeed}
            className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${pillClass}`}
            label={t("speedTitle")}
          />

          <ShuffleRepeatControls
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            onToggleShuffle={toggleShuffle}
            onCycleRepeatMode={cycleRepeatMode}
            disabled={!hasTrack}
            buttonClassName={`rounded-md border p-1.5 transition ${disabledClass}`}
            inactiveClassName={modeButtonInactiveClass}
            activeClassName={modeButtonActiveClass}
          />
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
