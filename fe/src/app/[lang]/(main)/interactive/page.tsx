"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import StoryCard from "@/components/shared/StoryCard";
import { fetchExploreCached } from "@/lib/api/public-story-cache";

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

export default function InteractiveStoriesPage() {
  const t = useTranslations("InteractivePage");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStories = async () => {
      setIsLoading(true);
      try {
        const res = await fetchExploreCached<ExploreResponse>({
          page,
          limit: LIMIT,
          isInteractive: "true",
          lang,
        });
        setStories(res.data || []);
        setLastPage(res.meta?.lastPage || 1);
      } catch (error) {
        console.error("Failed to load interactive stories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadStories();
  }, [page, lang]);

  return (
    <div className="space-y-6">
      <div className="relative rounded-3xl p-8 text-black dark:text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl font-black">{t("title")}</h1>
          <p className="mt-2 text-lg font-medium opacity-90">{t("subtitle")}</p>
        </div>
        <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-white/10 blur-3xl transition-transform hover:scale-110"></div>
        <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-orange-400/20 blur-2xl"></div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          ))}
        </div>
      ) : stories.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-3 py-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                {tCommon("prev")}
              </button>
              <span className="text-sm font-bold text-slate-500">{tCommon("page", { page, lastPage })}</span>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                {tCommon("next")}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-6xl opacity-20">📚</div>
          <p className="text-xl font-bold text-slate-400">Chưa có truyện tương tác nào.</p>
        </div>
      )}
    </div>
  );
}
