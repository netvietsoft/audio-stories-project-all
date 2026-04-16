"use client";

import { type ReactNode } from "react";
import { Settings2, Timer, Volume2, VolumeX } from "lucide-react";

import type { RepeatMode } from "@/lib/player/playback-modes";
import ShuffleRepeatControls from "@/components/player/ShuffleRepeatControls";
import PlayerTransportControls from "@/components/player/PlayerTransportControls";

type StoryAudioPlayerPanelProps = {
  heading: string;
  coverUrl: string;
  coverAlt: string;
  rotating: boolean;
  chapterMeta: string;
  title: string;
  currentTime: number;
  duration: number;
  canSeek: boolean;
  canPlay: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
  showSettings: boolean;
  customMinutes: string;
  sleepMinutesLeft: number | null;
  sleepTimerActiveLabel: string | null;
  labels: {
    playbackSpeed: string;
    sleepTimer: string;
    cancelSleepTimer: string;
    customMinutesPlaceholder: string;
    setTimer: string;
  };
  onSeek: (seconds: number) => void;
  onPrev: () => void;
  onBack10: () => void;
  onTogglePlay: () => void;
  onForward10: () => void;
  onNext: () => void;
  onCyclePlaybackRate: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
  onToggleSettings: () => void;
  onSetSleepTimer: (minutes: number | null) => void;
  onCustomMinutesChange: (value: string) => void;
  onApplyCustomMinutes: () => void;
  footer?: ReactNode;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const totalSeconds = Math.floor(seconds);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export default function StoryAudioPlayerPanel({
  heading,
  coverUrl,
  coverAlt,
  rotating,
  chapterMeta,
  title,
  currentTime,
  duration,
  canSeek,
  canPlay,
  isPlaying,
  isMuted,
  volume,
  isShuffle,
  repeatMode,
  playbackRate,
  showSettings,
  customMinutes,
  sleepMinutesLeft,
  sleepTimerActiveLabel,
  labels,
  onSeek,
  onPrev,
  onBack10,
  onTogglePlay,
  onForward10,
  onNext,
  onCyclePlaybackRate,
  onToggleMute,
  onVolumeChange,
  onToggleShuffle,
  onCycleRepeatMode,
  onToggleSettings,
  onSetSleepTimer,
  onCustomMinutesChange,
  onApplyCustomMinutes,
  footer,
}: StoryAudioPlayerPanelProps) {
  const progressPercent = Math.min((currentTime / (duration || 1)) * 100, 100);

  return (
    <section className="rounded-[5px] border border-gray-300 bg-white p-2 sm:p-3 md:p-4 dark:border-[#303133] dark:bg-[#242526]">
      <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>

      <div className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] gap-2 sm:grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[128px_minmax(0,1fr)] xl:grid-cols-[148px_minmax(0,1fr)]">
        <div className="flex min-w-0 shrink-0 flex-col items-center justify-center gap-2">
          <div
            className={`relative h-16 w-16 overflow-hidden rounded-full border-4 border-pink-200 dark:border-pink-900 sm:h-20 sm:w-20 lg:h-28 lg:w-28 ${
              rotating ? "animate-spin [animation-duration:10s]" : ""
            }`}
          >
            <img src={coverUrl} alt={coverAlt} className="h-full w-full object-cover" />
          </div>
          <p className="line-clamp-2 text-center text-xs text-gray-500 dark:text-gray-400">{chapterMeta}</p>
        </div>

        <div className="min-w-0 space-y-2 pr-1 sm:pr-2 md:pr-3">
          <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => {
              if (!canSeek) return;
              onSeek(Number(event.target.value));
            }}
            className="time-slider h-1 w-full appearance-none rounded-full accent-pink-600 [--time-slider-track:rgb(107_114_128)] dark:[--time-slider-track:rgb(209_213_219)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-pink-500 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-pink-500"
            style={{
              WebkitAppearance: "none",
              appearance: "none",
              background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${progressPercent}%, var(--time-slider-track) ${progressPercent}%, var(--time-slider-track) 100%)`,
              borderRadius: "9999px",
              outline: "none",
            }}
          />

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="w-14 shrink-0 text-center tabular-nums">{formatDuration(currentTime)}</span>
            <span className="w-14 shrink-0 text-center tabular-nums">{formatDuration(duration)}</span>
          </div>

          <div className="flex w-full items-center justify-center gap-1.5 sm:gap-2">
            <PlayerTransportControls
              isPlaying={isPlaying}
              canControl={canPlay}
              canSeek={canSeek}
              showSeekButtons
              className="flex items-center gap-1.5 sm:gap-2"
              onPrev={onPrev}
              onBack10={onBack10}
              onTogglePlay={onTogglePlay}
              onForward10={onForward10}
              onNext={onNext}
            />

            <button
              onClick={onCyclePlaybackRate}
              className="inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-full border border-pink-300 bg-pink-50 px-2 text-xs font-semibold text-pink-700 shadow-sm transition hover:bg-pink-100 dark:border-pink-800/60 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/40"
              title={labels.playbackSpeed}
            >
              {playbackRate}x
            </button>
          </div>

          <div className="mt-1 flex w-full min-w-0 items-center justify-center gap-1.5 sm:gap-2">
            <button onClick={onToggleMute} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white shadow-sm transition hover:bg-pink-600 dark:bg-pink-500 dark:text-white dark:hover:bg-pink-400">{isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}</button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              className="volume-slider h-1.5 min-w-0 max-w-24 flex-1 sm:max-w-28 md:max-w-32 accent-pink-600"
              style={{
                WebkitAppearance: "none",
                appearance: "none",
                background:
                  "linear-gradient(to right, rgb(236 72 153) 0%, rgb(236 72 153) " +
                  volume * 100 +
                  "%, rgb(209 213 219) " +
                  volume * 100 +
                  "%, rgb(209 213 219) 100%)",
                borderRadius: "9999px",
                outline: "none",
              }}
            />

            <ShuffleRepeatControls
              isShuffle={isShuffle}
              repeatMode={repeatMode}
              onToggleShuffle={onToggleShuffle}
              onCycleRepeatMode={onCycleRepeatMode}
            />

            <button
              onClick={onToggleSettings}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-gray-600 shadow-sm transition hover:bg-gray-200 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-300 dark:hover:bg-[#464749]"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {showSettings ? (
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-[#242526]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{labels.sleepTimer}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[15, 30, 60].map((minute) => (
                <button
                  key={minute}
                  onClick={() => onSetSleepTimer(minute)}
                  className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-[#3a3b3c] dark:text-gray-200"
                >
                  {minute}p
                </button>
              ))}
              <button
                onClick={() => onSetSleepTimer(null)}
                className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300"
              >
                {labels.cancelSleepTimer}
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="number"
                min={1}
                value={customMinutes}
                onChange={(event) => onCustomMinutesChange(event.target.value)}
                className="w-full rounded-md bg-white px-2 py-1 text-xs dark:bg-[#3a3b3c]"
                placeholder={labels.customMinutesPlaceholder}
              />
              <button
                onClick={onApplyCustomMinutes}
                className="rounded-md bg-pink-600 px-3 py-1 text-xs font-medium text-white"
              >
                {labels.setTimer}
              </button>
            </div>

            {sleepMinutesLeft ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-pink-600 dark:text-pink-300">
                <Timer className="h-3.5 w-3.5" /> {sleepTimerActiveLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {footer}

      <style jsx>{`
        input[type="range"].volume-slider::-webkit-slider-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgb(236 72 153);
          border: 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        }
        input[type="range"].volume-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgb(236 72 153);
          border: 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        }
        input[type="range"].volume-slider:focus::-webkit-slider-thumb,
        input[type="range"].volume-slider:active::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.12), 0 1px 2px rgba(0, 0, 0, 0.12);
        }
        input[type="range"].volume-slider:focus::-moz-range-thumb,
        input[type="range"].volume-slider:active::-moz-range-thumb {
          box-shadow: 0 0 0 4px rgba(236, 72, 153, 0.12), 0 1px 2px rgba(0, 0, 0, 0.12);
        }
        :global(.dark) input[type="range"].volume-slider::-webkit-slider-thumb {
          background: rgb(236 72 153);
          border: 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        }
        :global(.dark) input[type="range"].volume-slider::-moz-range-thumb {
          background: rgb(236 72 153);
          border: 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        }
      `}</style>
    </section>
  );
}