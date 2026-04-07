import HomePageClient, { type HomePageInitialData } from "./HomePageClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const NEW_LIMIT = 5;
const POPULAR_LIMIT = 9;
const REVALIDATE_SECONDS = 300;

type QueryValue = string | number | boolean | undefined;

const buildQuery = (params?: Record<string, QueryValue>) => {
  if (!params) return "";
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });

  return search.toString();
};

async function fetchJson<T>(path: string, params?: Record<string, QueryValue>): Promise<T | null> {
  const query = buildQuery(params);
  const endpoint = query ? `${API_BASE_URL}${path}?${query}` : `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(endpoint, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchExplore(params: Record<string, QueryValue>) {
  const response = await fetchJson<{ data?: any[] }>("/stories/explore", params);
  return response?.data || [];
}

export default async function HomePage({ params }: { params?: Promise<{ lang: string }> } = {}) {
  const resolved = params ? await params : undefined;
  const lang = resolved?.lang === "en" ? "en" : "vi";

  const [
    newestStories,
    newestChapters,
    popularStories,
    completedStories,
    trendingStories,
    topCategoriesRes,
    fallbackCategoriesRes,
    authorsRes,
    hallRes,
    bannersRes,
  ] = await Promise.all([
    fetchExplore({ limit: NEW_LIMIT, lang, sort: "latest" }),
    fetchJson<any[]>("/chapters/latest", { limit: 12, lang }),
    fetchExplore({ limit: POPULAR_LIMIT, lang, sort: "rating" }),
    fetchExplore({ limit: 14, lang, sort: "rating", status: "completed" }),
    fetchExplore({ limit: POPULAR_LIMIT, lang, sort: "views", trendWindow: "week" }),
    fetchJson<{ data?: any[] }>("/stories/categories/top", { limit: 20, lang }),
    fetchJson<any[]>("/stories/categories", { language: lang }),
    fetchJson<any[]>("/stories/authors"),
    fetchJson<{ data?: any[] }>("/stories/hall-of-fame", { limit: 6 }),
    fetchJson<{ data?: any[] }>("/banners", { active: true, lang }),
  ]);

  const topCategories = topCategoriesRes?.data || [];
  const fallbackCategories = (fallbackCategoriesRes || []).map((item: any) => ({
    ...item,
    storiesCount: item?.storiesCount ?? 0,
  }));
  const allCategories = topCategories.length ? topCategories : fallbackCategories;

  const categoryIdBySlug = new Map((allCategories || []).map((category: any) => [category.slug, category.id]));
  const actionId = categoryIdBySlug.get("action");
  const xuyenKhongId = categoryIdBySlug.get("xuyen-khong");
  const shounenId = categoryIdBySlug.get("shounen");
  const tienHiepId = categoryIdBySlug.get("tien-hiep");

  const [actionStories, xuyenKhongStories, shounenStories, tienHiepStories] = await Promise.all([
    actionId ? fetchExplore({ limit: POPULAR_LIMIT, lang, categoryId: actionId }) : Promise.resolve([]),
    xuyenKhongId ? fetchExplore({ limit: POPULAR_LIMIT, lang, categoryId: xuyenKhongId }) : Promise.resolve([]),
    shounenId ? fetchExplore({ limit: POPULAR_LIMIT, lang, categoryId: shounenId }) : Promise.resolve([]),
    tienHiepId ? fetchExplore({ limit: POPULAR_LIMIT, lang, categoryId: tienHiepId }) : Promise.resolve([]),
  ]);

  const excludedSlugs = new Set(["action", "xuyen-khong", "shounen", "tien-hiep"]);
  const displayCategories = (allCategories || []).filter((category: any) => !excludedSlugs.has(category.slug)).slice(0, 8);

  const displayCategoryResults = await Promise.all(
    displayCategories.map((category: any) => fetchExplore({ limit: POPULAR_LIMIT, lang, categoryId: category.id })),
  );

  const displayCategoryStories = displayCategories.reduce<Record<number, any[]>>((acc, category: any, index: number) => {
    acc[category.id] = displayCategoryResults[index] || [];
    return acc;
  }, {});

  const initialData: HomePageInitialData = {
    newestStories: newestStories || [],
    newestChapters: newestChapters || [],
    popularStories: popularStories || [],
    completedStories: completedStories || [],
    trendingStories: trendingStories || [],
    actionStories: actionStories || [],
    xuyenKhongStories: xuyenKhongStories || [],
    shounenStories: shounenStories || [],
    tienHiepStories: tienHiepStories || [],
    topCategories: topCategories || [],
    allCategories: allCategories || [],
    authors: authorsRes || [],
    hallContributors: hallRes?.data || [],
    heroBanners: bannersRes?.data || [],
    displayCategories,
    displayCategoryStories,
  };

  return <HomePageClient initialData={initialData} />;
}
