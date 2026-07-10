"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import StoryCard from "@/components/shared/StoryCard";
import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import { apiClient } from "@/lib/api/api-client";
import { fetchExploreCached } from "@/lib/api/public-story-cache";
import { unwrapList } from "@/lib/api/unwrap";

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

function ExploreContent() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const lang = locale === "en" ? "en" : "vi";
  
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  
  // Initialize filters from searchParams
  const initialFilters = useMemo(() => ({
    categoryId: searchParams.get("categoryId") || "",
    authorId: searchParams.get("authorId") || "",
    status: (searchParams.get("status") as any) || "",
    sort: (searchParams.get("sort") as any) || "latest",
  }), [searchParams]);

  const [filters, setFilters] = useState<StoryFilterValue>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<StoryFilterValue>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);

  // Update filters if URL changes
  useEffect(() => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }, [initialFilters]);

  const canLoadMore = useMemo(() => page < lastPage, [page, lastPage]);

  const fetchStories = async (nextPage: number, replace = false) => {
    setIsLoading(true);
    try {
      const response = await fetchExploreCached<ExploreResponse>({
        page: nextPage,
        limit: LIMIT,
        lang,
        ...(appliedFilters.categoryId ? { categoryId: appliedFilters.categoryId } : {}),
        ...(appliedFilters.authorId ? { authorId: appliedFilters.authorId } : {}),
        ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
        sort: appliedFilters.sort,
      });

      const nextStories = unwrapList<StoryItem>(response);
      setPage((response.data as any)?.meta?.page ?? response.meta?.page ?? nextPage);
      setLastPage((response.data as any)?.meta?.lastPage ?? response.meta?.lastPage ?? 1);
      setStories((prev) => (replace ? nextStories : [...prev, ...nextStories]));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    const [categoryRes, authorRes] = await Promise.all([
      apiClient.get<CategoryOption[]>("/stories/categories", {
        params: { language: lang }
      }),
      apiClient.get<AuthorOption[]>("/stories/authors"),
    ]);

    setCategories(unwrapList<CategoryOption>(categoryRes.data));
    setAuthors(unwrapList<AuthorOption>(authorRes.data));
  };

  useEffect(() => {
    fetchFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    fetchStories(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, lang]);

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
            {isLoading ? t("loading") : t("loadMore")}
          </button>
        ) : (
          <p className="text-sm text-gray-500">{t("allShown")}</p>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreContent />
    </Suspense>
  );
}
