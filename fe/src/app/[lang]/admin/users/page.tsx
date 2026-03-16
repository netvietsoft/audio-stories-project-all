"use client";

import React, { useState, useEffect } from 'react';
import {
    Users,
    Search,
    MoreVertical,
    Mail,
    Calendar,
    Shield,
    Star,
    ChevronRight,
    ChevronDown,
    Loader2,
    Filter,
    ArrowUpDown,
    Download
} from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';

interface User {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    country: string | null;
    role: {
        name: string;
        slug: string;
    };
    credits: number;
    vipTier: number;
    vipExpirationDate: string | null;
    createdAt: string;
    lastLoginAt: string | null;
    emailVerifiedAt: string | null;
}

// Native date formatters for Vietnamese locale
const formatDateLong = (dateString: string) => {
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(date);
    } catch (e) {
        return dateString;
    }
};

const formatDateShort = (dateString: string) => {
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            hour12: false
        }).format(date);
    } catch (e) {
        return dateString;
    }
};

const UserAvatar = ({ user }: { user: User }) => {
    const [imageError, setImageError] = useState(false);
    const hasImage = user.avatarUrl && !imageError;

    return (
        <div className="w-10 h-10 rounded-xl flex-shrink-0 bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden shadow-inner border border-white">
            {hasImage ? (
                <img
                    src={user.avatarUrl!}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                (user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()
            )}
        </div>
    );
};

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/auth/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || user.role?.slug === filterRole;
        return matchesSearch && matchesRole;
    });

    const getRoleColor = (slug: string) => {
        switch (slug) {
            case 'admin':
                return 'text-amber-600';
            case 'user':
                return 'text-blue-600';
            default:
                return 'text-slate-600';
        }
    };

    const isVIP = (user: User) => {
        return (user.vipTier || 0) > 0 && (!user.vipExpirationDate || new Date(user.vipExpirationDate) > new Date());
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        Người dùng
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium ml-15">Quản lý và theo dõi người dùng hệ thống</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                        <Download className="w-4 h-4" />
                        Xuất CSV
                    </button>
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                        <Plus className="w-4 h-4" />
                        Thêm mới
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tổng người dùng</p>
                        <h3 className="text-2xl font-black text-slate-900">{users.length.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Star className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Người dùng VIP</p>
                        <h3 className="text-2xl font-black text-slate-900">
                            {users.filter(u => isVIP(u)).length.toLocaleString()}
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Mới (30 ngày)</p>
                        <h3 className="text-2xl font-black text-slate-900">
                            {users.filter(u => {
                                const thirtyDaysAgo = new Date();
                                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                return new Date(u.createdAt) > thirtyDaysAgo;
                            }).length.toLocaleString()}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 sm:min-w-[160px]">
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="w-full pl-6 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                            >
                                <option value="all">Tất cả vai trò</option>
                                <option value="admin">Quản trị viên</option>
                                <option value="user">Người dùng</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Người dùng</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center leading-none">Vai trò</th>
                                <th className="hidden lg:table-cell px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center leading-none">VIP</th>
                                <th className="hidden lg:table-cell px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Tham gia</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right leading-none">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4" colSpan={6}>
                                            <div className="h-12 bg-slate-50 rounded-xl w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                                        Không tìm thấy người dùng nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={user} />
                                                <div className="overflow-hidden">
                                                    <p className="font-bold text-slate-900 truncate">{user.displayName || 'Chưa đặt tên'}</p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                                                        <Mail className="w-3 h-3" />
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs font-black uppercase tracking-wider ${getRoleColor(user.role?.slug || 'user')}`}>
                                                {user.role?.name || 'USER'}
                                            </span>
                                        </td>
                                        <td className="hidden lg:table-cell px-6 py-4 text-center">
                                            {isVIP(user) ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">
                                                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                    VIP {user.vipTier}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thường</span>
                                            )}
                                        </td>
                                        <td className="hidden lg:table-cell px-6 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span>{formatDateLong(user.createdAt)}</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {user.lastLoginAt ? `Lần cuối: ${formatDateShort(user.lastLoginAt)}` : 'Chưa đăng nhập'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/admin/users/${user.id}`}
                                                className="inline-flex items-center justify-center p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all shadow-sm active:scale-95"
                                                title="Xem chi tiết"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-6 animate-pulse space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-100 rounded-2xl"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                        <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-8 bg-slate-50 rounded-xl"></div>
                                    <div className="h-8 bg-slate-50 rounded-xl"></div>
                                </div>
                            </div>
                        ))
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 font-medium">
                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            Không tìm thấy người dùng nào phù hợp.
                        </div>
                    ) : (
                        filteredUsers.map((user) => (
                            <div key={user.id} className="p-6 space-y-4 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <UserAvatar user={user} />
                                        <div className="overflow-hidden">
                                            <p className="font-black text-slate-900 truncate">{user.displayName || 'Chưa đặt tên'}</p>
                                            <p className="text-xs text-slate-500 truncate font-medium">{user.email}</p>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/admin/users/${user.id}`}
                                        className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </Link>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50 flex items-center justify-between">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Vai trò</p>
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${getRoleColor(user.role?.slug || 'user')}`}>
                                            {user.role?.name || 'USER'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 pt-1">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Tham gia: {formatDateLong(user.createdAt)}</span>
                                    </div>
                                    {isVIP(user) && (
                                        <span className="flex items-center gap-1 text-amber-600 font-bold">
                                            <Star className="w-3 h-3 fill-amber-500" />
                                            VIP {user.vipTier}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-slate-500 font-medium">
                        Hiển thị <span className="font-bold text-slate-900">{filteredUsers.length}</span> / <span className="font-bold text-slate-900">{users.length}</span>
                    </p>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button disabled className="flex-1 sm:flex-none px-6 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-400 cursor-not-allowed">
                            Trước
                        </button>
                        <button disabled className="flex-1 sm:flex-none px-6 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                            Sau
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Plus({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}
