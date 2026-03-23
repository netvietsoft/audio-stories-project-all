"use client";

import { useState, useEffect, useRef } from "react";
import Link from "@/components/shared/LocalizedLink";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Search, Moon, Sun, Bell,
  ChevronDown, LogOut, Coins, Menu, X,
  UserCircle, History, Heart,
  Home, LayoutGrid, Zap, Flame, Trophy, Sparkles
} from "lucide-react";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/constants/auth";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { useDebounce } from "@/hooks/useDebounce";

const localeCookieName = "NEXT_LOCALE";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  data: NotificationItem[];
  meta?: {
    unreadCount?: number;
  };
};

type TopCategoryItem = {
  id: number;
  name: string;
  slug: string;
  language: string;
  storiesCount: number;
};

type SearchResultItem = {
  id: string;
  title: string;
  titleVi: string | null;
  titleEn: string | null;
  slug: string;
  thumbnailUrl: string | null;
  author?: { name: string };
};

type ExploreResponse = {
  data: SearchResultItem[];
  meta: { page: number; lastPage: number; total: number };
};

export default function Navbar() {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const t = useTranslations("Navbar");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // State cho Mobile/Tablet Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Refs
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const rankingMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const user = useUserStore((state) => state.user);
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [topCategories, setTopCategories] = useState<TopCategoryItem[]>([]);

  // Debug log
  useEffect(() => {
    console.log("Search query:", searchQuery);
    console.log("Debounced query:", debouncedSearchQuery);
    console.log("Show dropdown:", showSearchDropdown);
    console.log("Results:", searchResults);
  }, [searchQuery, debouncedSearchQuery, showSearchDropdown, searchResults]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user) {
      setNotifs([]);
      setUnreadNotifs(0);
      return;
    }

    const loadNotifications = async () => {
      try {
        const response = await apiClient.get<NotificationsResponse>("/notifications", {
          params: {
            page: 1,
            limit: 5,
          },
        });
        const rows = response.data.data || [];
        setNotifs(rows);
        setUnreadNotifs(response.data.meta?.unreadCount ?? rows.filter((row) => !row.isRead).length);
      } catch {
        setNotifs([]);
      }
    };

    void loadNotifications();
  }, [user]);

  useEffect(() => {
    const loadTopCategories = async () => {
      try {
        const response = await apiClient.get<{ data: TopCategoryItem[] }>("/stories/categories/top", {
          params: { limit: 5, lang: currentLang },
        });
        setTopCategories(response.data.data || []);
      } catch {
        setTopCategories([]);
      }
    };

    void loadTopCategories();
  }, [currentLang]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (rankingMenuRef.current && !rankingMenuRef.current.contains(event.target as Node)) {
        setIsRankingOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search with debounce
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const searchStories = async () => {
      setIsSearching(true);
      try {
        const response = await apiClient.get<ExploreResponse>("/stories/explore", {
          params: {
            search: debouncedSearchQuery,
            page: 1,
            limit: 5,
          },
        });
        console.log("Search response:", response.data);
        setSearchResults(response.data.data || []);
        setShowSearchDropdown(true);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    void searchStories();
  }, [debouncedSearchQuery]);

  const markRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
      setUnreadNotifs((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore read errors in quick dropdown action
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/${currentLang}/search?keyword=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
      setShowSearchDropdown(false);
      closeMobileMenu();
    }
  };

  const handleSearchResultClick = (slug: string) => {
    setSearchQuery("");
    setShowSearchDropdown(false);
    router.push(`/${currentLang}/story/${slug}`);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const switchLocale = (nextLocale: "vi" | "en") => {
    if (nextLocale === currentLang) return;

    const normalizedPath = (pathname || "/").replace(/^\/(vi|en)(?=\/|$)/, "") || "/";
    const queryString = searchParams.toString();
    const nextPath = `/${nextLocale}${normalizedPath === "/" ? "" : normalizedPath}${queryString ? `?${queryString}` : ""}`;

    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000`;
    closeMobileMenu();
    router.push(nextPath);
    router.refresh();
  };

  const handleLogout = () => {
    useUserStore.getState().clearAuth();
    clearAuthCookies();
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    closeMobileMenu();
    router.push(`/${currentLang}`);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full overflow-x-clip bg-blue-50/90 backdrop-blur-md dark:bg-slate-900/90">
        <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14">
          <div className="flex h-16 min-w-0 items-center justify-between gap-2">

            {/* LOGO & MENU CHÍNH (Desktop) */}
            <div className="flex min-w-0 flex-shrink items-center gap-2 lg:gap-8">
              <Link href="/" className="flex min-w-0 flex-shrink-0 items-center gap-2 text-2xl font-bold">
                <span className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xl shadow-md">
                  N
                </span>
                <span className="hidden sm:inline truncate flex-shrink text-blue-600 dark:text-blue-400">Netviet Audio</span>
              </Link>


              {/* Menu Desktop (Ẩn khi màn hình nhỏ hơn lg) */}
              <nav className="hidden xl:flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                <Link href="/" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("home")}</Link>
                <div
                  ref={categoryMenuRef}
                  className="relative"
                >
                  <button 
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    className="flex items-center px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
                  >
                    {t("categories")} <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  {isCategoryOpen && (
                    <div className="absolute top-full left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 mt-1">
                      {topCategories.map((item) => (
                        <Link 
                          key={item.id} 
                          href={`/categories/${item.slug}`} 
                          onClick={() => setIsCategoryOpen(false)}
                          className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {item.name}
                        </Link>
                      ))}
                      <Link 
                        href="/stories" 
                        onClick={() => setIsCategoryOpen(false)}
                        className="block px-4 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t("viewAll")} &rarr;
                      </Link>
                    </div>
                  )}
                </div>
                <Link href="/new" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("new")}</Link>
                <Link href="/trending" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("trending")}</Link>
                <Link href="/interactive" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("interactiveStories")}</Link>
                <div
                  ref={rankingMenuRef}
                  className="relative"
                >
                  <button 
                    onClick={() => setIsRankingOpen(!isRankingOpen)}
                    className="flex items-center px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
                  >
                    BXH <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  {isRankingOpen && (
                    <div className="absolute top-full left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 mt-1">
                      <Link 
                        href="/ranking" 
                        onClick={() => setIsRankingOpen(false)}
                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t("ranking")}
                      </Link>
                      <Link 
                        href="/vinh-danh" 
                        onClick={() => setIsRankingOpen(false)}
                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t("memberRanking")}
                      </Link>
                    </div>
                  )}
                </div>
              </nav>
            </div>

            {/* RIGHT SECTION */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
              <div className="relative mx-2 hidden flex-grow xl:flex max-w-sm md:max-w-md" ref={searchRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder={t("searchPlaceholder")}
                  className="hidden xl:block w-full pl-9 pr-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 text-sm outline-none transition-all"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

                {/* Search Results Dropdown */}
                {showSearchDropdown && searchQuery.trim() && (
                  <div className="absolute top-full left-0 mt-2 w-full max-w-[90vw] md:min-w-[320px] lg:min-w-[400px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-2 z-[100] max-h-[500px] overflow-y-auto">
                    {isSearching ? (
                      <div className="px-4 py-8 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Đang tìm kiếm...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.map((story) => (
                          <button
                            key={story.id}
                            onClick={() => handleSearchResultClick(story.slug)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <img
                              src={story.thumbnailUrl || "https://placehold.co/100x100?text=No+Cover"}
                              alt={story.title}
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                                {currentLang === 'en' ? story.titleEn || story.title : story.titleVi || story.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                {story.author?.name || "Đang cập nhật"}
                              </p>
                            </div>
                          </button>
                        ))}
                        <Link
                          href={`/search?keyword=${encodeURIComponent(searchQuery)}`}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setSearchQuery("");
                          }}
                          className="block px-4 py-3 text-center text-sm text-blue-600 dark:text-blue-400 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 transition-colors"
                        >
                          Xem tất cả kết quả
                        </Link>
                      </>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <Search className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Không tìm thấy kết quả</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="hidden xl:flex flex-shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              >
                {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <button
                onClick={() => router.push(`/${currentLang}/search`)}
                className="xl:hidden flex-shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
                aria-label={t("searchPlaceholder")}
              >
                <Search className="h-5 w-5" />
              </button>

              <div
                className="hidden lg:flex flex-shrink-0 relative"
                ref={langMenuRef}
              >
                <button 
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                    {currentLang}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>

                {isLangOpen && (
                  <div className="absolute top-full right-0 mt-1 w-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => {
                        switchLocale("vi");
                        setIsLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        currentLang === "vi" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      Tiếng Việt
                    </button>
                    <button
                      onClick={() => {
                        switchLocale("en");
                        setIsLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        currentLang === "en" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      English
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
                <Link href="/topup" className="hidden xl:flex items-center gap-1.5 whitespace-nowrap bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 md:px-3 py-1.5 rounded-full text-sm font-medium hover:bg-amber-200 transition-colors">
                  <Coins className="h-4 w-4" /> <span className="hidden xl:inline">{t("topUp")}</span>
                </Link>

                {/* Chuông thông báo */}
                <div className="relative hidden lg:flex flex-shrink-0" ref={notifMenuRef}>
                  <button
                    onClick={() => {
                      setIsNotifOpen(!isNotifOpen);
                      setIsUserMenuOpen(false); // Đóng menu user nếu đang mở
                    }}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 relative"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadNotifs > 0 && (
                      <span className="absolute top-1 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                    )}
                  </button>

                  {/* Dropdown Thông báo */}
                  {isNotifOpen && (
                    <div className="fixed top-16 inset-x-2 mt-0 w-auto sm:absolute sm:top-auto sm:inset-x-auto sm:right-0 sm:mt-2 sm:w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-2 z-50 max-h-[70vh] sm:max-h-[500px] overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">{t("notifications")}</h3>
                        {unreadNotifs > 0 && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                            {unreadNotifs}
                          </span>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {notifs.length ? notifs.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => void markRead(item.id)}
                            className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors relative ${item.isRead
                                ? "bg-white dark:bg-gray-800"
                                : "bg-blue-50 dark:bg-blue-900/20"
                              }`}
                          >
                            {!item.isRead && (
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                            <div className={item.isRead ? "ml-0" : "ml-4"}>
                              <p className={`font-semibold ${item.isRead ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                                {item.title}
                              </p>
                              <p className={`mt-1 line-clamp-2 text-xs ${item.isRead ? "text-gray-500 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}>
                                {item.body}
                              </p>
                              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                {new Date(item.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "vi-VN", {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </button>
                        )) : (
                          <div className="px-4 py-8 text-center">
                            <Bell className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t("emptyNotifications")}</p>
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/${locale}/notifications`}
                        className="block px-4 py-3 text-center text-sm text-blue-600 dark:text-blue-400 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 transition-colors"
                      >
                        {t("viewAllNotifications")}
                      </Link>
                    </div>
                  )}
                </div>

                {user ? (
                  <>
                    <Link
                      href="/profile/favorites"
                      className="hidden lg:flex items-center gap-1.5 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label={t("favorites")}
                    >
                      <Heart className="w-5 h-5" />
                      <span className="hidden xl:inline-block text-sm font-medium whitespace-nowrap">{t("favorites")}</span>
                    </Link>

                    <Link
                      href="/profile/history"
                      className="hidden lg:flex items-center gap-1.5 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label={t("listeningHistory")}
                    >
                      <History className="w-5 h-5" />
                      <span className="hidden xl:inline-block text-sm font-medium whitespace-nowrap">{t("listeningHistory")}</span>
                    </Link>
                  </>
                ) : null}

                {/* Avatar Desktoop Only */}
                {!user ? (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button 
                      onClick={openLogin}
                      className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-xs sm:text-sm font-semibold"
                    >
                      {t("login")}
                    </button>
                  </div>
                ) : (<div className="relative flex-shrink-0" ref={userMenuRef}>
                  <button
                    onClick={
                      () => {
                        setIsUserMenuOpen(!isUserMenuOpen);
                        setIsNotifOpen(false); // Đóng thông báo nếu đang mở
                      }
                    }
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <img src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.email}`} alt="Avatar" className="h-8 w-8 rounded-full bg-gray-200" />
                  </button>

                  {/* Dropdown User */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50">
                      <p className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{t("hello", { name: user.name || user.email })}</p>
                      <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <UserCircle className="h-4 w-4" /> {t("profile")}
                      </Link>
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                      <button
                        onClick={() => {
                          handleLogout();
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <LogOut className="h-4 w-4" /> {t("logout")}
                      </button>
                    </div>
                  )}
                </div>)}

                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 lg:hidden flex-shrink-0"
                  aria-label={t("openMenu")}
                >
                  <Menu className="h-6 w-6" />
                </button>

              </div>
            </div>
          </div>
        </div>
      </header>

      {/* OVERLAY MENU (Dành cho Mobile & Tablet) */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm lg:hidden transition-opacity"
            onClick={closeMobileMenu}
          ></div>

          {/* Side Sheet */}
          <div className="fixed inset-y-0 right-0 z-[70] w-[85%] max-w-sm bg-white dark:bg-slate-950 shadow-2xl flex flex-col lg:hidden animate-in slide-in-from-right duration-300">
            {/* Header: User Info / Login */}
            <div className="p-6 border-b border-gray-100 dark:border-white/5 relative bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10">
              <button
                onClick={closeMobileMenu}
                className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-slate-800 text-gray-500 hover:text-gray-700 shadow-sm border border-gray-100 dark:border-slate-700 transition-transform active:scale-95"
                aria-label={t("closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>

              {user ? (
                <div className="flex items-center gap-4 pr-10">
                  <div className="relative">
                    <img src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.email}`} alt="Avatar" className="h-14 w-14 rounded-full border-2 border-blue-200 dark:border-blue-800 object-cover shadow-sm" />
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white dark:border-slate-900"></div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate text-lg tracking-tight">{user.name || user.email}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Member</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pr-10 pt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg">N</div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none">Netviet Audio</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sách nói & Audio stories</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      openLogin();
                      closeMobileMenu();
                    }}
                    className="flex justify-center w-full py-3 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-bold text-sm shadow-xl active:scale-[0.98] transition-all"
                  >
                    {t("login")}
                  </button>
                </div>
              )}
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder={t("mobileSearchPlaceholder")}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/50 text-sm border-2 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none"
                />
                <Search className="absolute left-3.5 top-4 h-5 w-5 text-slate-400" />

                {/* Mobile Search Results */}
                {showSearchDropdown && searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl py-2 z-50 max-h-[350px] overflow-y-auto overflow-x-hidden">
                    {isSearching ? (
                      <div className="px-4 py-8 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Đang tìm kiếm...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {searchResults.map((story) => (
                          <button
                            key={story.id}
                            onClick={() => {
                              handleSearchResultClick(story.slug);
                              closeMobileMenu();
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                          >
                            <img
                              src={story.thumbnailUrl || "https://placehold.co/100x100?text=No+Cover"}
                              alt={story.title}
                              className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                                {currentLang === 'en' ? story.titleEn || story.title : story.titleVi || story.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {story.author?.name || "Đang cập nhật"}
                              </p>
                            </div>
                          </button>
                        ))}
                        <Link
                          href={`/search?keyword=${encodeURIComponent(searchQuery)}`}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setSearchQuery("");
                            closeMobileMenu();
                          }}
                          className="block px-4 py-4 text-center text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          Xem tất cả kết quả
                        </Link>
                      </div>
                    ) : (
                      <div className="px-4 py-10 text-center">
                        <Search className="h-10 w-10 mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Không tìm thấy kết quả</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Main Navigation */}
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 ml-1">{t("home")}</p>
                  <div className="grid grid-cols-1 gap-1">
                    <Link href="/" onClick={closeMobileMenu} className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                        <Home className="w-5 h-5" />
                      </div>
                      <span className="text-sm tracking-tight">{t("home")}</span>
                    </Link>
                    <Link href="/stories" onClick={closeMobileMenu} className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                        <LayoutGrid className="w-5 h-5" />
                      </div>
                      <span className="text-sm tracking-tight">{t("categories")}</span>
                    </Link>
                    <Link href="/new" onClick={closeMobileMenu} className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                        <Zap className="w-5 h-5" />
                      </div>
                      <span className="text-sm tracking-tight">{t("new")}</span>
                    </Link>
                    <Link href="/trending" onClick={closeMobileMenu} className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                        <Flame className="w-5 h-5" />
                      </div>
                      <span className="text-sm tracking-tight">{t("popular")}</span>
                    </Link>
                    <Link href="/interactive" onClick={closeMobileMenu} className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-sm tracking-tight">{t("interactiveStories")}</span>
                    </Link>
                    
                    {/* BXH Dropdown */}
                    <div className="space-y-1">
                      <button 
                        onClick={() => setIsRankingOpen(!isRankingOpen)}
                        className="group flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                            <Trophy className="w-5 h-5" />
                          </div>
                          <span className="text-sm tracking-tight">BXH</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isRankingOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isRankingOpen && (
                        <div className="ml-14 space-y-1 animate-in slide-in-from-top-2 duration-200">
                          <Link href="/ranking" onClick={closeMobileMenu} className="block px-4 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all">
                            {t("ranking")}
                          </Link>
                          <Link href="/vinh-danh" onClick={closeMobileMenu} className="block px-4 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all">
                            {t("memberRanking")}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {user && (
                  <div className="pt-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 ml-1">{t("account")}</p>
                    <div className="grid grid-cols-1 gap-1">
                      <Link href="/notifications" onClick={closeMobileMenu} className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                          <Bell className="w-5 h-5" />
                        </div>
                        <span className="text-sm tracking-tight">{t("notifications")}</span>
                      </Link>

                      <Link href="/topup" onClick={closeMobileMenu} className="group flex items-center justify-between px-4 py-4 rounded-3xl text-white font-black bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-[0.98] mb-2">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                            <Coins className="w-5 h-5" />
                          </div>
                          <span className="text-sm uppercase tracking-widest">{t("topUpCredits")}</span>
                        </div>
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                      </Link>
                      
                      <Link href="/profile" onClick={closeMobileMenu} className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform">
                          <UserCircle className="w-5 h-5" />
                        </div>
                        <span className="text-sm tracking-tight">{t("profile")}</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer: User Settings & Logout */}
            <div className="p-5 border-t border-gray-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 space-y-4">
              {/* Compact Settings */}
              <div className="flex items-center gap-2">
                {/* Language Switcher */}
                <div className="flex-1 flex items-center p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => switchLocale("vi")}
                    className={`flex-1 py-1.5 text-[10px] font-black transition-all rounded-lg ${
                      currentLang === "vi"
                        ? "bg-slate-900 text-white dark:bg-blue-600"
                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    VN
                  </button>
                  <button
                    type="button"
                    onClick={() => switchLocale("en")}
                    className={`flex-1 py-1.5 text-[10px] font-black transition-all rounded-lg ${
                      currentLang === "en"
                        ? "bg-slate-900 text-white dark:bg-blue-600"
                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    EN
                  </button>
                </div>

                {/* Theme Toggle */}
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="w-12 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm active:scale-95 transition-all text-slate-500 dark:text-slate-400 hover:text-blue-500"
                >
                  {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-red-500 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 transition-all active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4" /> {t("logout")}
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}