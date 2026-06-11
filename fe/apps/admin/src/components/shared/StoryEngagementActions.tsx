"use client";

import { Share2 } from "lucide-react";

import FavoriteButton from "@/components/shared/FavoriteButton";
import StoryUpdateSubscriptionButton from "@/components/shared/StoryUpdateSubscriptionButton";

type StoryEngagementActionsProps = {
  storyId: string;
  favoriteLabel: string;
  shareLabel: string;
  onShare: () => void;
};

export default function StoryEngagementActions({
  storyId,
  favoriteLabel,
  shareLabel,
  onShare,
}: StoryEngagementActionsProps) {
  return (
    <div className="mt-3 flex justify-center items-center gap-3 md:gap-4">
      <FavoriteButton
        storyId={storyId}
        size="sm"
        label={favoriteLabel}
        labelClassName="hidden md:inline"
        className="px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-medium border shadow-sm transition-colors"
        activeClassName="border-red-500 bg-red-500 text-white hover:bg-red-600"
        inactiveClassName="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
      />

      <StoryUpdateSubscriptionButton
        storyId={storyId}
        className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-medium shadow-sm transition-colors"
        labelClassName="hidden md:inline"
        activeClassName="border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        inactiveClassName="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
      />

      <button
        onClick={onShare}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
        aria-label={shareLabel}
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden md:inline">{shareLabel}</span>
      </button>
    </div>
  );
}
