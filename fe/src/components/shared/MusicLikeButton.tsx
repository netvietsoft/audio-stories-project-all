"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";

import { toggleMusicLike } from "@/lib/music/music-interactions";
import { formatCompactCount } from "@/lib/music/normalize-music";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { useUserStore } from "@/stores/user-store";

type MusicLikeButtonProps = {
  musicId: string;
  initialLiked?: boolean;
  likeCount: number;
  /** compact icon-only mode (no label, smaller) */
  compact?: boolean;
  className?: string;
  onLikeChanged?: (liked: boolean, newCount: number) => void;
};

export default function MusicLikeButton({
  musicId,
  initialLiked = false,
  likeCount,
  compact = false,
  className = "",
  onLikeChanged,
}: MusicLikeButtonProps) {
  const accessToken = useUserStore((state) => state.accessToken);
  const openLogin = useAuthModalStore((state) => state.openLogin);

  const [isLiked, setIsLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!accessToken) {
      openLogin();
      return;
    }

    if (isLoading) return;

    setIsLoading(true);

    try {
      const result = await toggleMusicLike(musicId, isLiked);
      const nextLiked = result.liked;
      const nextCount =
        typeof result.likeCount === "number"
          ? result.likeCount
          : nextLiked
            ? count + 1
            : Math.max(0, count - 1);

      setIsLiked(nextLiked);
      setCount(nextCount);
      onLikeChanged?.(nextLiked, nextCount);
    } catch {
      // Keep UI stable on failure.
    } finally {
      setIsLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => void handleClick(e)}
        disabled={isLoading}
        className={`inline-flex items-center gap-1 text-xs font-semibold transition disabled:opacity-60 ${
          isLiked
            ? "text-orange-600 dark:text-orange-300"
            : "text-slate-500 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-300"
        } ${className}`}
        aria-label={isLiked ? "Unlike" : "Like"}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
        )}
        <span>{formatCompactCount(count)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-60 ${
        isLiked
          ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300"
          : "border-slate-300 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-zinc-300"
      } ${className}`}
      aria-label={isLiked ? "Unlike" : "Like"}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
      )}
      <span>{formatCompactCount(count)}</span>
    </button>
  );
}
