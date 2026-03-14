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

type Props = {
  stories: StoryItem[];
  isLoading?: boolean;
  limit?: number;
};

export default function InfiniteMarqueeSlider({
  stories,
  isLoading = false,
  limit = 20,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[130px] sm:w-[150px] md:w-[170px] lg:w-[190px] shrink-0">
            <div className="aspect-[3/4] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  const displayStories = stories.slice(0, limit);
  // Duplicate stories to create the seamless loop
  const duplicatedStories = [...displayStories, ...displayStories];

  return (
    <div className="relative w-full overflow-hidden pb-4 pause-on-hover">
      <div className="animate-marquee flex gap-4">
        {duplicatedStories.map((story, idx) => (
          <div
            key={`${story.id}-${idx}`}
            className="w-[130px] sm:w-[150px] md:w-[170px] lg:w-[190px] shrink-0 group transition-transform duration-300 hover:scale-105 hover:-translate-y-1"
          >
            <StoryCard story={story} />
          </div>
        ))}
      </div>
    </div>
  );
}
