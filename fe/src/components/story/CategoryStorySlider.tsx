"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import StoryCard from "@/components/shared/StoryCard";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  author?: { id?: string; name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type CategoryStorySliderProps = {
  stories: StoryItem[];
  isLoading?: boolean;
};

export default function CategoryStorySlider({ stories, isLoading = false }: CategoryStorySliderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = Math.max(container.clientWidth * 0.8, 260);
    const targetScroll = direction === "left" ? container.scrollLeft - scrollAmount : container.scrollLeft + scrollAmount;
    container.scrollTo({ left: targetScroll, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  const displayStories = stories.slice(0, 8);
  if (!displayStories.length) {
    return null;
  }

  return (
    <div className="group/slider relative">
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute -left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/95 p-2 text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-white dark:bg-slate-900/95 dark:text-slate-200 dark:ring-slate-700 hidden md:block md:opacity-0 md:invisible md:group-hover/slider:opacity-100 md:group-hover/slider:visible md:pointer-events-none md:group-hover/slider:pointer-events-auto"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute -right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/95 p-2 text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-white dark:bg-slate-900/95 dark:text-slate-200 dark:ring-slate-700 hidden md:block md:opacity-0 md:invisible md:group-hover/slider:opacity-100 md:group-hover/slider:visible md:pointer-events-none md:group-hover/slider:pointer-events-auto"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div ref={scrollContainerRef} className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex gap-4 pr-6">
          {displayStories.map((story) => (
            <div key={story.id} className="w-[52%] shrink-0 sm:w-[35%] md:w-[24%] lg:w-[18.5%] xl:w-[16%]">
              <StoryCard story={story} variant="overlay" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}