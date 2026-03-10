"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { apiClient } from "@/lib/api/api-client";

type CategoryItem = {
  id: number;
  name: string;
  slug: string;
  storiesCount: number;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await apiClient.get<{ data: CategoryItem[] }>("/stories/categories-with-count");
      setCategories(res.data.data || []);
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Trang thể loại</h1>
        <p className="mt-1 text-sm text-slate-500">Liệt kê tất cả thể loại, click để lọc truyện theo thể loại.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {categories.map((item) => (
          <Link
            key={item.id}
            href={`/categories/${item.slug}`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="mt-1 text-xs text-slate-500">{item.storiesCount} truyện</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
