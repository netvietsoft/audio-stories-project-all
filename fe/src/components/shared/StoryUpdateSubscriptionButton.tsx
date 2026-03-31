"use client";

import { BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api/api-client";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { useUserStore } from "@/stores/user-store";

type Props = {
  storyId: string;
  className?: string;
  labelClassName?: string;
};

export default function StoryUpdateSubscriptionButton({ storyId, className = "", labelClassName }: Props) {
  const t = useTranslations("StoryDetail");
  const user = useUserStore((state) => state.user);
  const openLogin = useAuthModalStore((state) => state.openLogin);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);

  useEffect(() => {
    if (!user || !storyId) {
      setIsSubscribed(false);
      return;
    }

    let active = true;
    setIsHydrating(true);

    void apiClient
      .get<{ isSubscribed: boolean }>(`/story-subscriptions/${storyId}/status`)
      .then((response) => {
        if (!active) return;
        setIsSubscribed(Boolean(response.data.isSubscribed));
      })
      .catch(() => {
        if (!active) return;
        setIsSubscribed(false);
      })
      .finally(() => {
        if (!active) return;
        setIsHydrating(false);
      });

    return () => {
      active = false;
    };
  }, [storyId, user]);

  const handleClick = async () => {
    if (!user) {
      openLogin();
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await apiClient.post<{ isSubscribed: boolean }>(`/story-subscriptions/${storyId}/toggle`);
      setIsSubscribed(Boolean(response.data.isSubscribed));
    } finally {
      setIsLoading(false);
    }
  };

  const activeClassName = isSubscribed
    ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
    : "border-gray-300 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-pink-700 dark:hover:bg-pink-950/40 dark:hover:text-pink-200";
  const buttonLabel = isSubscribed ? t("subscribedUpdates") : t("subscribeUpdates");

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isLoading || isHydrating}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${activeClassName} ${className}`}
      title={user ? t("subscribeHint") : t("subscribeLoginHint")}
      aria-label={buttonLabel}
    >
      {isLoading || isHydrating ? <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" /> : <BellRing className="h-[18px] w-[18px] shrink-0" />}
      <span className={labelClassName}>{buttonLabel}</span>
    </button>
  );
}
