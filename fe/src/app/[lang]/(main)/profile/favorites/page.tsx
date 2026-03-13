"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import StoryCard from "@/components/shared/StoryCard";
import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";

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

type FavoriteResponse = {
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
};

type AuthorOption = {
  id: string;
  name: string;
};

const LIMIT = 20;

export default function FavoriteStoriesPage() {
  const t = useTranslations("ProfileFavoritesPage");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const accessToken = useUserStore((state) => state.accessToken);

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

  const fetchFavorites = async (nextPage: number, replace = false) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<FavoriteResponse>("/favorites", {
        params: {
          page: nextPage,
          limit: LIMIT,
          ...(appliedFilters.categoryId ? { categoryId: Number(appliedFilters.categoryId) } : {}),
          ...(appliedFilters.authorId ? { authorId: appliedFilters.authorId } : {}),
          ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
          sort: appliedFilters.sort,
        },
      });
      setPage(response.data.meta.page);
      setLastPage(response.data.meta.lastPage);
      setStories((prev) => (replace ? response.data.data : [...prev, ...response.data.data]));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      router.push(`/${currentLang}`);
      return;
    }

    void (async () => {
      const [categoryRes, authorRes] = await Promise.all([
        apiClient.get<CategoryOption[]>("/stories/categories"),
        apiClient.get<AuthorOption[]>("/stories/authors"),
      ]);
      setCategories(categoryRes.data);
      setAuthors(authorRes.data);
    })();
  }, [accessToken, currentLang, router]);

  useEffect(() => {
    if (!accessToken) return;
    void fetchFavorites(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, appliedFilters]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("title")}</h1>

      <StoryFilterBar
        categories={categories}
        authors={authors}
        value={filters}
        onChange={setFilters}
        onApply={() => setAppliedFilters(filters)}
        isLoading={isLoading}
      />

      {stories.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t("empty")}
        </p>
      )}

      {stories.length > 0 ? (
        <div className="flex justify-center">
          {canLoadMore ? (
            <button
              disabled={isLoading}
              onClick={() => void fetchFavorites(page + 1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {isLoading ? tCommon("loading") : tCommon("loadMore")}
            </button>
          ) : (
            <p className="text-sm text-gray-500">{tCommon("allShown")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
