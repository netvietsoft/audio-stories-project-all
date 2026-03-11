"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import StoryCard from "@/components/shared/StoryCard";
import { apiClient } from "@/lib/api/api-client";
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
  author?: { id?: string; name: string };
  categories?: Array<{ category: { id: number; name: string; slug: string } }>;
};

type CategoryItem = {
  id: number;
  name: string;
  slug: string;
  storiesCount: number;
};

type AuthorItem = {
  id: string;
  name: string;
};

type HallMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  vipTier: number;
  credits: number;
  totalUnlockedStories: number;
};

type ExploreResponse = {
  data: StoryItem[];
};

type OptionFilters = {
  categoryId: string;
  authorId: string;
  status: string;
  sort: "latest" | "views" | "rating" | "title_asc" | "chapters_desc";
};

const SECTION_LIMIT = 8;

const storySections = [
  {
    key: "newest",
    title: "Truyện mới đăng",
    subtitle: "Vừa cập nhật chương mới nhất.",
    params: { sort: "latest" as const },
    viewAllHref: "/new",
  },
  {
    key: "trending",
    title: "Truyện Trending",
    subtitle: "Đang được nghe nhiều nhất tuần qua.",
    params: { sort: "views" as const, trendWindow: "week" },
    viewAllHref: "/trending",
  },
  {
    key: "popular",
    title: "Truyện phổ biến",
    subtitle: "Top những truyện được đánh giá cao.",
    params: { sort: "rating" as const },
    viewAllHref: "/search?sort=rating",
  },
  {
    key: "completed",
    title: "Truyện hoàn thành",
    subtitle: "Đã ra đủ chương, cày ngay không cần chờ.",
    params: { sort: "latest" as const, status: "completed" },
    viewAllHref: "/search?status=completed",
  },
] as const;

