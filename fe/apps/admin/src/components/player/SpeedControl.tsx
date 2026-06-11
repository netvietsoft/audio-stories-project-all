"use client";

type SpeedControlProps = {
  playbackRate: number;
  disabled?: boolean;
  onCycleSpeed: () => void;
  className?: string;
  label?: string;
};

export default function SpeedControl({
  playbackRate,
  disabled = false,
  onCycleSpeed,
  className = "rounded-md border px-2 py-1 text-xs font-semibold transition border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-[#3a3b3c] dark:bg-[#2f3133] dark:text-gray-200 dark:hover:bg-[#3a3b3c]",
  label = "Speed",
}: SpeedControlProps) {
  return (
    <button
      type="button"
      onClick={onCycleSpeed}
      disabled={disabled}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-40`}
      title={label}
      aria-label={label}
    >
      {playbackRate}x
    </button>
  );
}
