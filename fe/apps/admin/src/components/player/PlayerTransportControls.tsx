"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

type PlayerTransportControlsProps = {
  isPlaying: boolean;
  canControl: boolean;
  canSeek?: boolean;
  showSeekButtons?: boolean;
  onPrev: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onBack10?: () => void;
  onForward10?: () => void;
  className?: string;
  buttonClassName?: string;
  playButtonClassName?: string;
  seekButtonClassName?: string;
  iconClassName?: string;
  disabledClassName?: string;
};

export default function PlayerTransportControls({
  isPlaying,
  canControl,
  canSeek = false,
  showSeekButtons = false,
  onPrev,
  onTogglePlay,
  onNext,
  onBack10,
  onForward10,
  className = "flex w-full items-center justify-center gap-1.5 sm:gap-2",
  buttonClassName = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]",
  playButtonClassName = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-600 text-white shadow-[0_6px_18px_rgba(236,72,153,0.45)] transition hover:scale-105 hover:bg-pink-700 hover:shadow-[0_8px_24px_rgba(236,72,153,0.55)]",
  seekButtonClassName = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]",
  iconClassName = "h-4 w-4",
  disabledClassName = "disabled:cursor-not-allowed disabled:opacity-50",
}: PlayerTransportControlsProps) {
  return (
    <div className={className}>
      <button onClick={onPrev} disabled={!canControl} className={`${buttonClassName} ${disabledClassName}`}>
        <SkipBack className={iconClassName} />
      </button>

      {showSeekButtons ? (
        <button onClick={onBack10} disabled={!canSeek || !onBack10} className={`${seekButtonClassName} ${disabledClassName}`}>
          -10
        </button>
      ) : null}

      <button onClick={onTogglePlay} disabled={!canControl} className={`${playButtonClassName} ${disabledClassName}`}>
        {isPlaying ? <Pause className={iconClassName} /> : <Play className={iconClassName} />}
      </button>

      {showSeekButtons ? (
        <button
          onClick={onForward10}
          disabled={!canSeek || !onForward10}
          className={`${seekButtonClassName} ${disabledClassName}`}
        >
          +10
        </button>
      ) : null}

      <button onClick={onNext} disabled={!canControl} className={`${buttonClassName} ${disabledClassName}`}>
        <SkipForward className={iconClassName} />
      </button>
    </div>
  );
}
