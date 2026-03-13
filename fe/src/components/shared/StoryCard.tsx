import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { Eye, Star } from "lucide-react";
import FavoriteButton from "@/components/shared/FavoriteButton";
import { getLocalizedValue } from "@/lib/story-localization";

type StoryCardStory = {
  id: string;
  slug: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  author?: {
    name: string;
  };
  categories?: Array<{
    category: {
      name: string;
    };
  }>;
};

type StoryCardProps = {
  story: StoryCardStory;
  className?: string;
};

export default function StoryCard({ story, className }: StoryCardProps) {
  const t = useTranslations("StoryCard");
  const locale = useLocale();
  const isNew = story.createdAt
    ? Date.now() - new Date(story.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000
    : false;
  const statusLabel = story.status === "completed" ? t("full") : isNew ? t("new") : t("ongoing");
  const categoryLabel = story.categories?.[0]?.category?.name || t("updating");
  const rating = Number(story.averageRating || 0).toFixed(1);
  const localizedTitle = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);

  return (
    <Link
      href={`/story/${story.slug}`}
      className={`block relative w-[130px] sm:w-[150px] md:w-full shrink-0 aspect-[3/4] rounded-lg overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-shadow ${className || ""}`}
    >
      <Image
        src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
        alt={localizedTitle}
        fill
        sizes="(max-width: 768px) 150px, 250px"
        className="object-cover transition-transform duration-500 group-hover:scale-110"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none z-0" />

      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          {statusLabel}
        </span>
        <span className="bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
          {categoryLabel}
        </span>
      </div>

      <FavoriteButton
        storyId={story.id}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 hover:text-red-400 transition-colors pointer-events-auto"
      />

      <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 z-10 pointer-events-none flex flex-col">
        <h3 className="text-white font-bold text-sm md:text-base leading-tight line-clamp-2 mb-1">
          {localizedTitle}
        </h3>

        <p className="text-gray-300 text-[10px] md:text-xs truncate mb-1.5 md:mb-2">
          {story.author?.name || t("updating")}
        </p>

        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-1 text-[10px] md:text-xs text-yellow-400 font-medium">
            <Star className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" />
            <span>{rating}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-300">
            <Eye className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>{Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
