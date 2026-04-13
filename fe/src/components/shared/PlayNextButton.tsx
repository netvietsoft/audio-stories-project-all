"use client";

import { Check, ChevronsRight } from "lucide-react";

import { useAudioStore } from "@/stores/audio-store";
import type { AudioTrack } from "@/stores/audio-store";

type PlayNextButtonProps = {
  targetId: string;
  tracks: AudioTrack[];
  label?: string;
  compact?: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export default function PlayNextButton({
  targetId,
  tracks,
  label,
  compact = false,
  className = "",
  activeClassName = "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  inactiveClassName = "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-600 dark:border-[#343434] dark:bg-[#1b1b1b] dark:text-zinc-200",
}: PlayNextButtonProps) {
  const queuedNextMap = useAudioStore((state) => state.queuedNextMap);
  const toggleQueuedNext = useAudioStore((state) => state.toggleQueuedNext);

  const isQueuedNext = Boolean(queuedNextMap[targetId]);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!tracks.length) return;
    toggleQueuedNext(targetId, tracks);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
          isQueuedNext ? activeClassName : inactiveClassName
        } ${className}`}
        aria-label={label || "Play Next"}
      >
        {isQueuedNext ? <Check className="h-3.5 w-3.5" /> : <ChevronsRight className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
        isQueuedNext ? activeClassName : inactiveClassName
      } ${className}`}
      aria-label={label || "Play Next"}
    >
      {isQueuedNext ? <Check className="h-3.5 w-3.5" /> : <ChevronsRight className="h-3.5 w-3.5" />}
      {label ? <span>{label}</span> : null}
    </button>
  );
}
