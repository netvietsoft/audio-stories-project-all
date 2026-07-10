"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import StoryGridCard from "@/components/shared/StoryGridCard";
import StoryFilterBar, { type StoryFilterValue } from "@/components/shared/StoryFilterBar";
import { apiClient } from "@/lib/api/api-client";
import { unwrapList } from "@/lib/api/unwrap";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  updatedAt?: string;
  author?: { name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type Category = { id: number; name: string; slug: string };
type Author = { id: string; name: string };

type ExploreResponse = {
  data: StoryItem[];
  meta: { page: number; lastPage: number; total: number };
};

const LIMIT = 12;

export default function NewStoriesPage() {
  const t = useTranslations("NewPage");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [filter, setFilter] = useState<StoryFilterValue>({
    categoryId: "",
    authorId: "",
    status: "",
    sort: "latest",
  });

  useEffect(() => {
    const loadData = async () => {
      const [catRes, authorRes] = await Promise.all([
        apiClient.get<Category[]>("/stories/categories").catch(() => ({ data: [] })),
        apiClient.get<Author[]>("/stories/authors").catch(() => ({ data: [] })),
      ]);
      setCategories(unwrapList<Category>(catRes.data));
      setAuthors(unwrapList<Author>(authorRes.data));
    };
    void loadData();
  }, []);

  useEffect(() => {
    const loadStories = async () => {
      const res = await apiClient.get<ExploreResponse>("/stories/explore", {
        params: {
          page,
          limit: LIMIT,
          sort: filter.sort,
          lang,
          ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
          ...(filter.authorId ? { authorId: filter.authorId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
        },
      });
      setStories(unwrapList<StoryItem>(res.data));
      setLastPage(res.data.meta?.lastPage || 1);
    };

    void loadStories();
  }, [filter.categoryId, filter.authorId, filter.status, filter.sort, page, lang]);

  const handleApplyFilter = () => {
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <StoryFilterBar
        categories={categories}
        authors={authors}
        value={filter}
        onChange={setFilter}
        onApply={handleApplyFilter}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {stories.map((story) => (
          <StoryGridCard key={story.id} story={story} highlightMode="new" />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {tCommon("prev")}
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400">{tCommon("page", { page, lastPage })}</span>
        <button
          disabled={page >= lastPage}
          onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {tCommon("next")}
        </button>
      </div>
    </div>
  );
}
