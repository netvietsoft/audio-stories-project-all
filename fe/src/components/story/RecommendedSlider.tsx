"use client";

import { useRef, useState, useEffect } from "react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

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

  // Auto-scroll every 5 seconds, pause on hover
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 10;

        if (isAtEnd) {
          // Reset to beginning
          scrollContainerRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          // Scroll to next
          scrollContainerRef.current.scrollBy({ left: 400, behavior: "smooth" });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isHovered]);

  if (!stories.length) {
    return null;
  }

  // Repeat stories multiple times to ensure we always fill the viewport and have a seamless loop
  const repeatedStories = [...stories, ...stories, ...stories, ...stories];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("title")}</h3>
      </div>

      <div className="relative w-full group/slider" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
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
          className="relative w-full overflow-x-auto overflow-y-hidden pb-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-4">
            {repeatedStories.map((story, idx) => (
              <div key={`${story.id}-${idx}`} className="w-[180px] sm:w-[210px] shrink-0 group transition-transform duration-300 hover:scale-105 hover:-translate-y-1">
                <StoryCard story={story} className="h-full w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
