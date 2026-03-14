"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import StoryCard from "@/components/shared/StoryCard";

type RecommendedStory = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  author?: {
    name: string;
  };
};

type RecommendedSliderProps = {
  stories: RecommendedStory[];
};

export default function RecommendedSlider({ stories }: RecommendedSliderProps) {
  const t = useTranslations("RecommendedSlider");

  if (!stories.length) {
    return null;
  }

  // Duplicate stories to create the seamless loop
  const duplicatedStories = [...stories, ...stories];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("title")}</h3>
      </div>

      <div className="relative w-full overflow-hidden pb-1 pause-on-hover">
        <div className="animate-marquee flex gap-4">
          {duplicatedStories.map((story, idx) => (
            <div key={`${story.id}-${idx}`} className="w-[180px] sm:w-[210px] shrink-0 group transition-transform duration-300 hover:scale-105 hover:-translate-y-1">
              <StoryCard story={story} className="h-full w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