export default function HomePage() {
  const router = useRouter();

  const [sectionsData, setSectionsData] = useState<Record<string, StoryItem[]>>({});
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [hall, setHall] = useState<HallMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  const [quickFilter, setQuickFilter] = useState<OptionFilters>({
    categoryId: "",
    authorId: "",
    status: "",
    sort: "latest",
  });

  const heroStories = useMemo(() => {
    const trending = sectionsData.trending || [];
    const newest = sectionsData.newest || [];
    return (trending.length ? trending : newest).slice(0, 5);
  }, [sectionsData.newest, sectionsData.trending]);

  useEffect(() => {
    if (!heroStories.length) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroStories.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroStories.length]);

  useEffect(() => {
    const loadHome = async () => {
      setIsLoading(true);
      try {
        const sectionRequests = storySections.map((section) =>
          fetchExploreCached<ExploreResponse>({
            limit: SECTION_LIMIT,
            ...section.params,
          }),
        );

        const [sectionRes, catRes, fallbackCatRes, authorRes, hallRes] = await Promise.all([
          Promise.allSettled(sectionRequests),
          apiClient
            .get<{ data: CategoryItem[] }>("/stories/categories/top", { params: { limit: 8 } })
            .then((res) => res.data?.data || [])
            .catch(() => []),
          apiClient
            .get<Array<{ id: number; name: string; slug: string }>>("/stories/categories")
            .then((res) => res.data || [])
            .catch(() => []),
          apiClient
            .get<AuthorItem[]>("/stories/authors")
            .then((res) => res.data || [])
            .catch(() => []),
          apiClient
            .get<{ data: HallMember[] }>("/stories/hall-of-fame", { params: { limit: 3 } })
            .then((res) => res.data?.data || [])
            .catch(() => []),
        ]);

        const nextSections: Record<string, StoryItem[]> = {};
        storySections.forEach((section, idx) => {
          const sectionItem = sectionRes[idx];
          if (!sectionItem || sectionItem.status !== "fulfilled") {
            nextSections[section.key] = [];
            return;
          }
          nextSections[section.key] = sectionItem.value.data || [];
        });

        const categoriesFromTop = catRes || [];
        const categoriesFromFallback = (fallbackCatRes || []).map((item) => ({
          ...item,
          storiesCount: 0,
        }));

        setSectionsData(nextSections);
        setCategories((categoriesFromTop.length ? categoriesFromTop : categoriesFromFallback).slice(0, 8));
        setAuthors(authorRes || []);
        setHall(hallRes || []);
      } catch (error) {
        console.error("Lỗi tải trang chủ:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHome();
  }, []);

  const applyQuickFilter = () => {
    const query = new URLSearchParams();
    if (quickFilter.categoryId) query.set("categoryId", quickFilter.categoryId);
    if (quickFilter.authorId) query.set("authorId", quickFilter.authorId);
    if (quickFilter.status) query.set("status", quickFilter.status);
    if (quickFilter.sort) query.set("sort", quickFilter.sort);
    router.push(`/search?${query.toString()}`);
  };

  const activeHero = heroStories[heroIndex];

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white">
        {activeHero ? (
          <img
            src={activeHero.thumbnailUrl || "https://placehold.co/1600x500?text=Hot+Story"}
            alt={activeHero.title}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-800/40" />
        <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Hero Section</p>
          <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">
            Banner quảng cáo truyện hot,
            <br className="hidden md:block" /> có slideshow tự động
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
            {activeHero ? `Đề cử nổi bật: ${activeHero.title}` : "Khám phá những bộ truyện đang được nghe nhiều nhất."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={activeHero ? `/story/${activeHero.slug}` : "/explore"} className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300">
              Nghe ngay
            </Link>
            <Link href="/trending" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">
              Xem trending
            </Link>
          </div>
          <div className="mt-6 flex gap-2">
            {heroStories.map((story, idx) => (
              <button
                key={story.id}
                onClick={() => setHeroIndex(idx)}
                className={`h-2.5 rounded-full transition-all ${idx === heroIndex ? "w-10 bg-amber-300" : "w-2.5 bg-white/40"}`}
                aria-label={`hero-${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bộ lọc nhanh</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Thể loại | Tác giả | Trạng thái | Sắp xếp | Nút lọc - chuyển trang tìm kiếm
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <select
            value={quickFilter.categoryId}
            onChange={(e) => setQuickFilter((prev) => ({ ...prev, categoryId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">Tất cả thể loại</option>
            {categories.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={quickFilter.authorId}
            onChange={(e) => setQuickFilter((prev) => ({ ...prev, authorId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">Tất cả tác giả</option>
            {authors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={quickFilter.status}
            onChange={(e) => setQuickFilter((prev) => ({ ...prev, status: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ongoing">Đang ra</option>
            <option value="completed">Hoàn thành</option>
          </select>
          <select
            value={quickFilter.sort}
            onChange={(e) => setQuickFilter((prev) => ({ ...prev, sort: e.target.value as OptionFilters["sort"] }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="latest">Mới cập nhật</option>
            <option value="views">Lượt nghe cao nhất</option>
            <option value="rating">Đánh giá cao nhất</option>
            <option value="title_asc">Tên A-Z</option>
            <option value="chapters_desc">Nhiều chương</option>
          </select>
          <button onClick={applyQuickFilter} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Lọc ngay
          </button>
        </div>
      </section>

      {storySections.map((section) => (
        <section key={section.key} className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{section.title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">{section.subtitle}</p>
            </div>
            <Link href={section.viewAllHref} className="text-sm font-semibold text-blue-600 hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(sectionsData[section.key] || []).map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
          {!isLoading && !(sectionsData[section.key] || []).length ? (
            <p className="text-sm text-slate-500">Chưa có dữ liệu cho mục này.</p>
          ) : null}
        </section>
      ))}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Thể loại nổi bật</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Lựa chọn thể loại yêu thích của bạn</p>
          </div>
          <Link href="/categories" className="text-sm font-semibold text-blue-600 hover:underline">
            Xem tất cả
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{cat.name}</p>
              <p className="mt-1 text-xs text-slate-500">{cat.storiesCount} truyện</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-amber-50 to-white p-5 dark:border-slate-700 dark:from-amber-900/20 dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Vinh danh hội viên</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Banner top 3 + nút xem bảng xếp hạng đầy đủ</p>
          </div>
          <Link href="/vinh-danh" className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            Xem bảng xếp hạng đầy đủ
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {hall.map((member, idx) => (
            <div key={member.id} className="rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-slate-800">
              <p className="text-xs font-semibold text-amber-600">Top {idx + 1}</p>
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.displayName}`}
                  alt={member.displayName}
                  className="h-12 w-12 rounded-full"
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{member.displayName}</p>
                  <p className="text-xs text-slate-500">VIP {member.vipTier} | {member.totalUnlockedStories} truyện mở</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
