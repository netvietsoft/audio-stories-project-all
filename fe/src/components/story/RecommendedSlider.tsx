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
  tone?: "default" | "reader";
};

const content = {
  vi: {
    title: "Có thể bạn sẽ thích",
  },
  en: {
    title: "You might also like",
  },
} as const;

export default function RecommendedSlider({ stories, lang, tone = "default" }: RecommendedSliderProps) { 
  const t = useTranslations("RecommendedSlider");
  const resolvedLang = lang === "en" ? "en" : "vi";
  const localContent = content[resolvedLang];
  const sectionClassName =
    tone === "reader"
      ? "rounded-2xl border border-gray-200 bg-gray-50/80 p-3 md:p-4 dark:border-[#303133] dark:bg-[#232325]"
      : "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";
  const cardClassName =
    tone === "reader"
      ? "h-full w-full bg-white/95 ring-1 ring-gray-200/70 dark:bg-[#1b2230] dark:ring-[#2d3442]"
      : "h-full w-full";


  if (!stories.length) {
    return null;
  }

  return (
    <section className={sectionClassName}>
      <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
        <h3 className="text-base font-semibold text-gray-900 md:text-lg dark:text-gray-100">{localContent.title || t("title")}</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-8 md:gap-3">
        {stories.slice(0, 8).map((story, index) => (
          <div key={story.id} className={`min-w-0 ${index >= 6 ? "hidden md:block" : ""}`}>
            <StoryCard
              story={story}
              className={cardClassName}
              lang={resolvedLang}
              showFavoriteButton={false}
              compactMobile
              hideMobileStats={tone === "reader"}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
