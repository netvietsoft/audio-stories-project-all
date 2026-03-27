"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/components/shared/LocalizedLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { getLocalizedValue } from "@/lib/story-localization";

// --- START: HIGHLIGHT HELPER ---
// Hàm loại bỏ dấu tiếng Việt (kể cả chữ Đ)
function removeAccents(str: string) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

// Hàm bọc thẻ <mark> siêu việt: Bỏ qua dấu tiếng Việt khi so khớp
function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight?.trim() || !text) return <>{text}</>;

  const normalizedText = removeAccents(text).toLowerCase();
  const normalizedHighlight = removeAccents(highlight).toLowerCase().trim();

  if (!normalizedHighlight) return <>{text}</>;

  const parts = [];
  let currentIndex = 0;
  let matchIndex = normalizedText.indexOf(normalizedHighlight, currentIndex);

  while (matchIndex !== -1) {
    if (matchIndex > currentIndex) {
      parts.push({ text: text.substring(currentIndex, matchIndex), highlight: false });
    }
    parts.push({
      text: text.substring(matchIndex, matchIndex + normalizedHighlight.length),
      highlight: true
    });
    currentIndex = matchIndex + normalizedHighlight.length;
    matchIndex = normalizedText.indexOf(normalizedHighlight, currentIndex);
  }

  if (currentIndex < text.length) {
    parts.push({ text: text.substring(currentIndex), highlight: false });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className="bg-yellow-300 dark:bg-yellow-600/60 text-inherit px-0.5 rounded shadow-sm">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}
