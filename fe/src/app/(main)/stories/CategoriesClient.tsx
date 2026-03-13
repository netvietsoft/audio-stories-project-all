"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, Eye } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";

type CategoryItem = {
  id: number;
  name: string;
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
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating?: number | string;
  createdAt?: string;
  author?: { name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read sort from URL if any, or default to views (Phổ biến)
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalStories, setTotalStories] = useState(0);

  const [activeTab, setActiveTab] = useState<"tien_hiep" | "truyen_ngan">("tien_hiep");

  const [wordCount, setWordCount] = useState<string>("all");
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
  // Either from props (if using /categories/[slug]), URL search param, or default to all
  const activeSlug = initialSlug || searchParams.get("category") || "all";

  useEffect(() => {
    const loadCategories = async () => {
      const res = await apiClient.get<{ data: CategoryItem[] }>("/stories/categories-with-count");
      setCategories([{ id: 0, name: "Tất cả", slug: "all", storiesCount: 0 }, ...(res.data.data || [])]);
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
  }, []);

  const currentCategory = useMemo(() => categories.find((item) => item.slug === activeSlug), [categories, activeSlug]);

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
          categoryId: currentCategory && currentCategory.id !== 0 ? currentCategory.id : undefined,
          sort: apiSort,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(author ? { authorId: author } : {}), // Assuming backend supports author search via authorId or similar query
        },
      });
      setStories(res.data.data || []);
      setLastPage(res.data.meta?.lastPage || 1);
      setTotalStories(res.data.meta?.total || 0);
    };

    void loadStories();
  }, [currentCategory, page, sort, categories, search, status, author]);

  const handleCategorySelect = (slug: string) => {
    setPage(1);
    if (!initialSlug) {
      const params = new URLSearchParams(searchParams.toString());
      if (slug === "all") {
        params.delete("category");
      } else {
        params.set("category", slug);
      }
      router.push(`/categories?${params.toString()}`);
    } else {
      router.push(slug === "all" ? '/categories' : `/categories/${slug}`);
    }
  };

  return (
    <div className="mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* LEFT SIDEBAR */}
      <div className="w-full md:w-80 flex-shrink-0 space-y-8">
        {/* Category List */}
        <div className="grid grid-cols-3 gap-y-4 gap-x-2">
          {categories.map((cat) => {
            const isActive = cat.slug === activeSlug;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.slug)}
                className={`text-left text-sm py-1.5 px-3 rounded-md transition-colors ${isActive
                  ? "bg-blue-50 dark:bg-blue-500/20 text-black dark:text-white font-medium shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Keywords */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            Các từ khóa liên quan đến {currentCategory?.name !== "Tất cả" ? currentCategory?.name?.toLowerCase() : "tiểu thuyết lịch sử"}
          </h3>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200">
              sói hoàng hôn
            </span>
            <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200">
              người sói trực tuyến
            </span>
            <span className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md cursor-pointer hover:bg-gray-200">
              biến hình người sói nữ
            </span>
          </div>
        </div>

        {/* Popular Searches */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Tìm kiếm phổ biến</h3>
          {/* Mock content for popular searches */}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          {currentCategory?.name !== "Tất cả" ? currentCategory?.name : "Tất cả tiểu thuyết"}
        </h1>

        {/* Description Box */}
        {currentCategory && currentCategory.name !== "Tất cả" && (
          <div className="bg-blue-50 dark:bg-blue-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-black dark:text-white line-clamp-1">
              {currentCategory.description || `Tiểu thuyết về ${currentCategory.name.toLowerCase()} là một thể loại văn học miêu tả ${currentCategory.name.toLowerCase()} và những sinh vật biến hình thần...`}
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
              placeholder="Tìm kiếm truyện..."
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
                  {status === "" && "Tất cả trạng thái"}
                  {status === "ongoing" && "Đang ra"}
                  {status === "completed" && "Đã hoàn thành"}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              {statusDropdownOpen && (
                <div className="absolute left-0 mt-2 w-full sm:w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                  {[
                    { id: "", label: "Tất cả trạng thái" },
                    { id: "ongoing", label: "Đang ra" },
                    { id: "completed", label: "Đã hoàn thành" },
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
                  {selectedAuthor ? selectedAuthor.name : "Chọn tác giả..."}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
              </button>

              {authorDropdownOpen && (
                <div className="absolute left-0 mt-2 w-full sm:w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 p-2">
                   <input
                      type="text"
                      placeholder="Tìm kiếm tác giả..."
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
                          Tất cả tác giả
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
                          Không tìm thấy tác giả
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
              <span>
                {sort === "latest" && "Mới cập nhật"}
                {sort === "views" && "Lượt xem"}
                {sort === "rating" && "Đánh giá"}
                {sort === "title_asc" && "Tên A-Z"}
                {sort === "chapters_desc" && "Số chương"}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-full sm:w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                {[
                  { id: "latest", label: "Mới cập nhật" },
                  { id: "views", label: "Lượt xem" },
                  { id: "rating", label: "Đánh giá" },
                  { id: "title_asc", label: "Tên A-Z" },
                  { id: "chapters_desc", label: "Số chương" },
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {stories.map((story) => (
            <HorizontalStoryCard key={story.id} story={story} />
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
  );
}

function HorizontalStoryCard({ story }: { story: StoryItem }) {
  const rating = Number(story.averageRating || 0).toFixed(1);
  const views = story.totalViews > 1000 ? (story.totalViews / 1000).toFixed(1) + 'K' : story.totalViews;
  const isNew = story.createdAt ? Date.now() - new Date(story.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000 : false;

  return (
    <div className="flex gap-4 group cursor-pointer bg-white dark:bg-slate-900 rounded-xl overflow-hidden p-2 transition hover:bg-gray-50 dark:hover:bg-slate-800">
      <div className="relative w-[100px] h-[133px] flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <Image
          src={story.thumbnailUrl || "https://placehold.co/200x300?text=No+Cover"}
          alt={story.title}
          fill
          sizes="100px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 flex flex-col items-center">
          <span className="text-[10px] text-white font-bold leading-none">G</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <Link href={`/story/${story.slug}`} className="block">
            <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
              {story.title}
            </h3>
          </Link>
          <div className="flex flex-wrap gap-2 mt-1">
            {story.categories?.map((catWrapper, idx) => (
              <span
                key={catWrapper.category.id}
                className={`text-[11px] px-2 py-0.5 rounded-sm ${idx === 0
                  ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30"
                  : "text-gray-500 bg-gray-100 dark:bg-gray-800"
                  }`}
              >
                {catWrapper.category.name}
              </span>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mt-1.5">
            {story.author?.name || "Đang cập nhật"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
            {story.description || "Một câu chuyện tình yêu trong thế giới mafia. Một thế giới đen tối với biết bao bí ẩn..."}
          </p>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs font-medium text-orange-500">
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">★★★★★</span>
            <span>{rating}</span>
          </div>
          <div className="text-gray-500">
            {views}
          </div>
        </div>
      </div>
    </div>
  );
}
