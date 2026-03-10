"use client";

import { useEffect, useState } from "react";

import StoryCard from "@/components/shared/StoryCard";
import { apiClient } from "@/lib/api/api-client";

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

type Category = { id: number; name: string; slug: string };

type ExploreResponse = {
  data: StoryItem[];
  meta: { page: number; lastPage: number; total: number };
};

const LIMIT = 12;

export default function NewStoriesPage() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [filter, setFilter] = useState({ categoryId: "", status: "" });

  useEffect(() => {
    const loadCategories = async () => {
      const res = await apiClient.get<Category[]>("/stories/categories");
      setCategories(res.data || []);
    };
    void loadCategories();
  }, []);

  useEffect(() => {
    const loadStories = async () => {
      const res = await apiClient.get<ExploreResponse>("/stories/explore", {
        params: {
          page,
          limit: LIMIT,
          sort: "latest",
          ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
        },
      });
      setStories(res.data.data || []);
      setLastPage(res.data.meta?.lastPage || 1);
    };

    void loadStories();
  }, [filter.categoryId, filter.status, page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Trang Mới đăng</h1>
        <p className="mt-1 text-sm text-slate-500">Sắp xếp theo ngày mới nhất, phân trang 12 truyện/trang.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <select
          value={filter.categoryId}
          onChange={(e) => {
            setFilter((prev) => ({ ...prev, categoryId: e.target.value }));
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">Tất cả thể loại</option>
          {categories.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => {
            setFilter((prev) => ({ ...prev, status: e.target.value }));
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ongoing">Đang ra</option>
          <option value="completed">Hoàn thành</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Trước
        </button>
        <span className="text-sm text-slate-500">Trang {page}/{lastPage}</span>
        <button
          disabled={page >= lastPage}
          onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Tiếp
        </button>
      </div>
    </div>
  );
}