// --- END: HIGHLIGHT HELPER ---

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

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [sort, setSort] = useState<"latest" | "views" | "rating" | "title_asc" | "chapters_desc">("latest");
  
  const [search, setSearch] = useState("");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const activeSlug = searchParams.get("category") || initialSlug || "all";

  useEffect(() => {
    const loadCategories = async () => {
      const res = await apiClient.get<{ data: CategoryItem[] }>("/stories/categories-with-count", {
        params: { language: locale }
      });
      setCategories([{ id: 0, name: t("allCategories"), slug: "all", storiesCount: 0 }, ...(res.data.data || [])]);
    };
    
    void loadCategories();
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
    sort === "latest" ? t("sortLatest")
      : sort === "views" ? t("sortViews")
        : sort === "rating" ? t("sortRating")
          : sort === "title_asc" ? t("sortTitle")
            : t("sortChapters");

  useEffect(() => {
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
        },
      });
      setStories((res.data.data || []).map((story) => ({
        ...story,
        title: getLocalizedValue(locale, story.titleVi, story.titleEn, story.title),
      })));
      setLastPage(res.data.meta?.lastPage || 1);
    };

    void loadStories();
  }, [currentCategory, page, sort, categories, search, locale]);

  const handleCategoryClick = (categorySlug: string) => {
    setPage(1);
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (categorySlug === "all") {
      current.delete("category");
    } else {
      current.set("category", categorySlug);
    }
    current.delete("page");
    const searchStr = current.toString();
    const query = searchStr ? `?${searchStr}` : "";
    router.push(`${pathname}${query}`);
  };

  return (
    /* Đã giảm space-y-4 xuống space-y-2 trên mobile */
    <div className="space-y-2 lg:space-y-6">
      
      {/* Đã giảm pt-4 xuống pt-2 trên mobile */}
      <div className="px-2 lg:px-4 pt-2 lg:pt-4">
        <Breadcrumbs items={breadcrumbItems} lang={locale === "en" ? "en" : "vi"} />
      </div>

      {/* Đã giảm gap-6 xuống gap-3 trên mobile để kéo thanh Search lại gần Nút thể loại */}
      <div className="mx-0 px-2 lg:px-6 pb-8 flex flex-col md:flex-row gap-3 lg:gap-8">
        
        {/* === LEFT SIDEBAR === */}
        <div className="w-full md:w-64 lg:w-80 flex-shrink-0">
          
          <div className="flex md:flex-col overflow-x-auto md:overflow-visible gap-2 pb-1 md:pb-0 snap-x no-scrollbar">
            {categories.map((cat) => {
              const isActive = cat.slug === activeSlug;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.slug)}
                  className={`text-left text-sm py-1.5 px-4 md:py-2 md:px-3 rounded-full md:rounded-lg transition-colors whitespace-nowrap md:whitespace-normal snap-start shrink-0 ${
                    isActive
                      ? "bg-blue-600 md:bg-blue-50 dark:bg-blue-500/20 text-white md:text-blue-700 dark:text-blue-400 font-semibold shadow-sm"
                      : "bg-gray-100 md:bg-transparent text-gray-700 md:text-gray-600 hover:bg-gray-200 md:hover:bg-gray-100 dark:bg-gray-800 md:dark:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {getLocalizedValue(locale, cat.nameVi, cat.nameEn, cat.name)}
                </button>
              );
            })}
          </div>

          <div className="hidden md:block mt-6">
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
            </div>
          </div>
        </div>

        {/* === MAIN CONTENT === */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mb-4 hidden md:block">
            {currentCategory && currentCategory.id !== 0 ? currentCategoryName : t("allStoriesTitle")}
          </h1>

          {/* Đã giảm mb-6 xuống mb-4 trên mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 lg:mb-6">
            
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Tìm tên truyện, tác giả, thể loại..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="block w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-500/30 transition-shadow"
              />
            </div>

            <div className="relative z-10 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="flex items-center justify-between w-full sm:w-44 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-slate-900 dark:text-white rounded-xl px-4 py-2 font-medium text-sm transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
              >
                <span>{selectedSortLabel}</span>
                <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-2" />
              </button>

              {sortDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-44 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl py-2 overflow-hidden">
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
                      className="flex justify-between items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-6 mb-8">
            {stories.map((story) => (
              <HorizontalStoryCard 
                key={story.id} 
                story={story} 
                locale={locale} 
                searchTerm={search} 
              />
            ))}
            {stories.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-10 bg-gray-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Không tìm thấy truyện nào phù hợp.</p>
              </div>
            )}
          </div>

          {stories.length > 0 && lastPage > 1 && (
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {tCommon("prev")}
              </button>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl">
                {page} / {lastPage}
              </span>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
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

function HorizontalStoryCard({ story, locale, searchTerm }: { story: StoryItem; locale: string; searchTerm: string }) {
  const t = useTranslations("CategoryStoriesPage");
  const rating = Number(story.averageRating || 0).toFixed(1);
  const views = story.totalViews > 1000 ? (story.totalViews / 1000).toFixed(1) + 'K' : story.totalViews;
  const localizedTitle = getLocalizedValue(locale, story.titleVi, story.titleEn, story.title);

  return (
    <div className="flex gap-3 sm:gap-4 lg:gap-6 group cursor-pointer overflow-hidden p-2 sm:p-3 bg-white dark:bg-slate-900 rounded-2xl hover:shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-slate-800 transition-all">
      <div className="relative w-[90px] sm:w-[120px] lg:w-[140px] aspect-[2/3] flex-shrink-0 bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden">
        <Image
          src={story.thumbnailUrl || "https://placehold.co/200x300?text=No+Cover"}
          alt={localizedTitle}
          fill
          sizes="(max-width: 640px) 90px, (max-width: 1024px) 120px, 140px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {story.status === "completed" && (
           <div className="absolute top-1.5 left-1.5 bg-green-500/90 text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm">
             Full
           </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col py-0.5">
        <Link href={`/story/${story.slug}`} className="block">
          <h3 className="font-bold text-sm sm:text-base lg:text-lg text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
            <HighlightText text={localizedTitle} highlight={searchTerm} />
          </h3>
        </Link>
        
        <p className="text-[11px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 mt-1 sm:mt-1.5 line-clamp-1">
          Tác giả: <HighlightText text={story.author?.name || t("updating")} highlight={searchTerm} />
        </p>

        {/* Short intro/description similar to trending/new pages */}
        {story.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            <HighlightText text={story.description} highlight={searchTerm} />
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-1.5 sm:mt-2">
          {story.categories?.slice(0, 3).map((catWrapper, idx) => {
             const catName = getLocalizedValue(locale, catWrapper.category.nameVi, catWrapper.category.nameEn, catWrapper.category.name);
             return (
              <span
                key={catWrapper.category.id}
                className={`text-xs px-2 py-1 rounded-full font-semibold shadow-sm transition-colors ${
                  idx === 0
                    ? "text-white bg-blue-600 dark:bg-blue-500"
                    : "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30"
                }`}
              >
                <HighlightText text={catName} highlight={searchTerm} />
              </span>
            );
          })}
        </div>

        <div className="mt-auto pt-2 flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-medium">
          <div className="flex items-center gap-1 text-orange-500">
            <span className="text-yellow-400 text-xs sm:text-sm">★</span>
            <span>{rating}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <span>{t("viewsShort", { count: views })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}