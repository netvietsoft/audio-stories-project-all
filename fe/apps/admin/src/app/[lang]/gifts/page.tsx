"use client";

import React, { useState, useEffect } from 'react';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Gift,
    Clock,
    Filter,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';

interface GiftTransaction {
    id: string;
    userId: string;
    amount: number;
    description: string;
    createdAt: string;
    user: {
        id: string;
        email: string;
        displayName: string;
    };
}

export default function GiftsPage() {
    const [gifts, setGifts] = useState<GiftTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    useEffect(() => {
        fetchGifts();
    }, [page, searchTerm]);

    const fetchGifts = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(searchTerm && { search: searchTerm }),
            });
            const res = await apiClient.get(`/transactions/gifts?${params}`);
            setGifts(res.data.data);
            setTotal(res.data.meta.total);
            setTotalPages(res.data.meta.totalPages);
        } catch (error) {
            console.error('Failed to fetch gifts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-pink-600 flex items-center justify-center shadow-lg shadow-pink-200">
                            <Gift className="w-6 h-6 text-white" />
                        </div>
                        Lịch sử Tặng quà
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Xem danh sách các quà tặng từ độc giả
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-pink-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm theo email, tên, mô tả..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-pink-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Gifts Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Độc giả</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Số Credits</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Chi tiết</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-8 py-6">
                                            <div className="h-12 bg-slate-50 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : gifts.length > 0 ? (
                                gifts.map((gift) => (
                                    <tr key={gift.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900">{gift.user.displayName}</p>
                                            <p className="text-xs font-medium text-slate-400 mt-0.5">{gift.user.email}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-pink-600">{Math.abs(gift.amount).toLocaleString()} Credits</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                                                {gift.description}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-medium text-slate-500">
                                                {formatDate(gift.createdAt)}
                                            </p>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <Gift className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Chưa có quà tặng nào</h3>
                                        <p className="text-slate-500 mt-1">Các món quà tặng sẽ hiển thị ở đây.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="divide-y divide-slate-100 md:hidden">
                    {isLoading ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse p-4">
                                <div className="h-24 rounded-2xl bg-slate-50" />
                            </div>
                        ))
                    ) : gifts.length > 0 ? (
                        gifts.map((gift) => (
                            <div key={gift.id} className="p-4">
                                <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-900 break-words">{gift.user.displayName}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-400 break-all">{gift.user.email}</p>
                                            <p className="mt-2 text-[11px] font-medium text-slate-400">{formatDate(gift.createdAt)}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Số Credits</p>
                                        <p className="mt-1 text-sm font-black text-pink-600">{Math.abs(gift.amount).toLocaleString()} Credits</p>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Chi tiết</p>
                                        <p className="mt-1 text-xs text-slate-600">{gift.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Gift className="w-6 h-6 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Chưa có quà tặng nào</h3>
                            <p className="text-slate-500 mt-1">Các món quà tặng sẽ hiển thị ở đây.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Trang {page} / {totalPages} (Tổng {total} quà tặng)
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
