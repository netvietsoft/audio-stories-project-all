"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Lock, Pause, Play, Volume2, VolumeX } from "lucide-react";

import SpeedControl from "@/components/player/SpeedControl";
import SleepTimerControl from "@/components/player/SleepTimerControl";
import VolumeControl from "@/components/player/VolumeControl";

type YoutubePlayerLabels = {
  playbackSpeed: string;
  sleepTimer: string;
  cancelSleepTimer: string;
  customMinutesPlaceholder: string;
  setTimer: string;
};

type YouTubePlayerPanelProps = {
  videoId: string;
  title: string;
  locked: boolean;
  lockReasonLabel: string;
  unlockLabel: string;
  onUnlockRequest: () => void;
  autoPlaySignal?: number;
  labels: YoutubePlayerLabels;
};

type YouTubePlayerLike = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVolume: () => number;
  getPlaybackRate: () => number;
  getAvailablePlaybackRates: () => number[];
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setPlaybackRate: (rate: number) => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: Record<string, unknown>) => YouTubePlayerLike;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

const loadYouTubeApi = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');

    const ready = () => {
      resolve();
    };

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === "function") {
        previousReady();
      }
      ready();
    };

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load YouTube IFrame API"));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
};

export default function YouTubePlayerPanel({
  videoId,
  title,
  locked,
  lockReasonLabel,
  unlockLabel,
  onUnlockRequest,
  autoPlaySignal = 0,
  labels,
}: YouTubePlayerPanelProps) {
  const hostId = useId().replaceAll(":", "");
  const playerRef = useRef<YouTubePlayerLike | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const syncPlayerSnapshot = useCallback((player: YouTubePlayerLike | null) => {
    if (!player) return;

    const nextDuration = Math.max(0, Number(player.getDuration?.() || 0));
    const nextTime = Math.max(0, Number(player.getCurrentTime?.() || 0));
    const nextVolume = Math.max(0, Math.min(1, Number(player.getVolume?.() || 0) / 100));
    const nextRate = Math.max(0.25, Number(player.getPlaybackRate?.() || 1));

    setDuration(nextDuration);
    setCurrentTime(nextDuration > 0 ? Math.min(nextTime, nextDuration) : nextTime);
    setVolume(nextVolume);
    setIsMuted(Boolean(player.isMuted?.()));
    setPlaybackRate(nextRate);
  }, []);

  useEffect(() => {
    if (!videoId || locked) {
      setIsPlaying(false);
      return;
    }

    let cancelled = false;

    const initPlayer = async () => {
      try {
        await loadYouTubeApi();
        if (cancelled || !window.YT?.Player) return;

        playerRef.current?.destroy();

        playerRef.current = new window.YT.Player(hostId, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setIsReady(true);
              syncPlayerSnapshot(playerRef.current);
            },
            onStateChange: (event: { data: number }) => {
              const state = event.data;
              if (!window.YT) return;

              if (state === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                syncPlayerSnapshot(playerRef.current);
                return;
              }

              if (state === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                syncPlayerSnapshot(playerRef.current);
                return;
              }

              if (state === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                setCurrentTime(0);
                return;
              }

              syncPlayerSnapshot(playerRef.current);
            },
          },
        });
      } catch {
        if (!cancelled) {
          setIsReady(false);
        }
      }
    };

    void initPlayer();

    return () => {
      cancelled = true;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      playerRef.current?.destroy();
      playerRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    };
  }, [hostId, locked, syncPlayerSnapshot, videoId]);

  useEffect(() => {
    if (!isReady || locked) return;

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const nextTime = Math.max(0, Number(player.getCurrentTime?.() || 0));
      const nextDuration = Math.max(0, Number(player.getDuration?.() || 0));
      setCurrentTime(nextDuration > 0 ? Math.min(nextTime, nextDuration) : nextTime);
      setDuration(nextDuration);
      setIsMuted(Boolean(player.isMuted?.()));
      setVolume(Math.max(0, Math.min(1, Number(player.getVolume?.() || 0) / 100)));
      setPlaybackRate(Math.max(0.25, Number(player.getPlaybackRate?.() || 1)));
    }, 1000);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isReady, locked]);

  useEffect(() => {
    if (!autoPlaySignal || locked || !isReady) return;
    const player = playerRef.current;
    if (!player) return;
    player.playVideo();
    setIsPlaying(true);
  }, [autoPlaySignal, isReady, locked]);

  const seekBy = useCallback((deltaSeconds: number) => {
    const player = playerRef.current;
    if (!player || locked) return;

    const nextTime = Math.max(0, Math.min(currentTime + deltaSeconds, duration > 0 ? duration : currentTime + deltaSeconds));
    player.seekTo(nextTime, true);
    setCurrentTime(nextTime);
  }, [currentTime, duration, locked]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player || locked) return;

    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
      return;
    }

    player.playVideo();
    setIsPlaying(true);
  }, [isPlaying, locked]);

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const player = playerRef.current;
    if (!player || locked) return;

    const normalized = Math.max(0, Math.min(1, nextVolume));
    player.setVolume(Math.round(normalized * 100));
    if (normalized > 0 && player.isMuted()) {
      player.unMute();
    }

    setVolume(normalized);
    setIsMuted(Boolean(player.isMuted?.()));
  }, [locked]);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player || locked) return;

    if (player.isMuted()) {
      player.unMute();
    } else {
      player.mute();
    }

    setIsMuted(Boolean(player.isMuted?.()));
  }, [locked]);

  const cyclePlaybackRate = useCallback(() => {
    const player = playerRef.current;
    if (!player || locked) return;

    const rates = player.getAvailablePlaybackRates?.() || [0.5, 1, 1.25, 1.5, 2];
    if (!rates.length) return;

    const sortedRates = rates.slice().sort((a, b) => a - b);
    const currentIndex = Math.max(0, sortedRates.findIndex((rate) => Math.abs(rate - playbackRate) < 0.01));
    const nextRate = sortedRates[(currentIndex + 1) % sortedRates.length] || 1;
    player.setPlaybackRate(nextRate);
    setPlaybackRate(nextRate);
  }, [locked, playbackRate]);

  const canInteract = isReady && !locked;
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <section className="rounded-2xl bg-white p-2 sm:p-3 md:p-4 dark:bg-[#242526]">
      <h2 className="mb-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100 sm:mb-3 sm:text-base">{title}</h2>

      {locked ? (
        <div className="rounded-xl bg-amber-50/70 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="flex items-start gap-2 font-semibold leading-relaxed"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> <span>{lockReasonLabel}</span></p>
          <button
            onClick={onUnlockRequest}
            className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-pink-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-pink-700"
          >
            {unlockLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <div className="youtube-player-host relative aspect-video w-full">
              <div id={hostId} className="absolute inset-0 h-full w-full" />
              <div
                className="absolute inset-0 z-10 bg-transparent"
                onContextMenu={(event) => event.preventDefault()}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border border-gray-200 bg-white/70 p-2.5 dark:border-[#303133] dark:bg-[#202224]">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-[#3a3b3c]">
              <div
                className="h-full rounded-full bg-pink-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                <span>{Math.floor(currentTime / 60).toString().padStart(2, "0")}:{Math.floor(currentTime % 60).toString().padStart(2, "0")}</span>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <span>{Math.floor(duration / 60).toString().padStart(2, "0")}:{Math.floor(duration % 60).toString().padStart(2, "0")}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  disabled={!canInteract}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
                  aria-label="Seek back 10 seconds"
                >
                  -10
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!canInteract}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-pink-600 text-white shadow-[0_6px_18px_rgba(236,72,153,0.45)] transition hover:scale-105 hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  disabled={!canInteract}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
                  aria-label="Seek forward 10 seconds"
                >
                  +10
                </button>
              </div>

              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={!canInteract}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>

                <VolumeControl
                  volume={volume}
                  isMuted={isMuted}
                  disabled={!canInteract}
                  onVolumeChange={handleVolumeChange}
                  onToggleMute={toggleMute}
                  buttonClassName="hidden"
                  sliderClassName="h-1.5 w-16 cursor-pointer appearance-none rounded-full sm:w-20"
                  thumbClassName="[&::-webkit-slider-thumb]:bg-pink-500 [&::-moz-range-thumb]:bg-pink-500"
                  accentRgb="236 72 153"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <SpeedControl
                  playbackRate={playbackRate}
                  disabled={!canInteract}
                  onCycleSpeed={cyclePlaybackRate}
                  label={labels.playbackSpeed}
                />
                <SleepTimerControl
                  disabled={!canInteract}
                  onSleepTriggered={() => {
                    const player = playerRef.current;
                    if (!player) return;
                    player.pauseVideo();
                    setIsPlaying(false);
                  }}
                  label={labels.sleepTimer}
                />
              </div>
            </div>
          </div>

          <style jsx>{`
            .youtube-player-host :global(iframe) {
              width: 100% !important;
              height: 100% !important;
              border: 0;
              display: block;
            }
          `}</style>
        </div>
      )}
    </section>
  );
}
