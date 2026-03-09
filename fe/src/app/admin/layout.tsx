"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Shield, LogOut, Loader2, Newspaper, Database, Home, Plus, Users, Settings, ChevronLeft, ChevronRight, LayoutGrid, UserCircle, Music } from 'lucide-react';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/api-client';
import { useUserStore } from '@/stores/user-store';
import { clearAuthCookies } from '@/lib/auth/cookies';

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

    useEffect(() => {
        if (pathname === '/admin/login') {
            setIsLoading(false);
            setHasAccess(true);
            return;
        }

        const checkAdminAccess = () => {
            const user = useUserStore.getState().user;
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
            router.push('/admin/login');
        }
    }, [router, pathname]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('adminLoggedIn');
                localStorage.removeItem('userEmail');
            }

            // 1. Call backend logout
            try {
                await apiClient.post('/auth/logout');
            } catch (err) {
                console.error('Backend logout failed:', err);
            }

            // 2. Clear store and cookies
            useUserStore.getState().clearAuth();
            clearAuthCookies();

            router.push('/admin/login');
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
            router.push('/admin/login');
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
    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    if (!hasAccess) {
        return null;
    }

    const navItems = [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/users', label: 'Quản lý Người dùng', icon: Users },
        { href: '/admin/stories', label: 'Quản lý Truyện', icon: Newspaper },
        { href: '/admin/chapters', label: 'Quản lý Chương', icon: Music },
        { href: '/admin/categories', label: 'Quản lý Danh mục', icon: LayoutGrid },
        { href: '/admin/authors', label: 'Quản lý Tác giả', icon: UserCircle },
        { href: '/admin/settings', label: 'Cài đặt', icon: Settings },
    ];



    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            {/* Sidebar */}
            <aside
                className={`bg-white border-r border-slate-200 flex flex-col hidden md:flex transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-72'}`}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-24 bg-white border border-slate-200 rounded-full p-1.5 hover:bg-slate-50 transition-colors shadow-sm z-10"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-600" /> : <ChevronLeft className="w-4 h-4 text-slate-600" />}
                </button>

                <div className={`h-20 flex items-center border-b border-slate-100 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'px-8'}`}>
                    <Link href="/" className="font-bold text-2xl text-indigo-600 flex items-center gap-2 overflow-hidden">
                        <Shield className="w-7 h-7 shrink-0" />
                        {!isCollapsed && <span className="whitespace-nowrap opacity-100 transition-opacity duration-300">Admin Panel</span>}
                    </Link>
                </div>

                <nav className={`flex-1 overflow-y-auto py-6 space-y-1.5 transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={isCollapsed ? item.label : ''}
                                className={`flex items-center rounded-2xl font-medium transition-all group relative overflow-hidden ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${isActive
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-600/5'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                {!isCollapsed && <span className="whitespace-nowrap opacity-100 transition-opacity duration-300">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className={`p-4 space-y-4 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-6'}`}>
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                        <div className={`flex items-center gap-3 p-4 transition-all duration-300 ${isCollapsed ? 'justify-center p-3' : ''}`}>
                            <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                                A
                            </div>
                            {!isCollapsed && (
                                <div className="overflow-hidden opacity-100 transition-opacity duration-300">
                                    <p className="text-sm font-bold text-slate-800 truncate">Admin</p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Quản trị viên</p>
                                </div>
                            )}
                        </div>

                        <div className={`px-4 pb-4 space-y-3 transition-all duration-300 ${isCollapsed ? 'px-2 pb-3' : ''}`}>
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                title={isCollapsed ? 'Đăng xuất' : ''}
                                className={`w-full flex items-center justify-center text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 ${isCollapsed ? 'p-2' : 'gap-2 px-4 py-2.5'}`}
                            >
                                {isLoggingOut ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <LogOut className="w-4 h-4 shrink-0" />
                                        {!isCollapsed && <span>Đăng xuất</span>}
                                    </>
                                )}
                            </button>

                            <div className="h-px bg-slate-200 w-full"></div>

                            <Link
                                href="/"
                                title={isCollapsed ? 'Về trang chủ' : ''}
                                className={`w-full flex items-center justify-center text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all active:scale-[0.98] ${isCollapsed ? 'p-2' : 'gap-2 px-4 py-2.5'}`}
                            >
                                <Home className="w-4 h-4 shrink-0" />
                                {!isCollapsed && <span>Về trang chủ</span>}
                            </Link>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-y-auto w-full transition-all duration-300">
                {/* Mobile Header */}
                <div className="md:hidden h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6">
                    <span className="font-bold text-xl text-indigo-600 flex items-center gap-2">
                        <Shield className="w-6 h-6" />
                        Admin
                    </span>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-red-600 bg-red-50 rounded-xl"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 md:p-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
