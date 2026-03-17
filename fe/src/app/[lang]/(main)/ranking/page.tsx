"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trophy, Gift, Star, Heart, Eye, Zap, Medal } from "lucide-react";
import Link from "@/components/shared/LocalizedLink";

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
  totalGifts?: number;
  favoritesCount?: number;
  createdAt?: string;
  author?: { name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type ExploreResponse = {
  data: StoryItem[];
  meta: { page: number; lastPage: number; total: number };
};

const LIMIT = 20;

type SortOption = "gifts" | "rating" | "favorites" | "views" | "latest";

export default function RankingPage() {
  const t = useTranslations("RankingPage");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "vi";

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("gifts");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStories = async () => {
      setIsLoading(true);
      try {
        const res = await fetchExploreCached<ExploreResponse>({
          page,
          limit: LIMIT,
          sort: sortBy === "latest" ? "latest" : sortBy,
          lang,
        });
        setStories(res.data || []);
        setLastPage(res.meta?.lastPage || 1);
      } catch (error) {
        console.error("Failed to load rankings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadStories();
  }, [page, sortBy, lang]);

  const tabs = [
    { value: "gifts", label: t("tabGifts"), icon: Gift, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20" },
    { value: "rating", label: t("tabRating"), icon: Star, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { value: "favorites", label: t("tabFavorites"), icon: Heart, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-900/20" },
    { value: "views", label: t("tabViews"), icon: Eye, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { value: "latest", label: t("tabLatest"), icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  ];

  const top3 = stories.slice(0, 3);
  const others = stories.slice(3);

  return (
    <div className="max-w-7xl mx-auto space-y-10 py-6 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          {t("title")}
        </h1>
        <p className="max-w-2xl mx-auto text-slate-500 dark:text-slate-400 font-medium">
          {t("subtitle")}
        </p>
      </div>

      {/* Tabs / Filter Bar */}
      <div className="flex overflow-x-auto pb-2 scrollbar-hide justify-center mb-10 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = sortBy === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setSortBy(tab.value as SortOption);
                  setPage(1);
                }}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-sm ${isActive
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white scale-105 shadow-md"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? tab.color : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 3 Highlight Section */}
      {stories.length > 0 && !isLoading && page === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-end max-w-6xl mx-auto">
          {/* Top 2 */}
          {top3[1] && (
            <div className="order-2 md:order-1 group">
              <RankingPremiumCard
                story={top3[1]}
                rank={2}
                label={t("top2")}
                color="silver"
                sortBy={sortBy}
              />
            </div>
          )}

          {/* Top 1 */}
          {top3[0] && (
            <div className="order-1 md:order-2 scale-105 lg:scale-110 z-10 group relative">
              <RankingPremiumCard
                story={top3[0]}
                rank={1}
                label={t("top1")}
                color="gold"
                sortBy={sortBy}
              />
            </div>
          )}

          {/* Top 3 */}
          {top3[2] && (
            <div className="order-3 md:order-3 group">
              <RankingPremiumCard
                story={top3[2]}
                rank={3}
                label={t("top3")}
                color="bronze"
                sortBy={sortBy}
              />
            </div>
          )}
        </div>
      )}

      {/* Rest of the Ranking List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="h-24 w-full rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {others.map((story, index) => (
                <RankingListRow
                  key={story.id}
                  story={story}
                  rank={index + 4 + (page - 1) * LIMIT}
                  sortBy={sortBy}
                />
              ))}
              {page !== 1 && stories.map((story, index) => (
                <RankingListRow
                  key={story.id}
                  story={story}
                  rank={index + 1 + (page - 1) * LIMIT}
                  sortBy={sortBy}
                />
              ))}
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
              <div className="flex items-center justify-center gap-3 pt-8 pb-10">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((prev) => Math.max(1, prev - 1));
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                  }}
                  className="px-6 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 text-sm font-black disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all font-sans"
                >
                  {tCommon("prev")}
                </button>
                <div className="flex items-center px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-sm font-bold text-slate-700 dark:text-slate-300">
                  {tCommon("page", { page, lastPage })}
                </div>
                <button
                  disabled={page >= lastPage}
                  onClick={() => {
                    setPage((prev) => Math.min(lastPage, prev + 1));
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                  }}
                  className="px-6 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 text-sm font-black disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all font-sans"
                >
                  {tCommon("next")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RankingPremiumCard({
  story,
  rank,
  label,
  color,
  sortBy
}: {
  story: StoryItem,
  rank: number,
  label: string,
  color: 'gold' | 'silver' | 'bronze',
  sortBy: SortOption
}) {
  const colors = {
    gold: "from-amber-400 via-amber-500 to-amber-600 text-amber-950",
    silver: "from-slate-300 via-slate-400 to-slate-500 text-slate-900",
    bronze: "from-orange-400 via-orange-500 to-orange-600 text-orange-950",
  };

  const borders = {
    gold: "border-amber-400/50 shadow-amber-200/40",
    silver: "border-slate-300/50 shadow-slate-200/40",
    bronze: "border-orange-400/50 shadow-orange-200/40",
  };

  const getStat = () => {
    switch (sortBy) {
      case "gifts": return { icon: Gift, value: story.totalGifts || 0, label: "credits" };
      case "rating": return { icon: Star, value: story.averageRating || 0, label: "sao" };
      case "favorites": return { icon: Heart, value: story.favoritesCount || 0, label: "yêu thích" };
      case "views": return { icon: Eye, value: story.totalViews || 0, label: "lượt đọc" };
      case "latest": return { icon: Zap, value: "Mới nhất", label: "cập nhật" };
      default: return null;
    }
  };

  const stat = getStat();

  return (
    <Link href={`/story/${story.slug}`} className="block relative h-full">
      <div className={`overflow-hidden rounded-[2.5rem] border-4 ${borders[color]} bg-white dark:bg-slate-900 shadow-2xl transition-all group-hover:-translate-y-2 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)]`}>
        {/* Cover Image Container */}
        <div className="aspect-[3/4] overflow-hidden relative">
          <img
            src={story.thumbnailUrl || "https://placehold.co/400x600?text=No+Cover"}
            alt={story.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Rank Badge */}
          <div className={`absolute top-4 left-4 flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${colors[color]} shadow-lg font-black italic text-lg`}>
            #{rank}
          </div>

          <div className="absolute bottom-5 inset-x-5 text-white">
            <h3 className="font-black text-xl leading-tight line-clamp-2 drop-shadow-md">
              {story.title}
            </h3>
            <p className="mt-1 text-sm text-white/80 font-medium line-clamp-1 italic">
              {story.author?.name || "Updating..."}
            </p>

            {/* Stat Row */}
            {stat && (
              <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 w-fit">
                <stat.icon className="w-3.5 h-3.5 fill-white" />
                <span className="text-xs font-black tracking-wide">
                  {stat.value} <span className="opacity-70 uppercase text-[10px]">{stat.label}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function RankingListRow({ story, rank, sortBy }: { story: StoryItem, rank: number, sortBy: SortOption }) {
  const getStat = () => {
    switch (sortBy) {
      case "gifts": return { icon: Gift, value: story.totalGifts || 0, label: "gifts", color: "text-rose-500" };
      case "rating": return { icon: Star, value: story.averageRating || 0, label: "★", color: "text-amber-500" };
      case "favorites": return { icon: Heart, value: story.favoritesCount || 0, label: "favs", color: "text-pink-500" };
      case "views": return { icon: Eye, value: story.totalViews || 0, label: "views", color: "text-blue-500" };
      default: return null;
    }
  };

  const stat = getStat();

  return (
    <Link
      href={`/story/${story.slug}`}
      className="group flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
    >
      {/* Rank Number */}
      <div className="w-10 text-center font-black text-xl italic text-slate-300 dark:text-slate-700 group-hover:text-blue-500 transition-colors">
        {rank}
      </div>

      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md shrink-0 border border-slate-100 dark:border-slate-800">
        <img
          src={story.thumbnailUrl || "https://placehold.co/100x150?text=Cover"}
          alt={story.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
          {story.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 italic">
          {story.author?.name || "Updating..."}
        </p>
      </div>

      {/* Stats */}
      {stat && (
        <div className="hidden sm:flex flex-col items-end pr-4">
          <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <span>{stat.value}</span>
          </div>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{stat.label}</span>
        </div>
      )}

      {/* Mobile Stat Icon Only */}
      {stat && (
        <div className="sm:hidden flex items-center gap-1 font-black text-sm pr-2">
          <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
          <span>{stat.value}</span>
        </div>
      )}
    </Link>
  );
}
