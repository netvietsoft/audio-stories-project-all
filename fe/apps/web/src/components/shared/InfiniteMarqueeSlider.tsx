"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import StoryCard from "@/components/shared/StoryCard";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  author?: { id?: string; name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type Props = {
  stories: StoryItem[];
  isLoading?: boolean;
  limit?: number;
  itemSize?: "default" | "featured";
  cardVariant?: "default" | "featured";
};

export default function InfiniteMarqueeSlider({
  stories,
  isLoading = false,
  limit = 20,
  itemSize = "default",
  cardVariant = "default",
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = 400; // Scroll by ~2 cards
    const currentScroll = scrollContainerRef.current.scrollLeft;
    const targetScroll = direction === "left"
      ? currentScroll - scrollAmount
      : currentScroll + scrollAmount;

    scrollContainerRef.current.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    });
  };

  if (isLoading) {
    const itemClass =
      itemSize === "featured"
        ? "w-[180px] sm:w-[210px] md:w-[230px] lg:w-[250px]"
        : "w-[130px] sm:w-[150px] md:w-[170px] lg:w-[190px]";

    return (
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${itemClass} shrink-0`}>
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  const displayStories = stories.slice(0, limit);
  const itemClass =
    itemSize === "featured"
      ? "w-[180px] sm:w-[210px] md:w-[230px] lg:w-[250px]"
      : "w-[130px] sm:w-[150px] md:w-[170px] lg:w-[190px]";
  // Repeat stories multiple times to ensure we always fill the viewport and have a seamless loop
  // Using 4x repetition as a safe default for small lists (e.g. 5-6 stories)
  const repeatedStories = [...displayStories, ...displayStories, ...displayStories, ...displayStories];

  return (
    <div className="relative w-full group/slider">
      {/* Left Arrow Button */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full p-2 shadow-lg opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Right Arrow Button */}
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full p-2 shadow-lg opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-6 w-6 text-gray-700 dark:text-gray-300" />
      </button>

      <div
        ref={scrollContainerRef}
        className="relative w-full overflow-x-auto overflow-y-hidden pb-4 pause-on-hover scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="animate-marquee flex gap-4">
          {repeatedStories.map((story, idx) => (
            <div
              key={`${story.id}-${idx}`}
              className={`${itemClass} shrink-0 group transition-transform duration-300 hover:scale-105 hover:-translate-y-1`}
            >
              <StoryCard story={story} variant={cardVariant} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
