"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Timer, Volume2, VolumeX } from "lucide-react";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  audioUrl: string;
  category: "Lofi" | "Piano" | "Chill" | "Meditation";
};

type MusicStickyPlayerProps = {
  track: MusicTrack | null;
  playSignal: number;
  labels: {
    nowPlaying: string;
    selectTrack: string;
    fallbackArtist: string;
    sleep: string;
    minutes: string;
    cancelTimer: string;
    seekBackwardAria: string;
    seekForwardAria: string;
    playAria: string;
    pauseAria: string;
    muteAria: string;
    unmuteAria: string;
    progressAria: string;
    volumeAria: string;
    speedTitle: string;
  };
};

const speedOptions = [0.75, 1, 1.25, 1.5, 2] as const;

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export default function MusicStickyPlayer({ track, playSignal, labels }: MusicStickyPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const lastPlaySignalRef = useRef(playSignal);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerMenuRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof speedOptions)[number]>(1);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);

  const progressPercent = useMemo(() => {
    if (duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }

      if (!minutes) {
        setSleepMinutesLeft(null);
        setShowTimerMenu(false);
        return;
      }

      setSleepMinutesLeft(minutes);
      sleepTimerRef.current = setTimeout(() => {
        audioRef.current?.pause();
        setSleepMinutesLeft(null);
        sleepTimerRef.current = null;
      }, minutes * 60_000);
      setShowTimerMenu(false);
    },
    [],
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audioRef.current = null;
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!track) {
      audio.pause();
      loadedTrackIdRef.current = null;
      return;
    }

    if (loadedTrackIdRef.current !== track.id) {
      loadedTrackIdRef.current = track.id;
      audio.pause();
      audio.src = track.audioUrl;
      audio.load();
    }
  }, [track]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    if (playSignal === lastPlaySignalRef.current) return;
    lastPlaySignalRef.current = playSignal;

    if (loadedTrackIdRef.current !== track.id) {
      loadedTrackIdRef.current = track.id;
      audio.src = track.audioUrl;
      audio.load();
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [playSignal, track]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (!showTimerMenu) return;

    const handleOutside = (event: MouseEvent) => {
      if (timerMenuRef.current && !timerMenuRef.current.contains(event.target as Node)) {
        setShowTimerMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showTimerMenu]);

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

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    if (audio.paused) {
      void audio.play().catch(() => undefined);
      return;
    }

    audio.pause();
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    const max = duration > 0 ? duration : seconds;
    const clamped = Math.max(0, Math.min(seconds, max));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const seekBy = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  const cycleSpeed = () => {
    const currentIndex = speedOptions.findIndex((item) => item === playbackRate);
    const nextIndex = currentIndex < 0 ? 1 : (currentIndex + 1) % speedOptions.length;
    const nextRate = speedOptions[nextIndex] ?? 1;
    setPlaybackRate(nextRate);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const changeVolume = (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setVolume(clamped);

    if (clamped <= 0) {
      setIsMuted(true);
      return;
    }

    setIsMuted(false);
  };

  const hasTrack = Boolean(track);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#2a2a2a] bg-[#181818]/95 backdrop-blur-lg">
      <div className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-md bg-[#242424]">
            {track ? (
              <Image
                src={track.thumbnailUrl}
                alt={track.title}
                width={48}
                height={48}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">NO TRACK</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">{labels.nowPlaying}</p>
            <p className="truncate text-sm font-semibold text-white">{track?.title || labels.selectTrack}</p>
            <p className="truncate text-xs text-zinc-400">{track?.artist || labels.fallbackArtist}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => seekBy(-10)}
              disabled={!hasTrack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#303030] bg-[#202020] text-zinc-200 transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={labels.seekBackwardAria}
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlay}
              disabled={!hasTrack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1db954] text-black transition hover:scale-[1.03] hover:bg-[#33c865] disabled:cursor-not-allowed disabled:bg-[#445145]"
              aria-label={isPlaying ? labels.pauseAria : labels.playAria}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>

            <button
              onClick={() => seekBy(10)}
              disabled={!hasTrack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#303030] bg-[#202020] text-zinc-200 transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={labels.seekForwardAria}
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seekTo(Number(event.target.value))}
              disabled={!hasTrack}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-[#1db954] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: `linear-gradient(to right, #1db954 0%, #1db954 ${progressPercent}%, #3f3f46 ${progressPercent}%, #3f3f46 100%)`,
              }}
              aria-label={labels.progressAria}
            />
            <span className="w-11 shrink-0 text-[11px] tabular-nums text-zinc-400">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
          <div className="relative" ref={timerMenuRef}>
            <button
              onClick={() => setShowTimerMenu((prev) => !prev)}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[#303030] bg-[#202020] px-3 text-xs font-medium text-zinc-200 transition hover:bg-[#2a2a2a]"
            >
              <Timer className="h-4 w-4" />
              {sleepMinutesLeft ? `${sleepMinutesLeft}${labels.minutes}` : labels.sleep}
            </button>

            {showTimerMenu ? (
              <div className="absolute bottom-11 right-0 min-w-[140px] rounded-xl border border-[#303030] bg-[#202020] p-2 shadow-2xl">
                <div className="space-y-1">
                  {[15, 30, 60].map((minute) => (
                    <button
                      key={minute}
                      onClick={() => setSleepTimer(minute)}
                      className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-zinc-200 transition hover:bg-[#2d2d2d]"
                    >
                      {minute} {labels.minutes}
                    </button>
                  ))}
                  <button
                    onClick={() => setSleepTimer(null)}
                    className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-rose-300 transition hover:bg-[#2d2d2d]"
                  >
                    {labels.cancelTimer}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            onClick={toggleMute}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#303030] bg-[#202020] text-zinc-200 transition hover:bg-[#2a2a2a]"
            aria-label={isMuted ? labels.unmuteAria : labels.muteAria}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-zinc-100"
            aria-label={labels.volumeAria}
          />

          <button
            onClick={cycleSpeed}
            className="inline-flex h-9 items-center rounded-full border border-[#303030] bg-[#202020] px-3 text-xs font-semibold text-zinc-100 transition hover:bg-[#2a2a2a]"
            title={labels.speedTitle}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
