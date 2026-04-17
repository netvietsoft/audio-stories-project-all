"use client";

import React from 'react';
import Link from '@/components/shared/LocalizedLink';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Shield, LogOut, Loader2, Newspaper, Home, Users, Settings, ChevronLeft, ChevronRight, LayoutGrid, UserCircle, Music, DollarSign, MessageSquare, Crown, Package, Menu, X, Globe2, Gift, Zap, Image as ImageIcon, Megaphone, Share2 } from 'lucide-react';
import { ThemeProvider } from 'next-themes';

import { useState, useEffect } from 'react';
import { adminApiClient, ADMIN_ACCESS_TOKEN_KEY, ADMIN_REFRESH_TOKEN_KEY } from '@/lib/api/admin-api-client';
import AdminRequireLogin from '@/components/admin/AdminRequireLogin';
import useRequireAdmin from '@/hooks/useRequireAdmin';
import { useAdminStore } from '@/stores/admin-store';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const isLoginPage = pathname?.includes('/admin/login');
    const { isAdmin, isLoading } = useRequireAdmin(!isLoginPage);

    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        document.body.classList.add('admin-shell');

        return () => {
            document.body.classList.remove('admin-shell');
        };
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('adminLoggedIn');
                localStorage.removeItem('userEmail');
                localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
                localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
            }

            // 1. Call backend logout
            try {
                await adminApiClient.post('/auth/logout');
            } catch (err) {
                console.error('Backend logout failed:', err);
            }

            // 2. Clear admin store
            useAdminStore.getState().clearAuth();

            // Extract locale from pathname
            const locale = pathname?.split('/')[1] || 'vi';
            router.push(`/${locale}/admin/login`);
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
            const locale = pathname?.split('/')[1] || 'vi';
            router.push(`/${locale}/admin/login`);
            router.refresh();
        } finally {
            setIsLoggingOut(false);
        }
    };

    // Skip layout for login page
    if (isLoginPage) {
        return <ThemeProvider forcedTheme="light" attribute="class">{children}</ThemeProvider>;
    }

    if (isLoading) {
        return (
            <ThemeProvider forcedTheme="light" attribute="class">
                <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            </ThemeProvider>
        );
    }

    if (!isAdmin) {
        return <AdminRequireLogin />;
    }

    const navItems = [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/users', label: 'Quản lý Người dùng', icon: Users },
        { href: '/admin/stories', label: 'Quản lý Truyện', icon: Newspaper },
        { href: '/admin/music', label: 'Quản lý Nhạc', icon: Music },
        { href: '/admin/banners', label: 'Quản lý Banner Hero', icon: ImageIcon },
        { href: '/admin/ads', label: 'Quản lý Quảng cáo', icon: Megaphone },
        { href: '/admin/social-links', label: 'Quản lý Link Cộng đồng', icon: Share2 },
        { href: '/admin/interactive-stories', label: 'Truyện Tương Tác', icon: Zap },

        { href: '/admin/categories', label: 'Quản lý Danh mục', icon: LayoutGrid },
        { href: '/admin/authors', label: 'Quản lý Tác giả', icon: UserCircle },
        { href: '/admin/memberships', label: 'Quản lý Hội viên', icon: Crown },
        { href: '/admin/packages', label: 'Quản lý Gói thanh toán', icon: Package },
        { href: '/admin/languages', label: 'Quản lý Ngôn ngữ', icon: Globe2 },
        { href: '/admin/comments', label: 'Quản lý Bình luận', icon: MessageSquare },
        { href: '/admin/comment-reports', label: 'Báo cáo Bình luận', icon: Bell },
        { href: '/admin/gifts', label: 'Lịch sử Tặng quà', icon: Gift },
        { href: '/admin/transactions', label: 'Quản lý Giao dịch', icon: DollarSign },
        { href: '/admin/settings', label: 'Cài đặt', icon: Settings },
    ];



    return (
        <ThemeProvider forcedTheme="light" attribute="class">
            <div className="flex h-screen bg-gray-50 text-slate-900">
            {/* Sidebar */}
            <aside
                className={`relative hidden flex-col border-r border-gray-200 bg-white/95 backdrop-blur transition-all duration-300 md:flex ${isCollapsed ? 'w-20' : 'w-72'}`}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                        className="absolute -right-3 top-24 z-10 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50"
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-600" /> : <ChevronLeft className="h-4 w-4 text-slate-600" />}
                </button>

                <div className={`h-20 flex items-center transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'px-8'}`}>
                    <Link href="/" className="flex items-center gap-2 overflow-hidden text-2xl font-bold text-pink-600">
                        <Shield className="h-7 w-7 shrink-0" />
                        {!isCollapsed && <span className="whitespace-nowrap opacity-100 transition-opacity duration-300">Admin Panel</span>}
                    </Link>
                </div>

                <nav className={`flex-1 overflow-y-auto py-6 space-y-1.5 transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        // Remove locale prefix from pathname for comparison
                        const pathWithoutLocale = pathname?.replace(/^\/(vi|en)/, '') || '';
                        const isActive = pathWithoutLocale === item.href || pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={isCollapsed ? item.label : ''}
                                className={`relative flex items-center overflow-hidden rounded-2xl font-medium transition-all group ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${isActive
                                    ? 'bg-[#ffddef] text-pink-700 shadow-sm'
                                    : 'text-slate-600 hover:bg-gray-50 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-pink-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                {!isCollapsed && <span className="whitespace-nowrap opacity-100 transition-opacity duration-300">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                            <div className={`p-4 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-6'}`}>
                    <div>
                        <div className={`flex gap-3 transition-all duration-300 ${isCollapsed ? 'flex-col px-2 pb-3' : 'px-4'}`}>
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                title="Đăng xuất"
                                            className={`flex items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-slate-700 transition-all hover:bg-gray-200 active:scale-[0.98] disabled:opacity-50 ${isCollapsed ? 'h-10 w-10 p-2' : 'h-10 w-full gap-2 px-4'}`}
                            >
                                {isLoggingOut ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <LogOut className="h-4 w-4 shrink-0" />
                                )}
                            </button>

                                    <Link
                                        href="/"
                                        title="Về trang chủ"
                                        className={`flex items-center justify-center rounded-xl bg-[#ffddef] text-sm font-bold text-pink-700 transition-all active:scale-[0.98] hover:bg-pink-100 ${isCollapsed ? 'h-10 w-10 p-2' : 'h-10 w-full gap-2 px-4'}`}
                                    >
                                        <Home className="h-4 w-4 shrink-0" />
                                    </Link>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="h-screen w-full flex-1 overflow-y-auto transition-all duration-300">
                {/* Mobile Header */}
                <div className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-6 md:hidden">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="rounded-xl p-2 text-slate-600 hover:bg-gray-50"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <span className="flex items-center gap-2 text-xl font-bold text-pink-600">
                            <Shield className="h-6 w-6" />
                            Admin
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="rounded-xl bg-gray-100 p-2 text-slate-700"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>

                {/* Mobile Menu Sheet */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-[100] md:hidden">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
                            onClick={() => setIsMobileMenuOpen(false)}
                        ></div>

                        {/* Sheet */}
                        <aside className="absolute inset-y-0 left-0 flex w-[80%] max-w-sm flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300">
                            <div className="flex h-20 items-center justify-between px-6">
                                <span className="flex items-center gap-2 text-xl font-bold text-pink-600">
                                    <Shield className="h-6 w-6" />
                                    Admin Panel
                                </span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-gray-50 hover:text-slate-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    // Remove locale prefix from pathname for comparison
                                    const pathWithoutLocale = pathname?.replace(/^\/(vi|en)/, '') || '';
                                    const isActive = pathWithoutLocale === item.href || pathname === item.href;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`relative flex items-center overflow-hidden rounded-2xl px-4 py-3 font-medium transition-all group gap-3 ${isActive
                                                    ? 'bg-[#ffddef] text-pink-700 shadow-sm'
                                                    : 'text-slate-600 hover:bg-gray-50 hover:text-slate-900'
                                                    }`}
                                        >
                                                <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-pink-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                            <span className="whitespace-nowrap">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="p-6 space-y-4">
                                <div className="rounded-2xl bg-gray-50 p-4">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleLogout}
                                            disabled={isLoggingOut}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-gray-200 active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {isLoggingOut ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <LogOut className="h-4 w-4" />
                                                </>
                                            )}
                                        </button>   
                                        <Link
                                            href="/"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffddef] px-4 py-2.5 text-sm font-bold text-pink-700 transition-all active:scale-[0.98] hover:bg-pink-100"
                                        >
                                            <Home className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}

                <div className="p-4 sm:p-6 md:p-8 xl:p-10">
                    <div className="mx-auto w-full max-w-[1920px]">{children}</div>
                </div>
            </main>
            </div>
        </ThemeProvider>
    );
}
