"use client";

import React from 'react';
import Link from '@/components/shared/LocalizedLink';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Shield, LogOut, Loader2, Newspaper, Database, Home, Plus, Users, Settings, ChevronLeft, ChevronRight, LayoutGrid, UserCircle, Music, DollarSign, MessageSquare, Crown, Package, Menu, X, Globe2, Gift, Zap, Image as ImageIcon, Megaphone } from 'lucide-react';

import { useState, useEffect } from 'react';
import { adminApiClient, ADMIN_ACCESS_TOKEN_KEY, ADMIN_REFRESH_TOKEN_KEY } from '@/lib/api/admin-api-client';
import { useAdminStore } from '@/stores/admin-store';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Check if current path is login page (with or without locale)
        const isLoginPage = pathname?.includes('/admin/login');

        if (isLoginPage) {
            setIsLoading(false);
            setHasAccess(true);
            return;
        }

        const checkAdminAccess = () => {
            const user = useAdminStore.getState().user;
            const hasAdminRole = !!(user?.roles?.includes('ADMIN') || user?.roles?.includes('admin'));

            if (typeof window !== 'undefined') {
                const adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
                return adminLoggedIn && hasAdminRole;
            }
            return hasAdminRole;
        };

        const access = checkAdminAccess();
        setHasAccess(access);
        setIsLoading(false);

        if (!access) {
            // Extract locale from pathname (e.g., /vi/admin or /en/admin)
            const locale = pathname?.split('/')[1] || 'vi';
            router.push(`/${locale}/admin/login`);
        }
    }, [router, pathname]);

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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Skip layout for login page
    const isLoginPage = pathname?.includes('/admin/login');
    if (isLoginPage) {
        return <>{children}</>;
    }

    if (!hasAccess) {
        return null;
    }

    const navItems = [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/users', label: 'Quản lý Người dùng', icon: Users },
        { href: '/admin/stories', label: 'Quản lý Truyện', icon: Newspaper },
        { href: '/admin/banners', label: 'Quản lý Banner Hero', icon: ImageIcon },
        { href: '/admin/ads', label: 'Quản lý Quảng cáo', icon: Megaphone },
        { href: '/admin/interactive-stories', label: 'Truyện Tương Tác', icon: Zap },
        { href: '/admin/chapters', label: 'Quản lý Chương', icon: Music },
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
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
            {/* Sidebar */}
            <aside
                className={`bg-white dark:bg-slate-900 flex flex-col hidden md:flex transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-72'}`}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-24 bg-white dark:bg-slate-800 rounded-full p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm z-10"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-600" /> : <ChevronLeft className="w-4 h-4 text-slate-600" />}
                </button>

                <div className={`h-20 flex items-center transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'px-8'}`}>
                    <Link href="/" className="font-bold text-2xl text-indigo-600 flex items-center gap-2 overflow-hidden">
                        <Shield className="w-7 h-7 shrink-0" />
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
                                className={`flex items-center rounded-2xl font-medium transition-all group relative overflow-hidden ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${isActive
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-600/5 dark:bg-indigo-950/50 dark:text-indigo-300'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                                {!isCollapsed && <span className="whitespace-nowrap opacity-100 transition-opacity duration-300">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className={`p-4 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-6'}`}>
                    <div>
                        <div className={`px-4 flex gap-3 transition-all duration-300 ${isCollapsed ? 'px-2 pb-3' : ''}`}>
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                title={isCollapsed ? 'Đăng xuất' : ''}
                                className={`w-full flex items-center justify-center text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 ${isCollapsed ? 'p-2' : 'gap-2 px-4 py-2.5'}`}
                            >
                                {isLoggingOut ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <LogOut className="w-4 h-4 shrink-0" />
                                        {!isCollapsed}
                                    </>
                                )}
                            </button>

                            <Link
                                href="/"
                                title={isCollapsed ? 'Về trang chủ' : ''}
                                className={`w-full flex items-center justify-center text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all active:scale-[0.98] ${isCollapsed ? 'p-2' : 'gap-2 px-4 py-2.5'}`}
                            >
                                <Home className="w-4 h-4 shrink-0" />
                                {!isCollapsed}
                            </Link>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-y-auto w-full transition-all duration-300">
                {/* Mobile Header */}
                <div className="md:hidden h-20 bg-white dark:bg-slate-900 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <span className="font-bold text-xl text-indigo-600 flex items-center gap-2">
                            <Shield className="w-6 h-6" />
                            Admin
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-red-600 bg-red-50 rounded-xl"
                    >
                        <LogOut className="w-5 h-5" />
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
                        <aside className="absolute inset-y-0 left-0 w-[80%] max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 dark:bg-slate-900">
                            <div className="h-20 flex items-center justify-between px-6">
                                <span className="font-bold text-xl text-indigo-600 flex items-center gap-2">
                                    <Shield className="w-6 h-6" />
                                    Admin Panel
                                </span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
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
                                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all group relative overflow-hidden ${isActive
                                                ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-600/5 dark:bg-indigo-950/50 dark:text-indigo-300'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                                                }`}
                                        >
                                            <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                                            <span className="whitespace-nowrap">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="p-6 space-y-4">
                                <div className="rounded-2xl p-4">
                                    <div className="gap-3 flex">
                                        <button
                                            onClick={handleLogout}
                                            disabled={isLoggingOut}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {isLoggingOut ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <LogOut className="w-4 h-4" />
                                                </>
                                            )}
                                        </button>   
                                        <Link
                                            href="/"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <Home className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}

                <div className="p-6 md:p-8 xl:p-10">
                    <div className="mx-auto w-full max-w-[1920px]">{children}</div>
                </div>
            </main>
        </div>
    );
}
