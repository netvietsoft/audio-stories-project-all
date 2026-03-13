"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Search, Moon, Sun, Bell,
  ChevronDown, LogOut, Coins, Menu, X,
  UserCircle, History, Heart
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
  storiesCount: number;
};

type SearchResultItem = {
  id: string;
  title: string;
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
  const locale = useLocale();
  const t = useTranslations("Navbar");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // State cho Mobile/Tablet Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Refs
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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
          params: { limit: 5 },
        });
        setTopCategories(response.data.data || []);
      } catch {
        setTopCategories([]);
      }
    };

    void loadTopCategories();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
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
      router.push(`/search?keyword=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
      setShowSearchDropdown(false);
      closeMobileMenu();
    }
  };

  const handleSearchResultClick = (slug: string) => {
    setSearchQuery("");
    setShowSearchDropdown(false);
    router.push(`/story/${slug}`);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const switchLocale = (nextLocale: "vi" | "en") => {
    if (nextLocale === locale) return;
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000`;
    closeMobileMenu();
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
    router.push("/");
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14">
          <div className="flex items-center justify-between h-16">

            {/* LOGO & MENU CHÍNH (Desktop) */}
            <div className="flex items-center gap-8">
              <Link href="/" className="text-2xl font-bold whitespace-nowrap flex items-center gap-2">
                <span className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xl shadow-md">
                  N
                </span>
                <span className="hidden sm:inline text-blue-600 dark:text-blue-400">Netviet Audio</span>
              </Link>


              {/* Menu Desktop (Ẩn khi màn hình nhỏ hơn lg) */}
              <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                <Link href="/" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("home")}</Link>
                <div
                  className="relative"
                  onMouseEnter={() => setIsCategoryOpen(true)}
                  onMouseLeave={() => setIsCategoryOpen(false)}
                >
                  <button className="flex items-center px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
                    {t("categories")} <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  {isCategoryOpen && (
                    <div className="absolute top-full left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 mt-1">
                      {topCategories.map((item) => (
                        <Link key={item.id} href={`/categories/${item.slug}`} className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                          {item.name}
                        </Link>
                      ))}
                      <Link href="/stories" className="block px-4 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">{t("viewAll")} &rarr;</Link>
                    </div>
                  )}
                </div>
                <Link href="/new" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("new")}</Link>
                <Link href="/trending" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("trending")}</Link>
                <Link href="/vinh-danh" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">{t("memberRanking")}</Link>
              </nav>
            </div>

            {/* RIGHT SECTION */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex relative" ref={searchRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder={t("searchPlaceholder")}
                  className="w-56 lg:w-72 xl:w-80 pl-9 pr-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 text-sm outline-none transition-all"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

                {/* Search Results Dropdown */}
                {showSearchDropdown && searchQuery.trim() && (
                  <div className="absolute top-full left-0 w-full min-w-[400px] mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-2 z-[100] max-h-[500px] overflow-y-auto">
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
                                {story.title}
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
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              >
                {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div
                className="hidden sm:block relative"
                onMouseEnter={() => setIsLangOpen(true)}
                onMouseLeave={() => setIsLangOpen(false)}
              >
                <button className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                    {locale}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>

                {isLangOpen && (
                  <div className="absolute top-full right-0 mt-1 w-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => switchLocale("vi")}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        locale === "vi" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      Tiếng Việt
                    </button>
                    <button
                      onClick={() => switchLocale("en")}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        locale === "en" ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      English
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
                <Link href="/topup" className="hidden sm:flex items-center gap-1.5 whitespace-nowrap bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 md:px-3 py-1.5 rounded-full text-sm font-medium hover:bg-amber-200 transition-colors">
                  <Coins className="h-4 w-4" /> <span className="hidden xl:inline">{t("topUp")}</span>
                </Link>

                {/* Chuông thông báo */}
                <div className="relative" ref={notifMenuRef}>
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
                        href="/notifications"
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
                      className="flex items-center gap-1.5 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label={t("favorites")}
                    >
                      <Heart className="w-5 h-5" />
                      <span className="hidden xl:inline-block text-sm font-medium whitespace-nowrap">{t("favorites")}</span>
                    </Link>

                    <Link
                      href="/profile/history"
                      className="flex items-center gap-1.5 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label={t("listeningHistory")}
                    >
                      <History className="w-5 h-5" />
                      <span className="hidden xl:inline-block text-sm font-medium whitespace-nowrap">{t("listeningHistory")}</span>
                    </Link>
                  </>
                ) : null}

                {/* Avatar Desktoop Only */}
                {!user ? (
                  <div className="hidden sm:flex items-center gap-2">
                    <button 
                      onClick={openLogin}
                      className="px-5 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm font-semibold"
                    >
                      {t("login")}
                    </button>
                  </div>
                ) : (<div className="relative hidden sm:block" ref={userMenuRef}>
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

                {/* Nút Hamburger cho mobile/tablet, nằm cạnh avatar */}
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="sm:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 ml-1"
                  aria-label={t("openMenu")}
                >
                  <Menu className="h-6 w-6" />
                </button>
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="hidden sm:block lg:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 ml-1"
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
          <div className="fixed inset-y-0 right-0 z-[70] w-[85%] max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col lg:hidden animate-in slide-in-from-right duration-300">
            {/* Header: User Info / Login */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 relative bg-gradient-to-br from-violet-50/50 to-transparent dark:from-violet-900/10">
              <button
                onClick={closeMobileMenu}
                className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 shadow-sm border border-gray-100 dark:border-gray-700"
                aria-label={t("closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>

              {user ? (
                <div className="flex items-center gap-3 pr-10">
                  <img src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.email}`} alt="Avatar" className="h-12 w-12 rounded-full border-2 border-violet-200 dark:border-violet-800 object-cover" />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{user.name || user.email}</h3>
                    <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">{user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="pr-10">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t("openMenu")}</h3>
                  <button 
                    onClick={() => {
                      openLogin();
                      closeMobileMenu();
                    }}
                    className="flex justify-center w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm shadow-md active:scale-95 transition-all"
                  >
                    {t("login")}
                  </button>
                </div>
              )}
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="relative mb-6">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder={t("mobileSearchPlaceholder")}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-violet-200 transition-all"
                />
                <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />

                {/* Mobile Search Results */}
                {showSearchDropdown && searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-2 z-50 max-h-[300px] overflow-y-auto">
                    {isSearching ? (
                      <div className="px-4 py-6 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-violet-600 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Đang tìm kiếm...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.map((story) => (
                          <button
                            key={story.id}
                            onClick={() => {
                              handleSearchResultClick(story.slug);
                              closeMobileMenu();
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <img
                              src={story.thumbnailUrl || "https://placehold.co/100x100?text=No+Cover"}
                              alt={story.title}
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                                {story.title}
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
                            closeMobileMenu();
                          }}
                          className="block px-4 py-3 text-center text-sm text-violet-600 dark:text-violet-400 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 transition-colors"
                        >
                          Xem tất cả kết quả
                        </Link>
                      </>
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <Search className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Không tìm thấy kết quả</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("quickSettings")}</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1 py-1 dark:border-gray-700 dark:bg-gray-900">
                    <span className="px-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t("language")}</span>
                    <button
                      type="button"
                      onClick={() => switchLocale("vi")}
                      className={`rounded-full px-2 py-1 text-xs font-semibold transition ${
                        locale === "vi"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      VI
                    </button>
                    <button
                      type="button"
                      onClick={() => switchLocale("en")}
                      className={`rounded-full px-2 py-1 text-xs font-semibold transition ${
                        locale === "en"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      EN
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {mounted && theme === "dark" ? t("lightMode") : t("darkMode")}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">{t("home")}</p>
                <Link href="/" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                  <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><Search className="w-4 h-4" /></span>
                  {t("home")}
                </Link>
                <Link href="/categories" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                  <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><Search className="w-4 h-4" /></span>
                  {t("categories")}
                </Link>
                <Link href="/new" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                  <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-green-500"><Search className="w-4 h-4" /></span>
                  {t("new")}
                </Link>
                <Link href="/trending" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                  <span className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500"><Search className="w-4 h-4" /></span>
                  {t("popular")}
                </Link>
                <Link href="/vinh-danh" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                  <span className="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-yellow-500"><Search className="w-4 h-4" /></span>
                  {t("hallOfFame")}
                </Link>
              </div>

              {user && (
                <div className="mt-6 space-y-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">{t("account")}</p>
                  <Link href="/topup" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-violet-700 dark:text-violet-400 font-semibold bg-violet-50 dark:bg-violet-900/20">
                    <span className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center"><Coins className="w-4 h-4" /></span>
                    {t("topUpCredits")}
                  </Link>
                  <Link href="/notifications" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                    <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><Bell className="w-4 h-4" /></span>
                    {t("notifications")}
                  </Link>
                  <Link href="/profile" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                    <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><UserCircle className="w-4 h-4" /></span>
                    {t("profile")}
                  </Link>
                  <Link href="/profile/favorites" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                    <span className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-pink-500"><Heart className="w-4 h-4" /></span>
                    {t("favorites")}
                  </Link>
                  <Link href="/profile/history" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/10">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500"><History className="w-4 h-4" /></span>
                    {t("listeningHistory")}
                  </Link>
                </div>
              )}
            </div>

            {user && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-900/50">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> {t("logout")}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}