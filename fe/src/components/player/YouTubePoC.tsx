"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Settings2, SkipBack, SkipForward, Timer, Volume2, VolumeX } from "lucide-react";
import YouTube, { YouTubeProps } from "react-youtube";

type YouTubePoCProps = {
  videoId: string;
};

type YouTubeApiPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
};

const speedOptions = [0.75, 1, 1.25, 1.5, 2] as const;

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export default function YouTubePoC({ videoId }: YouTubePoCProps) {
  const ytPlayerRef = useRef<YouTubeApiPlayer | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof speedOptions)[number]>(1);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);

  const progressPercent = useMemo(() => {
    if (duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepMinutesLeft(null);
  }, []);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }

      if (!minutes) {
        setSleepMinutesLeft(null);
        return;
      }

      setSleepMinutesLeft(minutes);
      sleepTimerRef.current = setTimeout(() => {
        ytPlayerRef.current?.pauseVideo();
        setIsPlaying(false);
        setSleepMinutesLeft(null);
        sleepTimerRef.current = null;
      }, minutes * 60_000);
    },
    [],
  );

  const syncProgress = useCallback(() => {
    const player = ytPlayerRef.current;
    if (!player) return;

    const nextCurrentTime = player.getCurrentTime() || 0;
    const nextDuration = player.getDuration() || 0;

    setCurrentTime(nextCurrentTime);
    setDuration(nextDuration);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const timer = window.setInterval(() => {
      syncProgress();
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, [isReady, syncProgress]);

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
    return () => {
      clearSleepTimer();
    };
  }, [clearSleepTimer]);

  const handleReady: YouTubeProps["onReady"] = (event) => {
    const player = event.target as unknown as YouTubeApiPlayer;
    ytPlayerRef.current = player;
    player.setPlaybackRate(playbackRate);
    player.setVolume(volume);
    if (isMuted) {
      player.mute();
    } else {
      player.unMute();
    }
    setIsReady(true);
    syncProgress();
  };

  const handleStateChange: YouTubeProps["onStateChange"] = (event) => {
    const state = event.data;

    if (state === 1) {
      setIsPlaying(true);
      return;
    }

    if (state === 0 || state === 2) {
      setIsPlaying(false);
    }
  };

  const handlePlayPause = () => {
    const player = ytPlayerRef.current;
    if (!player || !isReady) return;

    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
      return;
    }

    player.playVideo();
    setIsPlaying(true);
  };

  const seekTo = (nextSeconds: number) => {
    const player = ytPlayerRef.current;
    if (!player || !isReady) return;

    const max = duration > 0 ? duration : nextSeconds;
    const clamped = Math.max(0, Math.min(nextSeconds, max));
    player.seekTo(clamped, true);
    setCurrentTime(clamped);
  };

  const seekBy = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  const cycleSpeed = () => {
    const player = ytPlayerRef.current;
    if (!player || !isReady) return;

    const currentIndex = speedOptions.findIndex((item) => item === playbackRate);
    const nextIndex = currentIndex < 0 ? 1 : (currentIndex + 1) % speedOptions.length;
    const nextRate = speedOptions[nextIndex] ?? 1;

    player.setPlaybackRate(nextRate);
    setPlaybackRate(nextRate);
  };

  const applySpeed = (rate: (typeof speedOptions)[number]) => {
    const player = ytPlayerRef.current;
    if (!player || !isReady) return;
    player.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  const handleVolumeChange = (value: number) => {
    const player = ytPlayerRef.current;
    if (!player || !isReady) return;

    const nextVolume = Math.max(0, Math.min(100, value));
    player.setVolume(nextVolume);
    setVolume(nextVolume);

    if (nextVolume <= 0) {
      player.mute();
      setIsMuted(true);
      return;
    }

    player.unMute();
    setIsMuted(false);
  };

  const toggleMute = () => {
    const player = ytPlayerRef.current;
    if (!player || !isReady) return;

    if (isMuted) {
      player.unMute();
      setIsMuted(false);
      return;
    }

    player.mute();
    setIsMuted(true);
  };

  const playerOpts: YouTubeProps["opts"] = {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
    },
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[5px] border border-gray-300 bg-white p-3 sm:p-4 dark:border-[#303133] dark:bg-[#242526]">
        <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">YouTube Audio Controls (PoC)</h2>

        <div className="space-y-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            disabled={!isReady}
            className="time-slider h-1 w-full appearance-none rounded-full accent-pink-600 [--time-slider-track:rgb(107_114_128)] disabled:cursor-not-allowed disabled:opacity-50 dark:[--time-slider-track:rgb(209_213_219)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-pink-500 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-pink-500"
            style={{
              WebkitAppearance: "none",
              appearance: "none",
              background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${progressPercent}%, var(--time-slider-track) ${progressPercent}%, var(--time-slider-track) 100%)`,
            }}
            aria-label="YouTube progress"
          />

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="w-14 shrink-0 text-center tabular-nums">{formatDuration(currentTime)}</span>
            <span className="w-14 shrink-0 text-center tabular-nums">{formatDuration(duration)}</span>
          </div>

          <div className="flex w-full items-center justify-center gap-1.5 sm:gap-2">
            <button
              onClick={() => seekBy(-10)}
              disabled={!isReady}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
              aria-label="Seek backward 10 seconds"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={() => seekBy(-10)}
              disabled={!isReady}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
            >
              -10
            </button>

            <button
              onClick={handlePlayPause}
              disabled={!isReady}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-600 text-white shadow-[0_6px_18px_rgba(236,72,153,0.45)] transition hover:scale-105 hover:bg-pink-700 hover:shadow-[0_8px_24px_rgba(236,72,153,0.55)] disabled:cursor-not-allowed disabled:bg-gray-400"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            <button
              onClick={() => seekBy(10)}
              disabled={!isReady}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
            >
              +10
            </button>

            <button
              onClick={() => seekBy(10)}
              disabled={!isReady}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
              aria-label="Seek forward 10 seconds"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1 flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
            <button
              onClick={toggleMute}
              disabled={!isReady}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(event) => handleVolumeChange(Number(event.target.value))}
              disabled={!isReady}
              className="volume-slider h-1.5 min-w-0 max-w-40 flex-1 accent-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                WebkitAppearance: "none",
                appearance: "none",
                background: `linear-gradient(to right, rgb(236 72 153) 0%, rgb(236 72 153) ${volume}%, rgb(209 213 219) ${volume}%, rgb(209 213 219) 100%)`,
                borderRadius: "9999px",
                outline: "none",
              }}
              aria-label="Volume"
            />

            <button
              onClick={cycleSpeed}
              disabled={!isReady}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303133] dark:text-gray-200 dark:hover:bg-[#3a3b3c]"
              title="Playback speed"
            >
              {playbackRate}x
            </button>

            <button
              onClick={() => setShowSettings((prev) => !prev)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-gray-600 shadow-sm transition hover:bg-gray-200 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-300 dark:hover:bg-[#464749]"
              aria-label="Toggle sleep timer and speed settings"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          {showSettings ? (
            <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-[#242526]">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Playback speed</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {speedOptions.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => applySpeed(rate)}
                    disabled={!isReady}
                    className={`rounded-md px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${playbackRate === rate ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-[#3a3b3c] dark:text-gray-200"}`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Sleep timer</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[15, 30, 45].map((minute) => (
                  <button
                    key={minute}
                    onClick={() => setSleepTimer(minute)}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200 dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
                  >
                    {minute}p
                  </button>
                ))}
                <button
                  onClick={() => setSleepTimer(null)}
                  className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 transition hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                >
                  Cancel
                </button>
              </div>

              {sleepMinutesLeft ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-pink-600 dark:text-pink-300">
                  <Timer className="h-3.5 w-3.5" /> Sleep timer active: {sleepMinutesLeft} minute(s) left
                </p>
              ) : null}
            </div>
          ) : null}

          {!isReady ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Video chưa sẵn sàng. Nhấn Load Video để bắt đầu test.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[5px] border border-gray-300 bg-white p-3 sm:p-4 dark:border-[#303133] dark:bg-[#242526]">
        <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">YouTube Video Player</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-[#3a3b3c]">
          <div className="aspect-video w-full">
            <YouTube
              key={videoId}
              videoId={videoId}
              opts={playerOpts}
              onReady={handleReady}
              onStateChange={handleStateChange}
              className="h-full w-full"
              iframeClassName="h-full w-full"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
