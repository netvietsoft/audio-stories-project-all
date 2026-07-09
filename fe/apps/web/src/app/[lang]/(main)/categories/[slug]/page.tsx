"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import StoryGridCard from "@/components/shared/StoryGridCard";
import { apiClient } from "@/lib/api/api-client";
import { unwrapList } from "@/lib/api/unwrap";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  updatedAt?: string;
  author?: { name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
  label?: { text: string; color: string; icon?: string | null } | null;
};

type Category = { id: number; name: string; slug: string };

type ExploreResponse = {
  data: StoryItem[];
  meta: { page: number; lastPage: number; total: number };
};

const LIMIT = 12;

export default function CategoryStoriesPage() {
  const t = useTranslations("CategoriesPage");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const categorySlug = params.slug as string;
  const page = Number(searchParams.get("page")) || 1;

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [lastPage, setLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // Get category ID from slug
  useEffect(() => {
    const loadCategory = async () => {
      try {
        const allCategories = await apiClient.get<Category[]>("/stories/categories", {
          params: { language: locale === "en" ? "en" : "vi" },
        });
        const found = unwrapList<Category>(allCategories.data).find((cat) => cat.slug === categorySlug);
        if (found) {
          setCategory(found);
          setCategoryId(found.id);
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    };

    void loadCategory();
  }, [categorySlug, locale]);

  // Load stories for category
  useEffect(() => {
    if (!categoryId) return;

    const loadStories = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<ExploreResponse>("/stories/explore", {
          params: {
            page,
            limit: LIMIT,
            categoryId,
          },
        });
        setStories(unwrapList<StoryItem>(res.data));
        setLastPage(res.data.meta?.lastPage || 1);
      } catch (error) {
        console.error("Failed to load stories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadStories();
  }, [categoryId, page]);

  if (isLoading && !category) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          {category?.name || t("loading")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("subtitle", { count: stories.length })}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : stories.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {stories.map((story) => (
              <StoryGridCard key={story.id} story={story} />
            ))}
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-3 py-8">
              <a
                href={`/categories/${categorySlug}?page=${Math.max(1, page - 1)}`}
                className={`rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition-colors dark:border-slate-700 ${
                  page <= 1
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={(e) => {
                  if (page <= 1) e.preventDefault();
                }}
              >
                {tCommon("prev")}
              </a>
              <span className="text-sm text-slate-500">
                {tCommon("page", { page, lastPage })}
              </span>
              <a
                href={`/categories/${categorySlug}?page=${Math.min(lastPage, page + 1)}`}
                className={`rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition-colors dark:border-slate-700 ${
                  page >= lastPage
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={(e) => {
                  if (page >= lastPage) e.preventDefault();
                }}
              >
                {tCommon("next")}
              </a>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl bg-white/80 p-6 text-center text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
          {t("empty")}
        </div>
      )}
    </div>
  );
}
