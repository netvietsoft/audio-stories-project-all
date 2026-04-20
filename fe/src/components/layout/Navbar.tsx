"use client";

import { useState, useEffect, useRef } from "react";
import Link from "@/components/shared/LocalizedLink";
import LanguageFlagIcon from "@/components/shared/LanguageFlagIcon";
import Image from "next/image";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Search, Moon, Sun, Bell,
  ChevronDown, LogOut, Coins, X,
  UserCircle, History, Heart,
  Home, LayoutGrid, Zap, Flame, Trophy, Sparkles, Music2, ArrowRight
} from "lucide-react";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/constants/auth";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { useDebounce } from "@/hooks/useDebounce";
import { locales as supportedLocales } from "@/i18n";

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
  imageUrl?: string | null;
};

type SearchResultItem = {
  id: string;
  title: string;
  titleVi: string | null;
  titleEn: string | null;
  slug?: string;
  thumbnailUrl: string | null;
  author?: { name: string };
  artist?: string | null;
  contentType?: "single" | "playlist";
};

type ExploreResponse = {
  data: SearchResultItem[];
  meta: { page: number; lastPage: number; total: number };
};

type LanguageItem = {
  id: number;
  key: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
};

const localeToCountryCode = (localeKey: string) => {
  switch (localeKey) {
    case "en":
      return "us";
    case "vi":
      return "vn";
    default:
      return localeKey;
  }
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
  const [availableLanguages, setAvailableLanguages] = useState<LanguageItem[]>([
    { id: 0, key: "vi", name: "Tiếng Việt", isActive: true, displayOrder: 0 },
    { id: 1, key: "en", name: "English", isActive: true, displayOrder: 1 },
  ]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Refs
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const rankingMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const user = useUserStore((state) => state.user);
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [topCategories, setTopCategories] = useState<TopCategoryItem[]>([]);
  const userCredits = typeof user?.credits === "number" && Number.isFinite(user.credits)
    ? Math.max(0, Math.floor(user.credits))
    : 0;
  const topUpButtonLabel = userCredits > 0
    ? `${userCredits.toLocaleString(locale === "en" ? "en-US" : "vi-VN")} credits`
    : t("topUp");
  
  const searchPlaceholder = t("searchPlaceholder");
  const normalizedPathname = (pathname || "").replace(/^\/(vi|en)(?=\/|$)/, "") || "/";
  const isMusicRoute = normalizedPathname === "/music" || normalizedPathname.startsWith("/music/");
  const activeMusicTag = (searchParams.get("tag") || "").trim().toLowerCase();
  const resolvedSearchPlaceholder = isMusicRoute ? t("musicSearchPlaceholder") : searchPlaceholder;
  const sectionLandingHref = isMusicRoute ? "/music" : "/story";
  const switchSectionHref = isMusicRoute ? "/story" : "/music";
  const switchSectionLabel = isMusicRoute ? t("switchToStory") : t("switchToMusic");

  const isRouteActive = (href: string) => {
    if (href === "/") {
      return normalizedPathname === "/";
    }

    return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
  };

  const navItemClassName = (href: string) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
      isRouteActive(href)
        ? "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/30"
        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

  const neutralNavItemClassName =
    "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800";

  const musicTagClassName = (tag: string) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
      activeMusicTag === tag.toLowerCase()
        ? "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/30"
        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

  const navLabelClassName = (href: string) =>
    isRouteActive(href) ? "text-pink-600 dark:text-pink-400" : "text-inherit";

  const isDarkTheme = mounted && theme === "dark";
  const currentLanguage = availableLanguages.find((item) => item.key === currentLang);
  const currentLanguageLabel = currentLanguage?.name || currentLang.toUpperCase();
  const musicMenuLabels = {
    home: t("musicHome"),
    usUk: t("musicUsUk"),
    kpop: t("musicKpop"),
    vpop: t("musicVpop"),
    hiphop: t("musicHiphop"),
    trending: t("musicTrending"),
    latest: t("musicLatest"),
  };

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
    if (isMusicRoute) {
      setTopCategories([]);
      return;
    }

    const loadTopCategories = async () => {
      try {
        const response = await apiClient.get<{ data: TopCategoryItem[] }>("/stories/categories/top", {
          params: { limit: 6, lang: currentLang, _t: Date.now() },
        });
        setTopCategories(response.data.data || []);
      } catch {
        setTopCategories([]);
      }
    };

    void loadTopCategories();
  }, [currentLang, isMusicRoute]);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await apiClient.get<{ data?: LanguageItem[] } | LanguageItem[]>("/languages", {
          params: {
            all: true,
            active: true,
          },
        });

        const rows = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : [];

        const normalized = rows
          .filter((item): item is LanguageItem => Boolean(item?.key && item?.name))
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.key.localeCompare(b.key));

        if (normalized.length > 0) {
          setAvailableLanguages(normalized);
        }
      } catch {
        // Keep default vi/en list when languages API is unavailable.
      }
    };

    void fetchLanguages();
  }, []);

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
      if (
        mobileSearchRef.current &&
        !mobileSearchRef.current.contains(event.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
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

    const searchByRoute = async () => {
      setIsSearching(true);
      try {
        if (isMusicRoute) {
          const response = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/music", {
            params: {
              search: debouncedSearchQuery,
              page: 1,
              limit: 5,
            },
          });

          const rows = Array.isArray(response.data?.data) ? response.data.data : [];
          setSearchResults(
            rows.map((item, index) => ({
              id: String(item.id || `music-${index}`),
              title: String(item.title || ""),
              titleVi: null,
              titleEn: null,
              thumbnailUrl: typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : null,
              artist: typeof item.artist === "string" ? item.artist : null,
              contentType: item.contentType === "playlist" ? "playlist" : "single",
            })),
          );
        } else {
          const response = await apiClient.get<ExploreResponse>("/stories/explore", {
            params: {
              search: debouncedSearchQuery,
              page: 1,
              limit: 5,
              lang: currentLang,
            },
          });
          setSearchResults(response.data.data || []);
        }

        setShowSearchDropdown(true);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    void searchByRoute();
  }, [currentLang, debouncedSearchQuery, isMusicRoute]);

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
      const nextPath = isMusicRoute
        ? `/${currentLang}/music?keyword=${encodeURIComponent(searchQuery)}`
        : `/${currentLang}/story/search?keyword=${encodeURIComponent(searchQuery)}`;
      router.push(nextPath);
      setSearchQuery("");
      setShowSearchDropdown(false);
      closeMobileMenu();
    }
  };

  const handleSearchResultClick = (item: SearchResultItem) => {
    setSearchQuery("");
    setShowSearchDropdown(false);

    if (isMusicRoute) {
      router.push(`/${currentLang}/music/${item.slug}`);
      return;
    }

    if (item.slug) {
      router.push(`/${currentLang}/story/${item.slug}`);
    }
  };

  const getSearchResultTitle = (item: SearchResultItem) => {
    if (isMusicRoute) return item.title;
    return currentLang === "en" ? item.titleEn || item.title : item.titleVi || item.title;
  };

  const getSearchResultSubtitle = (item: SearchResultItem) => {
    if (isMusicRoute) {
      if (item.artist?.trim()) return item.artist;
      return item.contentType === "playlist" ? "Playlist" : t("music");
    }

    return item.author?.name || "Đang cập nhật";
  };

  const getViewAllSearchHref = () =>
    isMusicRoute ? `/music?keyword=${encodeURIComponent(searchQuery)}` : `/story/search?keyword=${encodeURIComponent(searchQuery)}`;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const switchLocale = (nextLocale: string) => {
    const isSupported = (supportedLocales as readonly string[]).includes(nextLocale);
    if (!isSupported) return;
    if (nextLocale === currentLang) return;

    const queryString = searchParams.toString();
    const nextPath = `/${nextLocale}${normalizedPathname === "/" ? "" : normalizedPathname}${queryString ? `?${queryString}` : ""}`;

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
      <header className="app-navbar-surface sticky top-0 z-50 w-full overflow-x-clip bg-pink-50/70 backdrop-blur-md dark:bg-[#252628]">
        <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14">
          <div className="flex h-16 min-w-0 items-center justify-between gap-2">

            {/* LOGO & MENU CHÍNH (Desktop) */}
            <div className="flex min-w-0 flex-shrink items-center gap-2 lg:gap-8">
              <Link href={sectionLandingHref} className="flex min-w-0 flex-shrink-0 items-center gap-2 text-2xl font-bold">
                <span className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-pink-700 text-white text-xl shadow-md">
                  N
                </span>
                <span className="hidden sm:inline truncate flex-shrink text-pink-600 dark:text-pink-400">Netviet Audio</span>
              </Link>


              {/* Menu Desktop (Responsive: text on 2xl+, icons on xl and below) */}
              <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                {isMusicRoute ? (
                  <>
                    <Link href="/music" className={navItemClassName("/music")} aria-label={musicMenuLabels.home} title={musicMenuLabels.home}>
                      <Music2 className="w-5 h-5 2xl:hidden" />
                      <span className={`hidden 2xl:inline ${navLabelClassName("/music")}`}>{musicMenuLabels.home}</span>
                    </Link>
                    <Link href="/music?tag=us%20uk" className={musicTagClassName("us uk")} aria-label={musicMenuLabels.usUk} title={musicMenuLabels.usUk}>
                      <span className="text-xs font-semibold 2xl:text-sm">{musicMenuLabels.usUk}</span>
                    </Link>
                    <Link href="/music?tag=kpop" className={musicTagClassName("kpop")} aria-label={musicMenuLabels.kpop} title={musicMenuLabels.kpop}>
                      <span className="text-xs font-semibold 2xl:text-sm">{musicMenuLabels.kpop}</span>
                    </Link>
                    <Link href="/music?tag=vpop" className={musicTagClassName("vpop")} aria-label={musicMenuLabels.vpop} title={musicMenuLabels.vpop}>
                      <span className="text-xs font-semibold 2xl:text-sm">{musicMenuLabels.vpop}</span>
                    </Link>
                    <Link href="/music?tag=hiphop" className={musicTagClassName("hiphop")} aria-label={musicMenuLabels.hiphop} title={musicMenuLabels.hiphop}>
                      <span className="text-xs font-semibold 2xl:text-sm">{musicMenuLabels.hiphop}</span>
                    </Link>
                    <Link href="/music#music-trending" className={neutralNavItemClassName} aria-label={musicMenuLabels.trending} title={musicMenuLabels.trending}>
                      <Flame className="w-5 h-5 2xl:hidden" />
                      <span className="hidden 2xl:inline">{musicMenuLabels.trending}</span>
                    </Link>
                    <Link href="/music#music-latest" className={neutralNavItemClassName} aria-label={musicMenuLabels.latest} title={musicMenuLabels.latest}>
                      <Zap className="w-5 h-5 2xl:hidden" />
                      <span className="hidden 2xl:inline">{musicMenuLabels.latest}</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/story" className={navItemClassName("/story")} aria-label={t("home")} title={t("home")}>
                      <Home className="w-5 h-5 2xl:hidden" />
                      <span className={`hidden 2xl:inline ${navLabelClassName("/story")}`}>{t("home")}</span>
                    </Link>
                    <div
                      ref={categoryMenuRef}
                      className="relative"
                    >
                      <button
                        onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                        className={navItemClassName("/story/stories")}
                        aria-label={t("categories")}
                        title={t("categories")}
                      >
                        <LayoutGrid className="w-5 h-5 2xl:hidden" />
                        <span className={`hidden 2xl:inline ${navLabelClassName("/story/stories")}`}>{t("categories")}</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {isCategoryOpen && (
                        <div className="absolute top-full left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 mt-1">
                          {topCategories.map((item) => (
                            <Link
                              key={item.id}
                              href={`/story/categories/${item.slug}`}
                              onClick={() => setIsCategoryOpen(false)}
                              className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {item.name}
                            </Link>
                          ))}
                          <Link
                            href="/story/stories"
                            onClick={() => setIsCategoryOpen(false)}
                            className="block px-4 py-2 text-pink-600 dark:text-pink-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("viewAll")} &rarr;
                          </Link>
                        </div>
                      )}
                    </div>
                    <Link href="/story/new" className={navItemClassName("/story/new")} aria-label={t("new")} title={t("new")}>
                      <Zap className="w-5 h-5 2xl:hidden" />
                      <span className={`hidden 2xl:inline ${navLabelClassName("/story/new")}`}>{t("new")}</span>
                    </Link>
                    <Link href="/story/trending" className={navItemClassName("/story/trending")} aria-label={t("trending")} title={t("trending")}>
                      <Flame className="w-5 h-5 2xl:hidden" />
                      <span className={`hidden 2xl:inline ${navLabelClassName("/story/trending")}`}>{t("trending")}</span>
                    </Link>
                    <Link href="/story/interactive" className={navItemClassName("/story/interactive")} aria-label={t("interactiveStories")} title={t("interactiveStories")}>
                      <Sparkles className="w-5 h-5 2xl:hidden" />
                      <span className={`hidden 2xl:inline ${navLabelClassName("/story/interactive")}`}>{t("interactiveStories")}</span>
                    </Link>
                    <div
                      ref={rankingMenuRef}
                      className="relative"
                    >
                      <button
                        onClick={() => setIsRankingOpen(!isRankingOpen)}
                        className={navItemClassName("/story/ranking")}
                        aria-label={t("ranking")}
                        title={currentLang === "vi" ? "BXH" : "Ranking"}
                      >
                        <Trophy className="w-5 h-5 2xl:hidden" />
                        <span className={`hidden 2xl:inline ${navLabelClassName("/story/ranking")}`}>{currentLang === "vi" ? "BXH" : "Ranking"}</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {isRankingOpen && (
                        <div className="absolute top-full left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 mt-1">
                          <Link
                            href="/story/ranking"
                            onClick={() => setIsRankingOpen(false)}
                            className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("ranking")}
                          </Link>
                          <Link
                            href="/story/vinh-danh"
                            onClick={() => setIsRankingOpen(false)}
                            className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("memberRanking")}
                          </Link>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </nav>
            </div>

            {/* RIGHT SECTION */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
              <Link
                href={switchSectionHref}
                className="hidden lg:inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md"
                aria-label={switchSectionLabel}
                title={switchSectionLabel}
              >
                <span className="whitespace-nowrap">{switchSectionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              {/* Mobile Search Bar - Always visible inline on top row */}
              <div className="relative w-40 shrink-0 sm:w-56 lg:hidden" ref={mobileSearchRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder={resolvedSearchPlaceholder}
                  className="w-full rounded-full border-transparent bg-gray-100 py-1.5 pl-8 pr-2 text-xs outline-none transition-all focus:border-pink-500 focus:bg-white dark:bg-[#3a3b3c] dark:focus:bg-[#242526]"
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />

                {showSearchDropdown && searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white py-2 shadow-2xl z-[100] dark:border-[#303133] dark:bg-[#242526]">
                    {isSearching ? (
                      <div className="px-4 py-8 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-pink-600 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Đang tìm kiếm...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              handleSearchResultClick(item);
                              closeMobileMenu();
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#3a3b3c] transition-colors text-left"
                          >
                            <img
                              src={item.thumbnailUrl || "/thumbnaildefault.jpg"}
                              alt={item.title}
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                                {getSearchResultTitle(item)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                {getSearchResultSubtitle(item)}
                              </p>
                            </div>
                          </button>
                        ))}
                        <Link
                          href={getViewAllSearchHref()}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setSearchQuery("");
                            closeMobileMenu();
                          }}
                          className="block px-4 py-3 text-center text-sm text-pink-600 dark:text-pink-400 font-semibold hover:bg-gray-50 dark:hover:bg-[#3a3b3c] border-t border-gray-100 dark:border-[#303133] transition-colors"
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

              {/* Desktop Search Bar - Only visible on 2xl+ */}
              <div className="relative mx-2 hidden 2xl:flex flex-grow max-w-lg xl:max-w-xl" ref={searchRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder={resolvedSearchPlaceholder}
                  className="w-full pl-9 pr-4 py-2 rounded-full bg-gray-100 dark:bg-[#3a3b3c] border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-pink-500 text-sm outline-none transition-all"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

                {/* Search Results Dropdown */}
                {showSearchDropdown && searchQuery.trim() && (
                  <div className="absolute top-full left-0 mt-2 w-full max-w-[90vw] md:min-w-[320px] lg:min-w-[400px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-2 z-[100] max-h-[500px] overflow-y-auto">
                    {isSearching ? (
                      <div className="px-4 py-8 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-pink-600 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Đang tìm kiếm...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSearchResultClick(item)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <img
                              src={item.thumbnailUrl || "/thumbnaildefault.jpg"}
                              alt={item.title}
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                                {getSearchResultTitle(item)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                {getSearchResultSubtitle(item)}
                              </p>
                            </div>
                          </button>
                        ))}
                        <Link
                          href={getViewAllSearchHref()}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setSearchQuery("");
                          }}
                          className="block px-4 py-3 text-center text-sm text-pink-600 dark:text-pink-400 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 transition-colors"
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
                className="app-button-surface hidden xl:flex flex-shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              >
                {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="relative flex-shrink-0" ref={langMenuRef}>
                <button
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1.5 dark:border-[#303133] dark:bg-[#242526] hover:bg-gray-50 dark:hover:bg-[#3a3b3c] transition-colors xl:hidden"
                  aria-label={t("language")}
                >
                  <LanguageFlagIcon
                    countryCode={localeToCountryCode(currentLang)}
                    title={currentLanguageLabel}
                    className="h-4 w-5"
                  />
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                </button>
                <button 
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="hidden items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 dark:border-[#303133] dark:bg-[#242526] hover:bg-gray-50 dark:hover:bg-[#3a3b3c] transition-colors xl:flex"
                >
                  <LanguageFlagIcon
                    countryCode={localeToCountryCode(currentLang)}
                    title={currentLanguageLabel}
                    className="h-4 w-5"
                  />
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>

                {isLangOpen && (
                  <div className="absolute top-full right-0 mt-1 w-40 xl:w-44 bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#303133] rounded-lg shadow-lg py-1 z-50">
                    {availableLanguages.map((language) => {
                      const supported = (supportedLocales as readonly string[]).includes(language.key);
                      return (
                        <button
                          key={language.key}
                          onClick={() => {
                            if (!supported) return;
                            switchLocale(language.key);
                            setIsLangOpen(false);
                          }}
                          title={supported ? language.name : `${language.name} (chua ho tro giao dien)`}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            !supported
                              ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                              : currentLang === language.key
                                ? "text-pink-600 dark:text-pink-400 font-semibold"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3a3b3c]"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <LanguageFlagIcon
                              countryCode={localeToCountryCode(language.key)}
                              title={language.name}
                              className="h-4 w-5"
                            />
                            <span className="truncate">{language.name}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
                <button 
                  onClick={() => {
                    if (!user) {
                      openLogin();
                    } else {
                      router.push(`/${currentLang}/topup`);
                    }
                  }}
                  className="hidden xl:flex items-center gap-1.5 whitespace-nowrap bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 md:px-3 py-1.5 rounded-full text-sm font-medium hover:bg-amber-200 transition-colors"
                >
                  <Coins className="h-4 w-4" /> <span className="hidden xl:inline">{topUpButtonLabel}</span>
                </button>

                {/* Chuông thông báo */}
                <div className="relative hidden 2xl:flex flex-shrink-0" ref={notifMenuRef}>
                  <button
                    onClick={() => {
                      setIsNotifOpen(!isNotifOpen);
                      setIsUserMenuOpen(false); // Đóng menu user nếu đang mở
                    }}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#3a3b3c] text-gray-600 dark:text-gray-300 relative"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadNotifs > 0 && (
                      <span className="absolute top-1 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                    )}
                  </button>

                  {/* Dropdown Thông báo */}
                  {isNotifOpen && (
                    <div className="fixed top-16 inset-x-2 mt-0 w-auto sm:absolute sm:top-auto sm:inset-x-auto sm:right-0 sm:mt-2 sm:w-80 bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#303133] rounded-[10px] shadow-2xl py-2 z-50 max-h-[70vh] sm:max-h-[500px] overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#303133] flex items-center justify-between">
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
                            className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#3a3b3c] border-b border-gray-100 dark:border-[#303133] last:border-b-0 transition-colors relative ${item.isRead
                                ? "bg-white dark:bg-[#242526]"
                                : "bg-pink-50 dark:bg-pink-900/20"
                              }`}
                          >
                            {!item.isRead && (
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-pink-500 rounded-full"></span>
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
                            <Bell className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t("emptyNotifications")}</p>
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/${locale}/notifications`}
                        className="block px-4 py-3 text-center text-sm text-pink-600 dark:text-pink-400 font-semibold hover:bg-gray-50 dark:hover:bg-[#3a3b3c] border-t border-gray-100 dark:border-[#303133] transition-colors rounded-b-[10px]"
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
                      className="hidden lg:flex items-center p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label={t("favorites")}
                    >
                      <Heart className="w-5 h-5" />
                    </Link>

                    <Link
                      href="/profile/history"
                      className="hidden lg:flex items-center p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label={t("listeningHistory")}
                    >
                      <History className="w-5 h-5" />
                    </Link>
                  </>
                ) : null}

                {/* Avatar Desktoop Only */}
                {!user ? (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button 
                      onClick={openLogin}
                      className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-pink-500 to-pink-700 text-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-xs sm:text-sm font-semibold"
                    >
                      {t("login")}
                    </button>
                  </div>
                ) : (<div className="relative flex-shrink-0" ref={userMenuRef}>
                  <button
                    onClick={
                      () => {
                        const isDesktopViewport = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
                        if (isDesktopViewport) {
                          setIsUserMenuOpen(!isUserMenuOpen);
                          setIsNotifOpen(false); // Đóng thông báo nếu đang mở
                        } else {
                          setIsMobileMenuOpen(true);
                        }
                      }
                    }
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Image
                      src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.email}`}
                      alt="Avatar"
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full bg-gray-200 object-cover"
                      unoptimized
                    />
                  </button>

                  {/* Dropdown User */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#242526] border border-gray-200 dark:border-[#303133] rounded-lg shadow-xl py-1 z-50">
                      <p className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{t("hello", { name: user.name || user.email })}</p>
                      <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#3a3b3c]">
                        <UserCircle className="h-4 w-4" /> {t("profile")}
                      </Link>
                      <div className="border-t border-gray-100 dark:border-[#303133] my-1"></div>
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
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
            onClick={closeMobileMenu}
          ></div>

          {/* Side Sheet - Redesigned for better mobile UX */}
            <div className="fixed inset-y-0 right-0 z-[70] w-[280px] bg-white dark:bg-[#242526] shadow-2xl flex flex-col lg:hidden animate-in slide-in-from-right duration-300">
            
            {/* Header with Close Button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center text-white text-lg font-bold">N</div>
                <span className="font-bold text-gray-900 dark:text-white">Menu</span>
              </div>
                <button
                onClick={closeMobileMenu}
                  className="app-button-surface p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={t("closeMenu")}
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* User Info Section */}
            {user ? (
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <Image
                    src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.email}`}
                    alt="Avatar"
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full border-2 border-pink-500 object-cover"
                    unoptimized
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{user.name || user.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <button 
                  onClick={() => {
                    openLogin();
                    closeMobileMenu();
                  }}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-pink-700 text-white font-semibold text-sm shadow-md active:scale-[0.98] transition-all"
                >
                  {t("login")}
                </button>
              </div>
            )}

            {/* Menu Items - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <nav className="p-3 space-y-1">
                <Link
                  href={switchSectionHref}
                  onClick={closeMobileMenu}
                  className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm"
                >
                  <span>{switchSectionLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {/* Main Navigation */}
                {isMusicRoute ? (
                  <>
                    <Link
                      href="/music"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isRouteActive("/music") && !activeMusicTag ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Music2 className={`w-5 h-5 ${isRouteActive("/music") && !activeMusicTag ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{musicMenuLabels.home}</span>
                    </Link>

                    <Link
                      href="/music?tag=us%20uk"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeMusicTag === "us uk" ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Music2 className={`w-5 h-5 ${activeMusicTag === "us uk" ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{musicMenuLabels.usUk}</span>
                    </Link>

                    <Link
                      href="/music?tag=kpop"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeMusicTag === "kpop" ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Music2 className={`w-5 h-5 ${activeMusicTag === "kpop" ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{musicMenuLabels.kpop}</span>
                    </Link>

                    <Link
                      href="/music?tag=vpop"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeMusicTag === "vpop" ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Music2 className={`w-5 h-5 ${activeMusicTag === "vpop" ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{musicMenuLabels.vpop}</span>
                    </Link>

                    <Link
                      href="/music?tag=hiphop"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeMusicTag === "hiphop" ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Music2 className={`w-5 h-5 ${activeMusicTag === "hiphop" ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{musicMenuLabels.hiphop}</span>
                    </Link>

                    <Link
                      href="/music#music-trending"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Flame className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{musicMenuLabels.trending}</span>
                    </Link>

                    <Link
                      href="/music#music-latest"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Zap className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{musicMenuLabels.latest}</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/story"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isRouteActive("/story") ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Home className={`w-5 h-5 ${isRouteActive("/story") ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{t("home")}</span>
                    </Link>

                    <Link
                      href="/story/stories"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isRouteActive("/story/stories") ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <LayoutGrid className={`w-5 h-5 ${isRouteActive("/story/stories") ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{t("categories")}</span>
                    </Link>

                    <Link
                      href="/story/new"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isRouteActive("/story/new") ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Zap className={`w-5 h-5 ${isRouteActive("/story/new") ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{t("new")}</span>
                    </Link>

                    <Link
                      href="/story/trending"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isRouteActive("/story/trending") ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Flame className={`w-5 h-5 ${isRouteActive("/story/trending") ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{t("trending")}</span>
                    </Link>

                    <Link
                      href="/story/interactive"
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isRouteActive("/story/interactive") ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <Sparkles className={`w-5 h-5 ${isRouteActive("/story/interactive") ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className="text-sm font-medium">{t("interactiveStories")}</span>
                    </Link>

                    {/* BXH Collapsible */}
                    <div>
                      <button
                        onClick={() => setIsRankingOpen(!isRankingOpen)}
                        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-colors ${isRouteActive("/story/ranking") ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                      >
                        <div className="flex items-center gap-3">
                          <Trophy className={`w-5 h-5 ${isRouteActive("/story/ranking") ? "text-pink-600 dark:text-pink-400" : "text-gray-500 dark:text-gray-400"}`} />
                          <span className="text-sm font-medium">BXH</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isRankingOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isRankingOpen && (
                        <div className="ml-8 mt-1 space-y-1">
                          <Link
                            href="/story/ranking"
                            onClick={closeMobileMenu}
                            className="block px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            {t("ranking")}
                          </Link>
                          <Link
                            href="/story/vinh-danh"
                            onClick={closeMobileMenu}
                            className="block px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            {t("memberRanking")}
                          </Link>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Divider */}
                {user && <div className="my-2 border-t border-gray-200 dark:border-gray-800"></div>}

                {/* User Menu Items */}
                {user && (
                  <>
                    <Link 
                      href="/notifications" 
                      onClick={closeMobileMenu} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{t("notifications")}</span>
                      {unreadNotifs > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {unreadNotifs}
                        </span>
                      )}
                    </Link>

                    <Link 
                      href="/profile/favorites" 
                      onClick={closeMobileMenu} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Heart className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{t("favorites")}</span>
                    </Link>

                    <Link 
                      href="/profile/history" 
                      onClick={closeMobileMenu} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{t("listeningHistory")}</span>
                    </Link>

                    <button 
                      onClick={() => {
                        if (!user) {
                          openLogin();
                          closeMobileMenu();
                        } else {
                          router.push(`/${currentLang}/topup`);
                          closeMobileMenu();
                        }
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors w-full text-left"
                    >
                      <Coins className="w-5 h-5" />
                      <span className="text-sm font-semibold">{topUpButtonLabel}</span>
                    </button>

                    <Link 
                      href="/profile" 
                      onClick={closeMobileMenu} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <UserCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{t("profile")}</span>
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {/* Footer Settings */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
              {/* Theme Toggle */}
              <div className="w-full">
                <div className="relative grid w-full grid-cols-2 rounded-full bg-zinc-200/90 p-1 dark:bg-zinc-800/90">
                  <div
                    className={`pointer-events-none absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white/95 shadow-sm transition-transform duration-300 ease-in-out dark:bg-zinc-950/95 ${
                      isDarkTheme ? "translate-x-[calc(100%+0.25rem)]" : "translate-x-0"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                      !isDarkTheme ? "text-zinc-900" : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                      isDarkTheme ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Logout Button */}
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4" /> {t("logout")}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}