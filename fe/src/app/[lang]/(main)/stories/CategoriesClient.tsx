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
      setCategories([{ id: 0, name: t("allCategories"), slug: "all", storiesCount: 0 }, ...(res.data.data || [])]);
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

      <div className="mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* LEFT SIDEBAR */}
      <div className="w-full md:w-80 flex-shrink-0 space-y-8">
        {/* Category List */}
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => {
            const isActive = cat.slug === activeSlug;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.slug)}
                className={`w-full text-left text-sm py-2 px-3 rounded-md transition-colors truncate ${isActive
                  ? "bg-blue-50 dark:bg-blue-500/20 text-black dark:text-white font-medium shadow-sm"
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
            <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200">
              {t("keyword1")}
            </span>
            <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200">
              {t("keyword2")}
            </span>
            <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200">
              {t("keyword3")}
            </span>
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
          <div className="bg-blue-50 dark:bg-blue-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-black dark:text-white line-clamp-1">
              {currentCategory.description || t("categoryFallbackDescription", { name: currentCategoryName.toLowerCase() })}
            </p>
            <button className="text-blue-700 dark:text-blue-300 p-1">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Filters and Sorting */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full flex-1">
            <input
              type="text"
              placeholder={t("searchStoriesPlaceholder")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full lg:max-w-[20rem] min-w-0"
            />
            
            {/* Status Dropdown */}
            <div className="relative z-20 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={() => {
                  setStatusDropdownOpen(!statusDropdownOpen);
                  setAuthorDropdownOpen(false);
                  setSortDropdownOpen(false);
                }}
                className="flex items-center justify-between w-full sm:w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg px-4 py-2 text-sm"
              >
                <span>
                  {status === "" && t("allStatuses")}
                  {status === "ongoing" && t("ongoing")}
                  {status === "completed" && t("completedLong")}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              {statusDropdownOpen && (
                <div className="absolute left-0 mt-2 w-full sm:w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
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
                      className="flex justify-between items-center w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <span className={status === s.id ? "font-semibold text-blue-600 dark:text-blue-400" : ""}>
                        {s.label}
                      </span>
                      {status === s.id && (
                        <span className="text-blue-600 dark:text-blue-400">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Author Dropdown */}
            <div className="relative z-20 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={() => {
                  setAuthorDropdownOpen(!authorDropdownOpen);
                  setStatusDropdownOpen(false);
                  setSortDropdownOpen(false);
                }}
                className="flex items-center justify-between w-full sm:w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg px-4 py-2 text-sm"
              >
                <span className="truncate">
                  {selectedAuthor ? selectedAuthor.name : t("selectAuthor")}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
              </button>

              {authorDropdownOpen && (
                <div className="absolute left-0 mt-2 w-full sm:w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 p-2">
                   <input
                      type="text"
                     placeholder={t("searchAuthorPlaceholder")}
                      value={authorSearch}
                      onChange={(e) => setAuthorSearch(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="max-h-60 overflow-y-auto mt-1">
                      <button 
                        onClick={() => { setAuthor(""); setPage(1); setAuthorDropdownOpen(false); setAuthorSearch(""); }}
                        className="flex justify-between items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md"
                      >
                        <span className={!author ? "font-semibold text-blue-600 dark:text-blue-400" : ""}>
                          {t("allAuthors")}
                        </span>
                        {!author && <span className="text-blue-600 dark:text-blue-400">✓</span>}
                      </button>
                      
                      {filteredAuthors.map(a => (
                        <button 
                          key={a.id}
                          onClick={() => { setAuthor(a.id); setPage(1); setAuthorDropdownOpen(false); }}
                          className="flex justify-between items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md"
                        >
                          <span className={author === a.id ? "font-semibold text-blue-600 dark:text-blue-400 truncate" : "truncate"}>
                            {a.name}
                          </span>
                          {author === a.id && <span className="text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2">✓</span>}
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
          </div>

          {/* Sort Dropdown */}
          <div className="relative z-10 w-full lg:w-auto flex-shrink-0">
            <button
              onClick={() => {
                setSortDropdownOpen(!sortDropdownOpen);
                setStatusDropdownOpen(false);
                setAuthorDropdownOpen(false);
              }}
              className="flex items-center justify-between w-full lg:w-44 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-slate-900 dark:text-white rounded-lg px-4 py-2 font-medium text-sm"
            >
              <span>{selectedSortLabel}</span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-full sm:w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
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
                    className="flex justify-between items-center w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <span className={sort === s.id ? "font-semibold text-blue-600 dark:text-blue-400" : ""}>
                      {s.label}
                    </span>
                    {sort === s.id && (
                      <span className="text-blue-600 dark:text-blue-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
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
  );
}

function HorizontalStoryCard({ story, locale }: { story: StoryItem; locale: string }) {
  const t = useTranslations("CategoryStoriesPage");
  const rating = Number(story.averageRating || 0).toFixed(1);
  const views = story.totalViews > 1000 ? (story.totalViews / 1000).toFixed(1) + 'K' : story.totalViews;
  const localizedTitle = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);

  return (
    <div className="flex gap-8 group cursor-pointer overflow-hidden p-2">
      <div className="relative w-[180px] h-[240px] flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
        <Image
          src={story.thumbnailUrl || "https://placehold.co/200x300?text=No+Cover"}
          alt={localizedTitle}
          fill
          sizes="180px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 flex flex-col items-center">
          <span className="text-[10px] text-white font-bold leading-none">G</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between py-2">
        <div>
          <Link href={`/story/${story.slug}`} className="block">
            <h3 className="font-bold text-2xl text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
              {localizedTitle}
            </h3>
          </Link>
          <div className="flex flex-wrap gap-2 mt-2">
            {story.categories?.map((catWrapper, idx) => (
              <span
                key={catWrapper.category.id}
                className={`text-sm px-2 py-0.5 rounded-sm ${idx === 0
                  ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30"
                  : "text-gray-500 bg-gray-100 dark:bg-gray-800"
                  }`}
              >
                {getLocalizedValue(locale, catWrapper.category.nameVi, catWrapper.category.nameEn, catWrapper.category.name)}
              </span>
            ))}
          </div>
          <p className="text-base font-semibold text-gray-600 dark:text-gray-400 mt-2">
            {story.author?.name || t("updating")}
          </p>
          <p className="text-base text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">
            {story.description || t("storyFallbackDescription")}
          </p>
        </div>

        <div className="flex items-center gap-6 mt-4 text-lg font-medium text-orange-500">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">★★★★★</span>
            <span>{rating}</span>
          </div>
          <div className="text-gray-500">
            {t("viewsShort", { count: views })}
          </div>
        </div>
      </div>
    </div>
  );
}