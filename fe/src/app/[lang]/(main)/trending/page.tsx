"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import StoryGridCard from "@/components/shared/StoryGridCard";
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

export default function TrendingPage() {
  const t = useTranslations("TrendingPage");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [trendWindow, setTrendWindow] = useState<"today" | "week" | "month" | "all">("week");

  useEffect(() => {
    const loadStories = async () => {
      const res = await fetchExploreCached<ExploreResponse>({
        page,
        limit: LIMIT,
        sort: "views",
        trendWindow,
        lang,
      });
      setStories(res.data || []);
      setLastPage(res.meta?.lastPage || 1);
    };

    void loadStories();
  }, [page, trendWindow, lang]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {[
          { value: "today", label: t("today") },
          { value: "week", label: t("week") },
          { value: "month", label: t("month") },
          { value: "all", label: t("all") },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() => {
              setTrendWindow(item.value as "today" | "week" | "month" | "all");
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              trendWindow === item.value
                ? "bg-pink-600 text-white"
                : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stories.map((story) => (
          <StoryGridCard key={story.id} story={story} highlightMode="trending" />
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
