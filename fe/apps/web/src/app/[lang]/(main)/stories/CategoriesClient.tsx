"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/components/shared/LocalizedLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { getLocalizedValue } from "@/lib/story-localization";

type CategoryItem = {
  id: number;
  name: string;
  nameVi?: string | null;
  nameEn?: string | null;
  slug: string;
  description?: string;
  storiesCount: number;
};

type AuthorItem = {
  id: string;
  name: string;
};

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  author?: { name: string };
  categories?: Array<{ category: { id: number; name: string; nameVi?: string; nameEn?: string; slug: string } }>;
  description?: string;
};

type ExploreResponse = {
  data: StoryItem[];
  meta: { page: number; lastPage: number; total: number };
};

const LIMIT = 12;

export default function CategoriesClient({ initialSlug }: { initialSlug?: string }) {
  const t = useTranslations("CategoryStoriesPage");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read sort from URL if any, or default to views (Phổ biến)
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [sort, setSort] = useState<"latest" | "views" | "rating" | "title_asc" | "chapters_desc">("latest");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [author, setAuthor] = useState(""); // This is now authorId
  
  // Dropdown states
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Author filter states
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [authorSearch, setAuthorSearch] = useState("");

  // Determine current active category slug
  // Prefer URL search param so filtering always follows current /stories query state.
  const activeSlug = searchParams.get("category") || initialSlug || "all";

  useEffect(() => {
    const loadCategories = async () => {
      const res = await apiClient.get<{ data: CategoryItem[] }>("/stories/categories-with-count", {
        params: { language: locale, _t: Date.now() }
      });
      const totalCount = (res.data.data || []).reduce((sum, cat) => sum + cat.storiesCount, 0);
      setCategories([{ id: 0, name: t("allCategories"), slug: "all", storiesCount: totalCount }, ...(res.data.data || [])]);
    };
    
    const loadAuthors = async () => {
      try {
        const res = await apiClient.get<AuthorItem[]>("/stories/authors");
        setAuthors(res.data || []);
      } catch (error) {
        console.error(error);
      }
    };
    
    void loadCategories();
    void loadAuthors();
  }, [t, locale]);

  const currentCategory = useMemo(() => categories.find((item) => item.slug === activeSlug), [categories, activeSlug]);
  const currentCategoryName = currentCategory 
    ? getLocalizedValue(locale, currentCategory.nameVi, currentCategory.nameEn, currentCategory.name)
    : t("allCategories");
  const categoryRootLabel = locale === "en" ? "Categories" : "Thể loại";
  const breadcrumbItems = useMemo(() => {
    if (currentCategory && currentCategory.id !== 0) {
      return [
        { label: categoryRootLabel, href: "/stories" },
        { label: currentCategoryName },
      ];
    }

    return [{ label: categoryRootLabel }];
  }, [categoryRootLabel, currentCategory, currentCategoryName]);
  const selectedSortLabel =
    sort === "latest"
      ? t("sortLatest")
      : sort === "views"
        ? t("sortViews")
        : sort === "rating"
          ? t("sortRating")
          : sort === "title_asc"
            ? t("sortTitle")
            : t("sortChapters");

  const selectedAuthor = useMemo(() => authors.find(a => a.id === author), [authors, author]);
  
  const filteredAuthors = useMemo(() => 
    authors.filter((a) => a.name.toLowerCase().includes(authorSearch.toLowerCase())),
  [authors, authorSearch]);

  useEffect(() => {
    // If categories not loaded yet, or we're on "all" and it's loaded, we proceed
    if (categories.length === 0) return;

    let apiSort: string = "views";
    if (sort === "views") apiSort = "views";
    if (sort === "rating") apiSort = "rating";
    if (sort === "latest") apiSort = "latest";
    if (sort === "title_asc") apiSort = "title_asc";
    if (sort === "chapters_desc") apiSort = "chapters_desc";

    const loadStories = async () => {
      const res = await apiClient.get<ExploreResponse>("/stories/explore", {
        params: {
          page,
          limit: LIMIT,
          lang: locale,
          categoryId: currentCategory && currentCategory.id !== 0 ? currentCategory.id : undefined,
          sort: apiSort,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(author ? { authorId: author } : {}), // Assuming backend supports author search via authorId or similar query
        },
      });
      setStories((res.data.data || []).map((story) => ({
        ...story,
        title: getLocalizedValue(locale, story.titleVi, story.titleEn, story.title),
      })));
      setLastPage(res.data.meta?.lastPage || 1);
    };

    void loadStories();
  }, [currentCategory, page, sort, categories, search, status, author, locale]);

  const handleCategoryClick = (categorySlug: string) => {
    setPage(1);

    const current = new URLSearchParams(Array.from(searchParams.entries()));

    if (categorySlug === "all") {
      current.delete("category");
    } else {
      current.set("category", categorySlug);
    }

    current.delete("page");

    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
  };

  return (
    <div className="space-y-2">
      <Breadcrumbs items={breadcrumbItems} lang={locale === "en" ? "en" : "vi"} />

      <div className="mx-auto px-2 pt-3 pb-6 sm:px-3 sm:pt-4 md:px-4 md:pt-6 md:pb-8">
      {/* MOBILE CATEGORIES GRID */}
      <div className="grid grid-cols-4 gap-1.5 mb-4 md:hidden">
        {categories.map((cat) => {
          const isActive = cat.slug === activeSlug;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.slug)}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded-lg transition-all ${isActive
                ? "bg-gray-300 text-slate-900 dark:bg-gray-600 dark:text-white"
                : "app-button-surface text-gray-700 dark:text-gray-200"
                }`}
            >
              <span className="text-[11px] font-semibold leading-tight text-center line-clamp-2">
                {getLocalizedValue(locale, cat.nameVi, cat.nameEn, cat.name)}
              </span>
              <span className="text-[10px] opacity-75">{cat.storiesCount}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
      {/* SIDEBAR - Hidden on mobile */}
      <div className="hidden md:block w-full md:w-80 flex-shrink-0 space-y-8">
        {/* Category List */}
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => {
            const isActive = cat.slug === activeSlug;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.slug)}
                className={`w-full text-left text-sm py-2 px-3 rounded-md transition-colors truncate ${isActive
                  ? "bg-pink-50 dark:bg-pink-500/20 text-black dark:text-white font-medium shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
              >
                {getLocalizedValue(locale, cat.nameVi, cat.nameEn, cat.name)}
              </button>
            );
          })}
        </div>

        {/* Keywords */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            {t("relatedKeywords", {
              name: currentCategory?.name !== t("allCategories") ? currentCategoryName.toLowerCase() : t("defaultKeywordTopic"),
            })}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSearch(t("keyword1"));
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t("keyword1")}
            </button>
            <button
              onClick={() => {
                setSearch(t("keyword2"));
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t("keyword2")}
            </button>
            <button
              onClick={() => {
                setSearch(t("keyword3"));
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t("keyword3")}
            </button>
          </div>
        </div>

        {/* Popular Searches */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t("popularSearches")}</h3>
          {/* Mock content for popular searches */}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          {currentCategory && currentCategory.id !== 0 ? currentCategoryName : t("allStoriesTitle")}
        </h1>

        {/* Description Box */}
        {currentCategory && currentCategory.name !== t("allCategories") && (
          <div className="bg-pink-50 dark:bg-pink-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-black dark:text-white line-clamp-1">
              {currentCategory.description || t("categoryFallbackDescription", { name: currentCategoryName.toLowerCase() })}
            </p>
            <button className="text-pink-700 dark:text-pink-300 p-1">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Filters and Sorting */}
        <div className="flex flex-col gap-3 mb-8">
          {/* Author Dropdown - First */}
          <div className="relative z-30 w-full">
            <button
              onClick={() => {
                setAuthorDropdownOpen(!authorDropdownOpen);
                setStatusDropdownOpen(false);
                setSortDropdownOpen(false);
              }}
              className="app-dropdown-surface flex items-center justify-between w-full text-slate-900 dark:text-white rounded-lg px-4 py-2 text-sm"
            >
              <span className="truncate">
                {selectedAuthor ? selectedAuthor.name : t("selectAuthor")}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
            </button>

            {authorDropdownOpen && (
                <div className="app-dropdown-surface absolute left-0 mt-2 w-full rounded-lg shadow-lg py-1 p-2 z-40">
                <input
                  type="text"
                  placeholder={t("searchAuthorPlaceholder")}
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className="app-button-surface w-full rounded-md px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400/30 mb-1"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="max-h-60 overflow-y-auto">
                  <button 
                    onClick={() => { setAuthor(""); setPage(1); setAuthorDropdownOpen(false); setAuthorSearch(""); }}
                    className="flex justify-between items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-md"
                  >
                    <span className={!author ? "font-semibold text-slate-900 dark:text-white" : ""}>
                      {t("allAuthors")}
                    </span>
                    {!author && <span className="text-slate-800 dark:text-gray-200">✓</span>}
                  </button>
                  
                  {filteredAuthors.map(a => (
                    <button 
                      key={a.id}
                      onClick={() => { setAuthor(a.id); setPage(1); setAuthorDropdownOpen(false); }}
                      className="flex justify-between items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-md"
                    >
                      <span className={author === a.id ? "font-semibold text-slate-900 dark:text-white truncate" : "truncate"}>
                        {a.name}
                      </span>
                      {author === a.id && <span className="text-slate-800 dark:text-gray-200 flex-shrink-0 ml-2">✓</span>}
                    </button>
                  ))}
                  
                  {filteredAuthors.length === 0 && (
                    <div className="px-3 py-4 text-sm text-center text-slate-500">
                      {t("authorNotFound")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status and Sort row on mobile */}
          <div className="flex gap-3">
            {/* Status Dropdown */}
            <div className="relative z-20 flex-1">
              <button
                onClick={() => {
                  setStatusDropdownOpen(!statusDropdownOpen);
                  setAuthorDropdownOpen(false);
                  setSortDropdownOpen(false);
                }}
                className="app-dropdown-surface flex items-center justify-between w-full text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm"
              >
                <span>
                  {status === "" && t("allStatuses")}
                  {status === "ongoing" && t("ongoing")}
                  {status === "completed" && t("completedLong")}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              {statusDropdownOpen && (
                <div className="app-dropdown-surface absolute left-0 mt-2 w-full rounded-lg shadow-lg py-1 z-40">
                  {[
                    { id: "", label: t("allStatuses") },
                    { id: "ongoing", label: t("ongoing") },
                    { id: "completed", label: t("completedLong") },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setStatus(s.id);
                        setPage(1);
                        setStatusDropdownOpen(false);
                      }}
                      className="flex justify-between items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-300"
                    >
                      <span className={status === s.id ? "font-semibold text-slate-900 dark:text-white" : ""}>
                        {s.label}
                      </span>
                      {status === s.id && (
                        <span className="text-slate-800 dark:text-gray-200">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative z-10 flex-1">
              <button
                onClick={() => {
                  setSortDropdownOpen(!sortDropdownOpen);
                  setStatusDropdownOpen(false);
                  setAuthorDropdownOpen(false);
                }}
                className="app-dropdown-surface flex items-center justify-between w-full text-slate-900 dark:text-white rounded-lg px-3 py-2 font-medium text-sm transition-colors"
              >
                <span className="truncate">{selectedSortLabel}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              {sortDropdownOpen && (
                <div className="app-dropdown-surface absolute right-0 mt-2 w-full rounded-lg shadow-lg py-1 z-40">
                  {[
                    { id: "latest", label: t("sortLatest") },
                    { id: "views", label: t("sortViews") },
                    { id: "rating", label: t("sortRating") },
                    { id: "title_asc", label: t("sortTitle") },
                    { id: "chapters_desc", label: t("sortChapters") },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSort(s.id as any);
                        setPage(1);
                        setSortDropdownOpen(false);
                      }}
                      className="flex justify-between items-center w-full px-4 py-2.5 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-300"
                    >
                      <span className={sort === s.id ? "font-semibold text-slate-900 dark:text-white" : ""}>
                        {s.label}
                      </span>
                      {sort === s.id && (
                        <span className="text-slate-800 dark:text-gray-200">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Story Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {stories.map((story) => (
            <HorizontalStoryCard key={story.id} story={story} locale={locale} />
          ))}
        </div>

        {/* Pagination (kept simple) */}
        {stories.length > 0 && lastPage > 1 && (
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
        )}
      </div>
      </div>
    </div>
    </div>
  );
}

function HorizontalStoryCard({ story, locale }: { story: StoryItem; locale: string }) {
  const t = useTranslations("CategoryStoriesPage");
  const rating = Number(story.averageRating || 0).toFixed(1);
  const views = story.totalViews > 1000 ? (story.totalViews / 1000).toFixed(1) + 'K' : story.totalViews;
  const localizedTitle = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);
  const storyIntro = (story.description || t("storyFallbackDescription")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <div className="flex gap-3 sm:gap-4 group cursor-pointer overflow-hidden p-2">
      <div className="relative w-[100px] h-[140px] sm:w-[120px] sm:h-[160px] md:w-[140px] md:h-[190px] flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <Image
          src={story.thumbnailUrl || "https://placehold.co/200x300?text=No+Cover"}
          alt={localizedTitle}
          fill
          sizes="(max-width: 640px) 100px, (max-width: 768px) 120px, 140px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <Link href={`/story/${story.slug}`} className="block">
            <h3 className="font-semibold text-sm sm:text-base md:text-lg text-slate-900 dark:text-white line-clamp-2 group-hover:text-pink-600 transition-colors">
              {localizedTitle}
            </h3>
          </Link>
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1 sm:mt-2">
            {story.categories?.slice(0, 2).map((catWrapper, idx) => (
              <span
                key={catWrapper.category.id}
                className={`text-xs px-1.5 py-0.5 rounded-sm ${idx === 0
                  ? "text-pink-600 bg-pink-50 dark:bg-pink-900/30"
                  : "text-gray-500 bg-gray-100 dark:bg-gray-800"
                  }`}
              >
                {getLocalizedValue(locale, catWrapper.category.nameVi, catWrapper.category.nameEn, catWrapper.category.name)}
              </span>
            ))}
          </div>
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mt-1 sm:mt-1.5 truncate">
            {story.author?.name || t("updating")}
          </p>
          <p className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 sm:line-clamp-3 leading-relaxed">
            {storyIntro}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 mt-2 text-sm sm:text-base font-medium text-orange-500">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-yellow-400 text-xs sm:text-sm">★★★★★</span>
            <span className="text-xs sm:text-sm">{rating}</span>
          </div>
          <div className="text-gray-500 text-xs sm:text-sm">
            {t("viewsShort", { count: views })}
          </div>
        </div>
      </div>
    </div>
  );
}