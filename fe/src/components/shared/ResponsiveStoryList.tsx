"use client";

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

type ResponsiveStoryListProps = {
  stories: StoryItem[];
  isLoading?: boolean;
  colsDesktop?: "3" | "4" | "5";
  limit?: number;
};

const gridColsClass = {
  "3": "lg:grid-cols-3",
  "4": "lg:grid-cols-4",
  "5": "lg:grid-cols-5",
};

export default function ResponsiveStoryList({
  stories,
  isLoading = false,
  colsDesktop = "5",
  limit = 8,
}: ResponsiveStoryListProps) {
  const displayStories = stories.slice(0, limit);
  const gridClass = gridColsClass[colsDesktop];

  if (isLoading) {
    const skeletons = Array.from({ length: limit }).map((_, i) => (
      <div key={`skeleton-${i}`} className="w-[130px] sm:w-[150px] shrink-0 snap-start md:w-auto md:min-w-0">
        <div className="aspect-[4/5] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    ));
    return (
      <div className={`flex flex-row gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 justify-start items-stretch scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible ${gridClass}`}>
        {skeletons}
      </div>
    );
  }

  return (
    <div className={`flex flex-row gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 justify-start items-stretch scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible ${gridClass}`}>
      {displayStories.map((story) => (
        <div key={story.id} className="w-[130px] sm:w-[150px] shrink-0 snap-start md:w-auto md:min-w-0">
          <StoryCard story={story} />
        </div>
      ))}
    </div>
  );
}
