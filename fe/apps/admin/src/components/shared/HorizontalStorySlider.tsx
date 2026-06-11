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
  showArrows?: boolean;
  size?: "default" | "large";
  fixedDesktopCols?: 0 | 5;
};

export default function HorizontalStorySlider({
  stories,
  isLoading = false,
  limit = 10,
  showArrows = true,
  size = "default",
  fixedDesktopCols = 0,
}: Props) {
  const sliderRef = useRef<HTMLDivElement>(null);

  const slide = (direction: "left" | "right") => {
    if (sliderRef.current) {
      const scrollAmount = direction === "left" ? -600 : 600;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const displayStories = stories.slice(0, limit);
  const itemClass =
    size === "large"
      ? "w-[150px] sm:w-[170px] md:w-[200px] lg:w-[220px] shrink-0 snap-start"
      : "w-[130px] sm:w-[150px] md:w-[170px] lg:w-[190px] shrink-0 snap-start";
  const containerClass =
    fixedDesktopCols === 5
      ? "flex flex-row gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide pb-4 w-full lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible lg:snap-none"
      : "flex flex-row gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide pb-4 w-full";

  return (
    <div className="relative w-full">
      {/* Nút trượt trái */}
      {showArrows ? (
        <button
          onClick={() => slide("left")}
          aria-label="Trượt trái"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center w-10 h-10 bg-black/60 hover:bg-black text-white rounded-full shadow-lg transition-all duration-200 -ml-4"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : null}

      {/* Container trượt ngang */}
      <div ref={sliderRef} className={containerClass}>
        {isLoading
          ? Array.from({ length: limit }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className={`${itemClass} ${fixedDesktopCols === 5 ? "lg:w-auto" : ""} transition-transform duration-300 hover:scale-105 hover:-translate-y-1`}
              >
                <div className="aspect-[3/4] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
            ))
          : displayStories.map((story) => (
              <div
                key={story.id}
                className={`${itemClass} ${fixedDesktopCols === 5 ? "lg:w-auto" : ""} group transition-transform duration-300 hover:scale-105 hover:-translate-y-1`}
              >
                <StoryCard story={story} />
              </div>
            ))}
      </div>

      {/* Nút trượt phải */}
      {showArrows ? (
        <button
          onClick={() => slide("right")}
          aria-label="Trượt phải"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center w-10 h-10 bg-black/60 hover:bg-black text-white rounded-full shadow-lg transition-all duration-200 -mr-4"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      ) : null}
    </div>
  );
}
