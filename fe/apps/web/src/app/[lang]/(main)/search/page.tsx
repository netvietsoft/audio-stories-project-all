"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";

import StoryCard from "@/components/shared/StoryCard";
import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import { apiClient } from "@/lib/api/api-client";
import { useDebounce } from "@/hooks/useDebounce";
import { getOrCreateDeviceId } from "@/lib/tracking/device-id";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  author?: { name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type ExploreResponse = {
  data: StoryItem[];
  meta: { page: number; lastPage: number; total: number };
};

type Category = { id: number; name: string; slug: string };
type Author = { id: string; name: string };

const LIMIT = 12;

export default function SearchPage() {
  const t = useTranslations("SearchPage");

  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">{t("loading")}</div>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const t = useTranslations("SearchPage");
  const tCommon = useTranslations("Common");
  const searchParams = useSearchParams();
  const initialKeyword = searchParams.get("keyword") || "";

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [filters, setFilters] = useState<StoryFilterValue>({
    categoryId: searchParams.get("categoryId") || "",
    authorId: searchParams.get("authorId") || "",
    status: (searchParams.get("status") as StoryFilterValue["status"]) || "",
    sort: (searchParams.get("sort") as StoryFilterValue["sort"]) || "latest",
    keyword: initialKeyword,
  });
  const [appliedFilters, setAppliedFilters] = useState<StoryFilterValue>(filters);

  // Debounce keyword để tránh gọi API quá nhiều khi user đang gõ
  const debouncedKeyword = useDebounce(filters.keyword || "", 500);

  // Update keyword when URL changes
  useEffect(() => {
    const urlKeyword = searchParams.get("keyword") || "";
    setFilters((prev) => ({ ...prev, keyword: urlKeyword }));
    setAppliedFilters((prev) => ({ ...prev, keyword: urlKeyword }));
  }, [searchParams]);

  useEffect(() => {
    const loadOptions = async () => {
      const [catRes, authorRes] = await Promise.all([
        apiClient.get<Category[]>("/stories/categories"),
        apiClient.get<Author[]>("/stories/authors"),
      ]);
      setCategories(catRes.data || []);
      setAuthors(authorRes.data || []);
    };

    void loadOptions();
  }, []);

  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";

  // Auto-apply khi keyword debounced thay đổi
  useEffect(() => {
    if (debouncedKeyword !== appliedFilters.keyword) {
      setAppliedFilters((prev) => ({ ...prev, keyword: debouncedKeyword }));
      setPage(1);
    }
  }, [debouncedKeyword, appliedFilters.keyword]);

  useEffect(() => {
    setPage(1);
    const loadStories = async () => {
      const res = await apiClient.get<ExploreResponse>("/stories/explore", {
        params: {
          page: 1,
          limit: LIMIT,
          lang: currentLang,
          ...(appliedFilters.keyword ? { search: appliedFilters.keyword } : {}),
          ...(appliedFilters.categoryId ? { categoryId: appliedFilters.categoryId } : {}),
          ...(appliedFilters.authorId ? { authorId: appliedFilters.authorId } : {}),
          ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
          sort: appliedFilters.sort,
        },
      });
      setStories(res.data.data || []);
      setLastPage(res.data.meta?.lastPage || 1);
    };

    void loadStories();
  }, [appliedFilters, currentLang]);

  useEffect(() => {
    if (page === 1) return;
    const loadStories = async () => {
      const res = await apiClient.get<ExploreResponse>("/stories/explore", {
        params: {
          page,
          limit: LIMIT,
          lang: currentLang,
          ...(appliedFilters.keyword ? { search: appliedFilters.keyword } : {}),
          ...(appliedFilters.categoryId ? { categoryId: appliedFilters.categoryId } : {}),
          ...(appliedFilters.authorId ? { authorId: appliedFilters.authorId } : {}),
          ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
          sort: appliedFilters.sort,
        },
      });
      setStories(res.data.data || []);
      setLastPage(res.data.meta?.lastPage || 1);
    };
    void loadStories();
  }, [appliedFilters, page, currentLang]);

  const title = useMemo(
    () => (appliedFilters.keyword ? t("titleWithKeyword", { keyword: appliedFilters.keyword }) : t("titleDefault")),
    [appliedFilters.keyword, t],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <StoryFilterBar
        categories={categories}
        authors={authors}
        value={filters}
        onChange={setFilters}
        onApply={() => {
          setAppliedFilters(filters);
          setPage(1);
        }}
        showKeywordInput={true}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stories.map((story) => (
          <div
            key={story.id}
            onClick={() => {
              const deviceId = getOrCreateDeviceId();
              if (!deviceId) return;
              void apiClient
                .post("/tracking/search-open", { storyId: story.id, deviceId })
                .catch(() => {
                  // Tracking must be non-blocking for UX.
                });
            }}
          >
            <StoryCard story={story} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          {tCommon("prev")}
        </button>
        <span className="text-sm text-slate-500">{tCommon("page", { page, lastPage })}</span>
        <button
          disabled={page >= lastPage}
          onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          {tCommon("next")}
        </button>
      </div>
    </div>
  );
}
