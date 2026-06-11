"use client";

import { Volume2, VolumeX } from "lucide-react";

type VolumeControlProps = {
  volume: number;
  isMuted: boolean;
  disabled?: boolean;
  accentRgb?: string;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  buttonClassName?: string;
  sliderClassName?: string;
  thumbClassName?: string;
};

export default function VolumeControl({
  volume,
  isMuted,
  disabled = false,
  accentRgb = "107 114 128",
  onVolumeChange,
  onToggleMute,
  buttonClassName = "rounded-full p-2 transition text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3b3c]",
  sliderClassName = "h-1.5 w-24 cursor-pointer appearance-none rounded-full md:w-28",
  thumbClassName = "[&::-webkit-slider-thumb]:bg-gray-600 [&::-moz-range-thumb]:bg-gray-600 dark:[&::-webkit-slider-thumb]:bg-zinc-100 dark:[&::-moz-range-thumb]:bg-zinc-100",
}: VolumeControlProps) {
  const volumePercent = Math.round(Math.max(0, Math.min(1, volume)) * 100);
  const disabledClass = "disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      <button
        onClick={onToggleMute}
        disabled={disabled}
        className={`${buttonClassName} ${disabledClass}`}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(event) => onVolumeChange(Number(event.target.value))}
        disabled={disabled}
        className={`${sliderClassName} [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 ${thumbClassName} ${disabledClass}`}
        style={{
          background: `linear-gradient(to right, rgb(${accentRgb}) 0%, rgb(${accentRgb}) ${volumePercent}%, rgb(209 213 219) ${volumePercent}%, rgb(209 213 219) 100%)`,
        }}
        aria-label="Volume"
      />
    </>
  );
}
