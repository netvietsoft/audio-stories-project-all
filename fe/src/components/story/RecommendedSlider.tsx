"use client";

import { useTranslations } from "next-intl"; 

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
  lang?: string;
};

const content = {
  vi: {
    title: "Có thể bạn sẽ thích",
  },
  en: {
    title: "You might also like",
  },
} as const;

export default function RecommendedSlider({ stories, lang }: RecommendedSliderProps) { 
  const t = useTranslations("RecommendedSlider");
  const resolvedLang = lang === "en" ? "en" : "vi";
  const localContent = content[resolvedLang];


  if (!stories.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{localContent.title || t("title")}</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-8 md:gap-3">
        {stories.slice(0, 8).map((story, index) => (
          <div key={story.id} className={`min-w-0 ${index >= 6 ? "hidden md:block" : ""}`}>
            <StoryCard
              story={story}
              className="h-full w-full"
              lang={resolvedLang}
              showFavoriteButton={false}
              compactMobile
            />
          </div>
        ))}
      </div>
    </section>
  );
}
