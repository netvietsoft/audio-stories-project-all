"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart } from "lucide-react";

import { useUserStore } from "@/stores/user-store";
import { useFavoriteStore } from "@/stores/favorite-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";

type FavoriteButtonProps = {
  storyId: string;
  size?: "sm" | "md";
  className?: string;
  label?: string;
  icon?: "heart" | "bookmark";
  activeClassName?: string;
  inactiveClassName?: string;
  labelClassName?: string;
};

export default function FavoriteButton({
  storyId,
  size = "sm",
  className = "",
  label,
  icon = "heart",
  activeClassName,
  inactiveClassName,
  labelClassName,
}: FavoriteButtonProps) {
  const user = useUserStore((state) => state.user);
  const hydrate = useFavoriteStore((state) => state.hydrate);
  const toggle = useFavoriteStore((state) => state.toggle);
  const isFavorite = useFavoriteStore((state) => state.isFavorite(storyId));
  const openLogin = useAuthModalStore((state) => state.openLogin);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void hydrate();
  }, [hydrate, user]);

  const padding = useMemo(() => (size === "md" ? "p-2.5" : "p-2"), [size]);
  const iconSize = useMemo(() => (size === "md" ? "h-5 w-5" : "h-4 w-4"), [size]);
  const stateClassName = isFavorite
    ? activeClassName || "bg-red-500/90 text-white"
    : inactiveClassName || "bg-black/35 text-white hover:bg-white/30 disabled:bg-black/20";

  return (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isSubmitting) return;

        if (!user) {
          openLogin();
          return;
        }

        setIsSubmitting(true);
        try {
          await toggle(storyId);
        } finally {
          setIsSubmitting(false);
        }
      }}
      className={`${padding} rounded-full backdrop-blur-sm transition inline-flex items-center gap-2 ${className} ${stateClassName}`}
      aria-label={label || "Yêu thích"}
      title={label || (user ? "Yêu thích" : "Đăng nhập để lưu yêu thích")}
    >
      {icon === "bookmark" ? (
        <Bookmark className={iconSize} fill={isFavorite ? "currentColor" : "none"} />
      ) : (
        <Heart className={iconSize} fill={isFavorite ? "currentColor" : "none"} />
      )}
      {label ? <span className={labelClassName}>{label}</span> : null}
    </button>
  );
}
