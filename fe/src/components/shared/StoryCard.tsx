import Link from "next/link";
import Image from "next/image";

import { Eye } from "lucide-react";
import FavoriteButton from "@/components/shared/FavoriteButton";

type StoryCardStory = {
  id: string;
  slug: string;
  title: string;
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
  const isNew = story.createdAt
    ? Date.now() - new Date(story.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000
    : false;
  const statusLabel = story.status === "completed" ? "Full" : isNew ? "New" : "Đang ra";
  const categoryLabel = story.categories?.[0]?.category?.name || "Đang cập nhật";
  const rating = Number(story.averageRating || 0).toFixed(1);

  return (
    <Link
      href={`/story/${story.slug}`}
      className={`group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 ${className || ""}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <Image
          src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
          alt={story.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
          {statusLabel}
        </span>

        <span className="absolute left-2 top-10 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          {categoryLabel}
        </span>

        <div className="absolute right-2 top-2">
          <FavoriteButton storyId={story.id} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-white drop-shadow-md">{story.title}</h3>
          <p className="mt-1 truncate text-xs text-gray-200">{story.author?.name || "Đang cập nhật"}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-200">
            <span>★ {rating}</span>
            <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {Number(story.totalViews || 0).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
