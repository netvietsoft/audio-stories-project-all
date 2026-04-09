"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";

export type MusicCardTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
};

type MusicCardProps = {
  track: MusicCardTrack;
  isActive: boolean;
  isPlaying: boolean;
  playAriaLabel: string;
  pauseAriaLabel: string;
  onSelect: () => void;
  onPlayPause: () => void;
};

export default function MusicCard({
  track,
  isActive,
  isPlaying,
  playAriaLabel,
  pauseAriaLabel,
  onSelect,
  onPlayPause,
}: MusicCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group rounded-xl border p-2 text-left transition ${
        isActive
          ? "border-pink-500 bg-pink-50 dark:bg-pink-950/20"
          : "border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50/40 dark:border-[#2b2c2d] dark:bg-[#181818] dark:hover:border-pink-700/60 dark:hover:bg-[#202020]"
      }`}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg">
        <Image
          src={track.thumbnailUrl}
          alt={track.title}
          width={320}
          height={320}
          unoptimized
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPlayPause();
          }}
          aria-label={isPlaying ? pauseAriaLabel : playAriaLabel}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pink-600 text-white shadow-lg transition hover:scale-105 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </span>
        </button>
      </div>

      <div className="mt-2 min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{track.title}</p>
        <p className="truncate text-xs text-gray-600 dark:text-zinc-400">{track.artist}</p>
      </div>
    </article>
  );
}