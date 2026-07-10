"use client";

import React from 'react';
import Link from '@/components/shared/LocalizedLink';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Shield, LogOut, Loader2, Newspaper, Home, Users, Settings, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, UserCircle, Music, DollarSign, MessageSquare, Crown, Package, Menu, X, Globe2, Gift, Zap, Image as ImageIcon, Megaphone, Share2, Tag, BarChart3 } from 'lucide-react';
import { ThemeProvider } from 'next-themes';

import { useState, useEffect } from 'react';
import { adminApiClient, ADMIN_ACCESS_TOKEN_KEY } from '@/lib/api/admin-api-client';
import AdminRequireLogin from '@/components/admin/AdminRequireLogin';
import useRequireAdmin from '@/hooks/useRequireAdmin';
import { useAdminStore } from '@/stores/admin-store';

export default function AdminShellLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const pathWithoutLocale = pathname?.replace(/^\/(vi|en)/, '') || '/';
    const isLoginPage = pathWithoutLocale === '/login' || pathWithoutLocale.startsWith('/login/');
    const { isAdmin, isLoading } = useRequireAdmin(!isLoginPage);

    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
            router.push(`/${locale}/login`);
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
            const locale = pathname?.split('/')[1] || 'vi';
            router.push(`/${locale}/login`);
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

    type NavLeaf = { href: string; label: string; icon: typeof Home };
    type NavGroup = { label: string; icon: typeof Home; children: NavLeaf[] };
    type NavEntry = NavLeaf | NavGroup;

    const navItems: NavEntry[] = [
        { href: '/', label: 'Dashboard', icon: Home },
        { href: '/users', label: 'Quản lý Người dùng', icon: Users },
        { href: '/stories', label: 'Quản lý Truyện', icon: Newspaper },
        { href: '/music', label: 'Quản lý Nhạc', icon: Music },
        { href: '/banners', label: 'Quản lý Banner Hero', icon: ImageIcon },
        { href: '/ads', label: 'Quảng cáo Inline', icon: Megaphone },
        { href: '/ads/unlock', label: 'Quảng cáo mở khóa', icon: Megaphone },
        { href: '/social-links', label: 'Quản lý Link Cộng đồng', icon: Share2 },
        { href: '/interactive-stories', label: 'Truyện Tương Tác', icon: Zap },

        { href: '/categories', label: 'Quản lý Danh mục', icon: LayoutGrid },
        { href: '/labels', label: 'Quản lý Label', icon: Tag },
        { href: '/authors', label: 'Quản lý Tác giả', icon: UserCircle },
        { href: '/memberships', label: 'Quản lý Hội viên', icon: Crown },
        { href: '/packages', label: 'Quản lý Gói thanh toán', icon: Package },
        { href: '/languages', label: 'Quản lý Ngôn ngữ', icon: Globe2 },
        { href: '/comments', label: 'Quản lý Bình luận', icon: MessageSquare },
        { href: '/comment-reports', label: 'Báo cáo Bình luận', icon: Bell },
        { href: '/gifts', label: 'Lịch sử Tặng quà', icon: Gift },
        { href: '/transactions', label: 'Quản lý Giao dịch', icon: DollarSign },
        { href: '/vip-stories', label: 'Thống kê Truyện VIP', icon: Crown },
        {
            label: 'Bảng xếp hạng',
            icon: BarChart3,
            children: [
                { href: '/rankings/top-stories', label: 'Top Truyện', icon: Newspaper },
                { href: '/rankings/top-countries', label: 'Top Quốc gia', icon: Globe2 },
                { href: '/rankings/by-country', label: 'Xếp hạng theo quốc gia', icon: Globe2 },
            ],
        },
        { href: '/settings', label: 'Cài đặt', icon: Settings },
    ];

    const allLeafHrefs = navItems.flatMap((item) =>
        'children' in item ? item.children.map((child) => child.href) : [item.href],
    );

    const hrefMatchesPath = (href: string) => {
        const normalized = href === '/' ? '/' : href;
        return pathWithoutLocale === normalized || (normalized !== '/' && pathWithoutLocale.startsWith(`${normalized}/`));
    };
    // An item is active only if it matches AND no more-specific sibling (longer href) also matches.
    // Prevents a parent like /ads from lighting up while on a child route /ads/unlock.
    const isNavItemActive = (href: string) =>
        hrefMatchesPath(href) &&
        !allLeafHrefs.some((other) => other !== href && other.length > href.length && hrefMatchesPath(other));

    const isGroupActive = (group: NavGroup) => group.children.some((child) => isNavItemActive(child.href));
    const isGroupOpen = (group: NavGroup) => openGroups[group.label] ?? isGroupActive(group);

    const renderLeaf = (item: NavLeaf, collapsed: boolean, onNavigate?: () => void, nested = false) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(item.href);
        return (
            <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : ''}
                className={`relative flex items-center overflow-hidden rounded-2xl font-medium transition-all group ${collapsed ? 'justify-center p-3' : `gap-3 px-4 py-3 ${nested ? 'pl-11' : ''}`} ${isActive
                    ? 'bg-[#ffddef] text-pink-700 shadow-sm'
                    : 'text-slate-600 hover:bg-gray-50 hover:text-slate-900'
                    }`}
            >
                <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-pink-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {!collapsed && <span className="whitespace-nowrap opacity-100 transition-opacity duration-300">{item.label}</span>}
            </Link>
        );
    };

    const renderNavEntries = (collapsed: boolean, onNavigate?: () => void) =>
        navItems.map((item) => {
            if (!('children' in item)) {
                return renderLeaf(item, collapsed, onNavigate);
            }

            // Collapsed rail: flatten children to icon-only links (accordion makes no sense at w-20)
            if (collapsed) {
                return (
                    <div key={item.label} className="space-y-1.5">
                        {item.children.map((child) => renderLeaf(child, true, onNavigate))}
                    </div>
                );
            }

            const GroupIcon = item.icon;
            const groupActive = isGroupActive(item);
            const open = isGroupOpen(item);
            return (
                <div key={item.label}>
                    <button
                        type="button"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !open }))}
                        className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 font-medium transition-all group ${groupActive ? 'text-pink-700' : 'text-slate-600 hover:bg-gray-50 hover:text-slate-900'}`}
                    >
                        <GroupIcon className={`h-5 w-5 shrink-0 transition-colors ${groupActive ? 'text-pink-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className="flex-1 whitespace-nowrap text-left">{item.label}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                        <div className="mt-1.5 space-y-1.5">
                            {item.children.map((child) => renderLeaf(child, false, onNavigate, true))}
                        </div>
                    )}
                </div>
            );
        });

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
                    {renderNavEntries(isCollapsed)}
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
                                {renderNavEntries(false, () => setIsMobileMenuOpen(false))}
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
