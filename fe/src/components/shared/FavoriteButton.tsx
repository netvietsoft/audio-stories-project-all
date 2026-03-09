"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";

import { useUserStore } from "@/stores/user-store";
import { useFavoriteStore } from "@/stores/favorite-store";

type FavoriteButtonProps = {
  storyId: string;
  size?: "sm" | "md";
  className?: string;
};

export default function FavoriteButton({ storyId, size = "sm", className = "" }: FavoriteButtonProps) {
  const user = useUserStore((state) => state.user);
  const hydrate = useFavoriteStore((state) => state.hydrate);
  const toggle = useFavoriteStore((state) => state.toggle);
  const isFavorite = useFavoriteStore((state) => state.isFavorite(storyId));

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void hydrate();
  }, [hydrate, user]);

  const padding = useMemo(() => (size === "md" ? "p-2.5" : "p-2"), [size]);
  const iconSize = useMemo(() => (size === "md" ? "h-5 w-5" : "h-4 w-4"), [size]);

  return (
    <button
      type="button"
      disabled={!user || isSubmitting}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!user || isSubmitting) return;

        setIsSubmitting(true);
        try {
          await toggle(storyId);
        } finally {
          setIsSubmitting(false);
        }
      }}
      className={`${padding} rounded-full backdrop-blur-sm transition ${
        isFavorite
          ? "bg-red-500/90 text-white"
          : "bg-black/35 text-white hover:bg-white/30 disabled:bg-black/20"
      } ${className}`}
      aria-label="Them vao yeu thich"
      title={user ? "Them vao yeu thich" : "Dang nhap de luu yeu thich"}
    >
      <Heart className={iconSize} fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
}
