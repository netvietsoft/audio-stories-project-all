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

    const getRoleBadgeColor = (slug: string) => {
        switch (slug) {
            case 'admin':
                return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'user':
                return 'bg-blue-50 text-blue-700 border-blue-100';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    const isVIP = (user: User) => {
        return (user.vipTier || 0) > 0 && (!user.vipExpirationDate || new Date(user.vipExpirationDate) > new Date());
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Người dùng</h1>
                    <p className="text-slate-500 mt-1 font-medium">Quản lý và theo dõi người dùng hệ thống</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                        <Download className="w-4 h-4" />
                        Xuất CSV
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
                        <Plus className="w-4 h-4" />
                        Thêm người dùng
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tổng người dùng</p>
                            <h3 className="text-2xl font-bold text-slate-900">{users.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                            <Star className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Người dùng VIP</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {users.filter(u => isVIP(u)).length}
                            </h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Mới (30 ngày)</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {users.filter(u => {
                                    const thirtyDaysAgo = new Date();
                                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                    return new Date(u.createdAt) > thirtyDaysAgo;
                                }).length}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo email hoặc tên..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative min-w-[160px]">
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
                        <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Người dùng</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Tín dụng</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái VIP</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày tham gia</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
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
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${getRoleBadgeColor(user.role?.slug || 'user')}`}>
                                                {user.role?.name || 'USER'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-bold text-slate-700">
                                                {user.credits.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {isVIP(user) ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">
                                                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                    VIP {user.vipTier}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">Thường</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                            <div className="flex flex-col">
                                                <span>{formatDateLong(user.createdAt)}</span>
                                                <span className="text-[10px] text-slate-400">
                                                    Lần cuối: {user.lastLoginAt ? formatDateShort(user.lastLoginAt) : 'Chưa đăng nhập'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/admin/users/${user.id}`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                                Xem
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-sm text-slate-500 font-medium">
                        Hiển thị <span className="font-bold text-slate-900">{filteredUsers.length}</span> trên <span className="font-bold text-slate-900">{users.length}</span> người dùng
                    </p>
                    <div className="flex items-center gap-2">
                        <button disabled className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-400 cursor-not-allowed">
                            Trước
                        </button>
                        <button disabled className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white text-slate-700 hover:bg-slate-50 transition-all">
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
