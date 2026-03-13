"use client";

import { BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";

type Props = {
  storyId: string;
  className?: string;
};

export default function StoryUpdateSubscriptionButton({ storyId, className = "" }: Props) {
  const t = useTranslations("StoryDetail");
  const user = useUserStore((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();

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
      const redirect = pathname || "/";
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
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
    : "border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-200";

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isLoading || isHydrating}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${activeClassName} ${className}`}
      title={user ? t("subscribeHint") : t("subscribeLoginHint")}
    >
      {isLoading || isHydrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      <span>{isSubscribed ? t("subscribedUpdates") : t("subscribeUpdates")}</span>
    </button>
  );
}