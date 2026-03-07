import Link from "next/link";
import { useState } from "react";

import { Eye, Heart } from "lucide-react";

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
  const [isFav, setIsFav] = useState(false);

  return (
    <Link
      href={`/story/${story.slug}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
          alt={story.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
          {statusLabel}
        </span>

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsFav((prev) => !prev);
          }}
          className={`absolute right-2 top-2 rounded-full p-2 backdrop-blur-sm transition ${
            isFav
              ? "bg-red-500/90 text-white"
              : "bg-black/35 text-white hover:bg-white/30"
          }`}
          aria-label="Them vao yeu thich"
        >
          <Heart className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
        </button>

        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-white drop-shadow-md">{story.title}</h3>
          <p className="mt-1 truncate text-xs text-gray-200">{story.author?.name || "Dang cap nhat"}</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-200">
            <Eye className="h-3.5 w-3.5" />
            <span>{Number(story.totalViews || 0).toLocaleString("vi-VN")} luot nghe</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
