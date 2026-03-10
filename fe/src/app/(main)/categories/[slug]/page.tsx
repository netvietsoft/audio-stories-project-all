"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import StoryCard from "@/components/shared/StoryCard";
import { apiClient } from "@/lib/api/api-client";

type CategoryItem = {
  id: number;
  name: string;
  slug: string;
  storiesCount: number;
};

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

const LIMIT = 12;

export default function CategoryStoriesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"latest" | "views" | "rating" | "title_asc" | "chapters_desc">("latest");

  useEffect(() => {
    const loadCategories = async () => {
      const res = await apiClient.get<{ data: CategoryItem[] }>("/stories/categories-with-count");
      setCategories(res.data.data || []);
    };
    void loadCategories();
  }, []);

  const currentCategory = useMemo(() => categories.find((item) => item.slug === slug), [categories, slug]);

  useEffect(() => {
    if (!currentCategory) return;

    const loadStories = async () => {
      const res = await apiClient.get<ExploreResponse>("/stories/explore", {
        params: {
          page,
          limit: LIMIT,
          categoryId: currentCategory.id,
          sort,
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
        },
      });
      setStories(res.data.data || []);
      setLastPage(res.data.meta?.lastPage || 1);
    };

    void loadStories();
  }, [currentCategory, page, search, sort, status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Thể loại: {currentCategory?.name || slug}</h1>
        <p className="mt-1 text-sm text-slate-500">Danh sách truyện theo thể loại, phân trang 12 truyện/trang.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo tên truyện..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ongoing">Đang ra</option>
          <option value="completed">Hoàn thành</option>
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as "latest" | "views" | "rating" | "title_asc" | "chapters_desc");
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="latest">Mới cập nhật</option>
          <option value="views">Lượt nghe</option>
          <option value="rating">Đánh giá cao</option>
          <option value="title_asc">Tên A-Z</option>
          <option value="chapters_desc">Nhiều chương</option>
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
