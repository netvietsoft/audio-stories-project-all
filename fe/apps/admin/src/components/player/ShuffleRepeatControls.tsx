"use client";

import { Repeat, Repeat1, Shuffle } from "lucide-react";

import type { RepeatMode } from "@/lib/player/playback-modes";

type ShuffleRepeatControlsProps = {
  isShuffle: boolean;
  repeatMode: RepeatMode;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
  buttonClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  disabled?: boolean;
};

export default function ShuffleRepeatControls({
  isShuffle,
  repeatMode,
  onToggleShuffle,
  onCycleRepeatMode,
  buttonClassName = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition",
  activeClassName = "border-pink-500 bg-pink-50 text-pink-600 dark:bg-pink-900/30",
  inactiveClassName = "border-gray-300 bg-white text-gray-500 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-300",
  disabled = false,
}: ShuffleRepeatControlsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleShuffle}
        disabled={disabled}
        className={`${buttonClassName} ${isShuffle ? activeClassName : inactiveClassName}`}
        aria-label="Toggle shuffle"
      >
        <Shuffle className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onCycleRepeatMode}
        disabled={disabled}
        className={`${buttonClassName} ${repeatMode !== "off" ? activeClassName : inactiveClassName}`}
        aria-label="Cycle repeat mode"
      >
        {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
      </button>
    </>
  );
}
