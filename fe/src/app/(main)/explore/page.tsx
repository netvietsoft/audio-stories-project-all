"use client";

import { useEffect, useMemo, useState } from "react";

import StoryCard from "@/components/shared/StoryCard";
import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import { apiClient } from "@/lib/api/api-client";
import { fetchExploreCached } from "@/lib/api/public-story-cache";

type StoryItem = {
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

type ExploreResponse = {
  data: StoryItem[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
};

type CategoryOption = {
  id: number;
  name: string;
  slug: string;
};

type AuthorOption = {
  id: string;
  name: string;
};

const LIMIT = 20;

export default function ExplorePage() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [filters, setFilters] = useState<StoryFilterValue>({
    categoryId: "",
    authorId: "",
    status: "",
    sort: "latest",
  });
  const [appliedFilters, setAppliedFilters] = useState<StoryFilterValue>({
    categoryId: "",
    authorId: "",
    status: "",
    sort: "latest",
  });
  const [isLoading, setIsLoading] = useState(false);

  const canLoadMore = useMemo(() => page < lastPage, [page, lastPage]);

  const fetchStories = async (nextPage: number, replace = false) => {
    setIsLoading(true);
    try {
      const response = await fetchExploreCached<ExploreResponse>({
        page: nextPage,
        limit: LIMIT,
        ...(appliedFilters.categoryId ? { categoryId: appliedFilters.categoryId } : {}),
        ...(appliedFilters.authorId ? { authorId: appliedFilters.authorId } : {}),
        ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
        sort: appliedFilters.sort,
      });

      setPage(response.meta.page);
      setLastPage(response.meta.lastPage);
      setStories((prev) => (replace ? response.data : [...prev, ...response.data]));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    const [categoryRes, authorRes] = await Promise.all([
      apiClient.get<CategoryOption[]>("/stories/categories"),
      apiClient.get<AuthorOption[]>("/stories/authors"),
    ]);

    setCategories(categoryRes.data);
    setAuthors(authorRes.data);
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchStories(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  return (
    <div className="space-y-6">
      <StoryFilterBar
        categories={categories}
        authors={authors}
        value={filters}
        onChange={setFilters}
        onApply={() => setAppliedFilters(filters)}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>

      <div className="flex justify-center">
        {canLoadMore ? (
          <button
            disabled={isLoading}
            onClick={() => fetchStories(page + 1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {isLoading ? "Đang tải..." : "Xem thêm"}
          </button>
        ) : (
          <p className="text-sm text-gray-500">Đã hiển thị hết dữ liệu.</p>
        )}
      </div>
    </div>
  );
}
