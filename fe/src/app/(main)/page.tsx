"use client";

import { useEffect, useState } from "react";

import StoryCard from "@/components/shared/StoryCard";
import { apiClient } from "@/lib/api/api-client";

type HomeStory = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  author?: { name: string };
};

type HomeResponse = {
  trending: HomeStory[];
  newest: HomeStory[];
  featured: HomeStory[];
};

export default function HomePage() {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHome = async () => {
      try {
        const response = await apiClient.get<HomeResponse>("/stories/home");
        setData(response.data);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHome();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải trang chủ...</p>;
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Truyện Đề Cử</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {data?.featured?.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Thịnh Hành</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {data?.trending?.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Mới Cập Nhật</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {data?.newest?.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>
    </div>
  );
}