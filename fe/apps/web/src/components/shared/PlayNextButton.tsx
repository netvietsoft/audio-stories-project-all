"use client";

import { useState } from "react";
import { Check, ChevronsRight } from "lucide-react";

import { useAudioStore } from "@/stores/audio-store";
import type { AudioTrack } from "@/stores/audio-store";

type PlayNextButtonProps = {
  targetId: string;
  tracks: AudioTrack[];
  resolveTracks?: () => Promise<AudioTrack[]>;
  label?: string;
  compact?: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export default function PlayNextButton({
  targetId,
  tracks,
  resolveTracks,
  label,
  compact = false,
  className = "",
  activeClassName = "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-900/50 dark:bg-pink-950/30 dark:text-pink-300",
  inactiveClassName = "border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:text-pink-600 dark:border-[#343434] dark:bg-[#1b1b1b] dark:text-zinc-200",
}: PlayNextButtonProps) {
  const queuedNextMap = useAudioStore((state) => state.queuedNextMap);
  const toggleQueuedNext = useAudioStore((state) => state.toggleQueuedNext);
  const [isResolving, setIsResolving] = useState(false);

  const isQueuedNext = Boolean(queuedNextMap[targetId]);

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (tracks.length) {
      toggleQueuedNext(targetId, tracks);
      return;
    }

    if (!resolveTracks || isResolving) return;

    setIsResolving(true);
    try {
      const resolvedTracks = await resolveTracks();
      if (!resolvedTracks.length) return;
      toggleQueuedNext(targetId, resolvedTracks);
    } catch {
      // Keep button stable when resolving playlist tracks fails.
    } finally {
      setIsResolving(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={(event) => {
          void handleClick(event);
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
          isQueuedNext ? activeClassName : inactiveClassName
        } ${className}`}
        aria-label={label || "Play Next"}
      >
        {isResolving ? (
          <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-current/60" />
        ) : isQueuedNext ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <ChevronsRight className="h-3.5 w-3.5" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        void handleClick(event);
      }}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
        isQueuedNext ? activeClassName : inactiveClassName
      } ${className}`}
      aria-label={label || "Play Next"}
    >
      {isResolving ? (
        <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-current/60" />
      ) : isQueuedNext ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <ChevronsRight className="h-3.5 w-3.5" />
      )}
      {label ? <span>{label}</span> : null}
    </button>
  );
}
