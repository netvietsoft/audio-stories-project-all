"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import Link from "@/components/shared/LocalizedLink";
import CategoryStorySlider from "@/components/story/CategoryStorySlider";

type CategoryTabItem = {
  key: string;
  label: string;
  href: string;
  stories: Array<{
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
    author?: { id?: string; name: string };
    categories?: Array<{ category: { id: number; name: string; slug: string } }>;
  }>;
};

type CategoryTabsSectionProps = {
  tabs: CategoryTabItem[];
  isLoading?: boolean;
};

export default function CategoryTabsSection({ tabs, isLoading = false }: CategoryTabsSectionProps) {
  const t = useTranslations("Home");
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.key ?? "");

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((tab) => tab.key === activeTab)) {
      const firstTabKey = tabs[0]?.key;
      if (firstTabKey) {
        setActiveTab(firstTabKey);
      }
    }
  }, [activeTab, tabs]);

  const activeItem = useMemo(() => {
    if (!tabs.length) return null;
    return tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  }, [activeTab, tabs]);

  if (!tabs.length && !isLoading) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t("featuredCategoriesTitle")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("categoryTabsSubtitle")}</p>
        </div>
        {activeItem ? (
          <Link href={activeItem.href} className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {t("viewAll")}
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="inline-flex min-w-full items-center gap-2 border-b border-slate-200 pb-1 dark:border-slate-700">
          {tabs.map((tab) => {
            const isActive = activeItem?.key === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeItem ? (
        <CategoryStorySlider stories={activeItem.stories.slice(0, 8)} isLoading={isLoading} />
      ) : (
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 dark:bg-gray-900 dark:text-slate-400">{t("noData")}</div>
      )}
    </section>
  );
}