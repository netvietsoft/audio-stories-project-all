"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import AddToPlaylistModal from "@/components/music/AddToPlaylistModal";

type AddToPlaylistButtonProps = {
  musicId: string;
  musicTitle?: string;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  className?: string;
};

export default function AddToPlaylistButton({
  musicId,
  musicTitle,
  disabled = false,
  compact = false,
  label,
  className = "",
}: AddToPlaylistButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultClassName = compact
    ? "inline-flex h-8 w-8 items-center justify-center rounded-full border border-pink-300 bg-pink-50 text-pink-700 transition hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300"
    : "inline-flex items-center gap-1.5 rounded-xl border border-pink-300 bg-pink-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-pink-700 transition hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300";

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) setIsOpen(true);
        }}
        disabled={disabled}
        className={`${defaultClassName} ${className}`}
        aria-label={label || "Add to playlist"}
      >
        <Plus className="h-3.5 w-3.5" />
        {!compact && label ? <span>{label}</span> : null}
      </button>

      <AddToPlaylistModal
        isOpen={isOpen}
        musicId={musicId}
        musicTitle={musicTitle}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
