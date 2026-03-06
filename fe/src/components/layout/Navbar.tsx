"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { 
  Search, Moon, Sun, Bell, User, 
  ChevronDown, LogOut, Coins, Menu, X, Settings
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function Navbar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  // State cho Mobile/Tablet Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuthStore();
  const unreadNotifs = 3;

  useEffect(() => setMounted(true), []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/search?keyword=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
      setIsMobileMenuOpen(false); // Đóng menu nếu đang mở trên mobile
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14">
          <div className="flex items-center justify-between h-16">
            
            {/* LOGO & MENU CHÍNH (Desktop) */}
            <div className="flex items-center gap-8">
              <Link href="/" className="text-2xl font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                AudioTruyen
              </Link>
              
              {/* Menu Desktop (Ẩn khi màn hình nhỏ hơn lg) */}
              <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                <Link href="/" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">Trang chủ</Link>
                <div 
                  className="relative"
                  onMouseEnter={() => setIsCategoryOpen(true)}
                  onMouseLeave={() => setIsCategoryOpen(false)}
                >
                  <button className="flex items-center px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
                    Thể loại <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  {isCategoryOpen && (
                    <div className="absolute top-full left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 mt-1">
                      <Link href="/categories/tien-hiep" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Tiên Hiệp</Link>
                      <Link href="/categories" className="block px-4 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">Xem tất cả &rarr;</Link>
                    </div>
                  )}
                </div>
                <Link href="/new" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">Mới đăng</Link>
                <Link href="/trending" className="px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">Trending</Link>
              </nav>
            </div>

            {/* RIGHT SECTION */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  placeholder="Tìm truyện..." 
                  className="w-44 lg:w-56 xl:w-64 pl-9 pr-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 text-sm outline-none"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>

              <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              >
                {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="flex items-center gap-1 sm:gap-3">
                <Link href="/topup" className="hidden sm:flex items-center gap-1.5 whitespace-nowrap bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-amber-200 transition-colors">
                  <Coins className="h-4 w-4" /> <span>Nạp tiền</span>
                </Link>

                {/* Chuông thông báo */}
                <div className="relative">
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
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 font-medium">Thông báo mới</div>
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        Chương mới: <b>Phàm Nhân Tu Tiên</b> tập 124 đã có audio!
                      </div>
                      <Link href="/notifications" className="block px-4 py-2 text-center text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Xem tất cả</Link>
                    </div>
                  )}
                </div>

                {!mounted ? null : !isAuthenticated ? (
                  <div className="hidden sm:flex items-center gap-2">
                    <Link
                      href="/login"
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Đăng nhập
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Đăng ký
                    </Link>
                  </div>
                ) : (
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setIsUserMenuOpen(!isUserMenuOpen);
                        setIsNotifOpen(false);
                      }}
                      className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                        {(user?.name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                      </div>
                      <span className="hidden sm:block max-w-[140px] truncate text-sm text-gray-700 dark:text-gray-200">
                        {user?.name || user?.email}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>

                    {isUserMenuOpen && (
                      <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                        <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                          <User className="h-4 w-4" /> Trang cá nhân
                        </Link>
                        <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                          <Settings className="h-4 w-4" /> Cài đặt
                        </Link>
                        <button
                          onClick={logout}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <LogOut className="h-4 w-4" /> Đăng xuất
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Nút Hamburger cho Tablet (Hiển thị bên phải Avatar khi màn hình < lg và > md) */}
                <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="hidden md:block lg:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 ml-1"
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
        <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-950 flex flex-col pt-20 px-6 lg:hidden animate-in slide-in-from-bottom-5">
          
          {/* NÚT TẮT (CLOSE) DÀNH CHO OVERLAY */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            // Thêm "hidden md:flex" vào dòng class dưới đây:
            className="hidden md:flex absolute top-5 right-5 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          {/* Kết thúc phần thêm mới */}

          <div className="relative mb-6">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Nhập tên truyện rồi ấn Enter..." 
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-900 text-lg outline-none"
            />
            <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
          </div>
          
          <nav className="flex flex-col space-y-4 text-xl font-medium text-gray-800 dark:text-gray-200">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>Trang chủ</Link>
            <Link href="/categories" onClick={() => setIsMobileMenuOpen(false)}>Thể loại</Link>
            <Link href="/new" onClick={() => setIsMobileMenuOpen(false)}>Mới đăng</Link>
            <Link href="/trending" onClick={() => setIsMobileMenuOpen(false)}>Thịnh hành</Link>
            <Link href="/topup" className="text-amber-600 dark:text-amber-500" onClick={() => setIsMobileMenuOpen(false)}>Nạp Credits</Link>
          </nav>
        </div>
      )}

      {/* NÚT TRÔI NỔI (FAB) CHO MOBILE (Chỉ hiện khi < md) */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed bottom-6 right-6 z-[70] p-4 rounded-full bg-blue-600 text-white shadow-2xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
    </>
  );
}