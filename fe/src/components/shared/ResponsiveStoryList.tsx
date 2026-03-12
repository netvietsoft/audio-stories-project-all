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
      <div key={`skeleton-${i}`} className="w-[160px] min-w-[160px] flex-shrink-0 snap-start md:w-auto md:min-w-0 md:flex-shrink-0">
        <div className="aspect-[4/5] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    ));
    return (
      <div className={`flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible scrollbar-hide ${gridClass}`}>
        {skeletons}
      </div>
    );
  }

  return (
    <div className={`flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible scrollbar-hide ${gridClass}`}>
      {displayStories.map((story) => (
        <div key={story.id} className="w-[160px] min-w-[160px] flex-shrink-0 snap-start md:w-auto md:min-w-0 md:flex-shrink-0">
          <StoryCard story={story} />
        </div>
      ))}
    </div>
  );
}
