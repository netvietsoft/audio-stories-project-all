"use client";

import React, { useState, useEffect } from 'react';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Crown,
    Users,
    Calendar,
    Trash2,
    Filter,
    User,
    CheckCircle,
    XCircle,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList, unwrapData } from '@/lib/api/unwrap';

interface Membership {
    id: string;
    userId: string;
    type: 'all_authors' | 'specific_author';
    authorId: string | null;
    startDate: string;
    endDate: string;
    creditsSpent: number;
    createdAt: string;
    user: {
        id: string;
        email: string;
        displayName: string;
        vipTier: number;
    };
    author: {
        id: string;
        name: string;
    } | null;
}

interface Stats {
    totalMemberships: number;
    activeMemberships: number;
    expiredMemberships: number;
    allAuthorsCount: number;
    specificAuthorCount: number;
}

export default function MembershipsPage() {
    const [memberships, setMemberships] = useState<Membership[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    useEffect(() => {
        fetchMemberships();
        fetchStats();
    }, [page, searchTerm, typeFilter, statusFilter]);

    const fetchMemberships = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(searchTerm && { search: searchTerm }),
                ...(typeFilter && { type: typeFilter }),
                ...(statusFilter && { status: statusFilter }),
            });
            const res = await apiClient.get(`/memberships?${params}`);
            setMemberships(unwrapList<Membership>(res.data));
            const meta = res.data?.data?.meta ?? res.data?.meta;
            setTotal(meta?.total ?? 0);
            setTotalPages(meta?.totalPages ?? 1);
        } catch (error) {
            console.error('Failed to fetch memberships:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await apiClient.get('/memberships/stats');
            setStats(unwrapData<Stats>(res.data));
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa gói hội viên này?')) return;

        try {
            await apiClient.delete(`/memberships/${id}`);
            fetchMemberships();
            fetchStats();
        } catch (error) {
            console.error('Failed to delete membership:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    };

    const isActive = (endDate: string) => {
        return new Date(endDate) >= new Date();
    };

    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
                            <Crown className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Hội viên
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Theo dõi và quản lý các gói hội viên VIP
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Crown className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Tổng gói</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.totalMemberships.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Đang hoạt động</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.activeMemberships.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                                <XCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Đã hết hạn</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.expiredMemberships.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Toàn tác giả</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.allAuthorsCount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Riêng tác giả</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.specificAuthorCount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Filter */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm theo email, tên người dùng, tác giả..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <div className="grid w-full grid-cols-2 gap-4 md:flex md:w-auto">
                    <div className="relative min-w-0">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                        <select
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setPage(1);
                            }}
                            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-8 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none cursor-pointer md:min-w-[180px]"
                        >
                            <option value="">Tất cả loại</option>
                            <option value="all_authors">Toàn tác giả</option>
                            <option value="specific_author">Riêng tác giả</option>
                        </select>
                    </div>
                    <div className="relative min-w-0">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-8 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none cursor-pointer md:min-w-[180px]"
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="active">Đang hoạt động</option>
                            <option value="expired">Đã hết hạn</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Memberships Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Người dùng</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Loại gói</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tác giả</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Thời hạn</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Credits</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-8 py-6">
                                            <div className="h-12 bg-slate-50 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : memberships.length > 0 ? (
                                memberships.map((membership) => {
                                    const active = isActive(membership.endDate);
                                    const daysLeft = getDaysRemaining(membership.endDate);

                                    return (
                                        <tr key={membership.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                                                        {membership.user.displayName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900">{membership.user.displayName}</p>
                                                        <p className="text-xs font-medium text-slate-400">{membership.user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                {membership.type === 'all_authors' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[10px] font-black text-purple-600 uppercase tracking-widest">
                                                        <Users className="w-3 h-3" /> Toàn tác giả
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                        <User className="w-3 h-3" /> Riêng tác giả
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                {membership.author ? (
                                                    <span className="text-sm font-bold text-slate-700">
                                                        {membership.author.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-slate-500">
                                                        {formatDate(membership.startDate)} - {formatDate(membership.endDate)}
                                                    </p>
                                                    {active && daysLeft > 0 && (
                                                        <p className="text-[10px] font-bold text-emerald-600">
                                                            Còn {daysLeft} ngày
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-bold text-amber-600">
                                                    {membership.creditsSpent.toLocaleString()} credits
                                                </p>
                                            </td>
                                            <td className="px-8 py-5">
                                                {active ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                        <CheckCircle className="w-3 h-3" /> Hoạt động
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-[10px] font-black text-red-600 uppercase tracking-widest">
                                                        <XCircle className="w-3 h-3" /> Hết hạn
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2 transition-all">
                                                    <button
                                                        onClick={() => handleDelete(membership.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-8 py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <Crown className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Chưa có hội viên nào</h3>
                                        <p className="text-slate-500 mt-1">Các gói hội viên sẽ hiển thị ở đây.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                    {isLoading ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse p-4">
                                <div className="h-24 rounded-2xl bg-slate-50" />
                            </div>
                        ))
                    ) : memberships.length > 0 ? (
                        memberships.map((membership) => {
                            const active = isActive(membership.endDate);
                            const daysLeft = getDaysRemaining(membership.endDate);
                            return (
                                <div key={membership.id} className="p-4">
                                    <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-white">
                                                    {membership.user.displayName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-900 break-words">{membership.user.displayName}</p>
                                                    <p className="text-xs font-medium text-slate-400 break-all">{membership.user.email}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(membership.id)}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                                                title="Xoa hoi vien"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {membership.type === 'all_authors' ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-purple-600">
                                                    <Users className="w-3 h-3" /> Toan tac gia
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-600">
                                                    <User className="w-3 h-3" /> Rieng tac gia
                                                </span>
                                            )}
                                            {active ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600">
                                                    <CheckCircle className="w-3 h-3" /> Hoat dong
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-red-600">
                                                    <XCircle className="w-3 h-3" /> Het han
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tac gia</p>
                                                <p className="mt-1 text-sm font-bold text-slate-700 break-words">{membership.author?.name || '-'}</p>
                                            </div>
                                            <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Credits</p>
                                                <p className="mt-1 text-sm font-bold text-amber-600">{membership.creditsSpent.toLocaleString()} credits</p>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Thoi han</p>
                                            <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(membership.startDate)} - {formatDate(membership.endDate)}</p>
                                            {active && daysLeft > 0 && (
                                                <p className="mt-1 text-xs font-bold text-emerald-600">Con {daysLeft} ngay</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Crown className="w-6 h-6 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Chua co hoi vien nao</h3>
                            <p className="text-slate-500 mt-1">Cac goi hoi vien se hien thi o day.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Trang {page} / {totalPages} (Tổng {total} gói)
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


