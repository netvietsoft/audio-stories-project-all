import Link from "next/link";

import { Eye } from "lucide-react";

type StoryCardStory = {
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

type StoryCardProps = {
  story: StoryCardStory;
};

export default function StoryCard({ story }: StoryCardProps) {
  const statusLabel = story.status === "completed" ? "Full" : "Đang ra";

  return (
    <Link
      href={`/story/${story.slug}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
          alt={story.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 min-h-[40px] text-sm font-semibold text-gray-900 dark:text-gray-100">
          {story.title}
        </h3>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{story.author?.name || "Đang cập nhật"}</p>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Eye className="h-3.5 w-3.5" />
          <span>{Number(story.totalViews || 0).toLocaleString("vi-VN")} lượt nghe</span>
        </div>
      </div>
    </Link>
  );
}
