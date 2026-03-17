"use client";

import React, { useState, useEffect } from 'react';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    Eye,
    EyeOff,
    Trash2,
    Filter,
    Clock,
    User,
    BookOpen,
    Reply,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';

interface Comment {
    id: string;
    userId: string;
    chapterId: string;
    storyId: string;
    parentId: string | null;
    content: string;
    timestampSeconds: number | null;
    likesCount: number;
    isHidden: boolean;
    createdAt: string;
    user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
    };
    chapter: {
        id: string;
        title: string;
        chapterNumber: number;
    };
    story: {
        id: string;
        title: string;
    };
    parent: {
        id: string;
        content: string;
        user: {
            displayName: string;
        };
    } | null;
    _count: {
        replies: number;
    };
}

interface Stats {
    totalComments: number;
    hiddenComments: number;
    visibleComments: number;
    todayComments: number;
}

export default function CommentsPage() {
    const [comments, setComments] = useState<Comment[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [hiddenFilter, setHiddenFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    useEffect(() => {
        fetchComments();
        fetchStats();
    }, [page, searchTerm, hiddenFilter]);

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(searchTerm && { search: searchTerm }),
                ...(hiddenFilter !== '' && { isHidden: hiddenFilter }),
            });
            const res = await apiClient.get(`/comments?${params}`);
            setComments(res.data.data);
            setTotal(res.data.meta.total);
            setTotalPages(res.data.meta.totalPages);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await apiClient.get('/comments/stats');
            setStats(res.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const handleToggleHidden = async (id: string, currentHidden: boolean) => {
        try {
            await apiClient.patch(`/comments/${id}`, { isHidden: !currentHidden });
            fetchComments();
            fetchStats();
        } catch (error) {
            console.error('Failed to toggle comment visibility:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này? Hành động này không thể hoàn tác.')) return;

        try {
            await apiClient.delete(`/comments/${id}`);
            fetchComments();
            fetchStats();
        } catch (error) {
            console.error('Failed to delete comment:', error);
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

    const formatTimestamp = (seconds: number | null) => {
        if (!seconds) return null;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                            <MessageSquare className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Bình luận
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Kiểm duyệt và quản lý bình luận của người dùng
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Tổng bình luận</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.totalComments.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Eye className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Hiển thị</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.visibleComments.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                                <EyeOff className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Đã ẩn</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.hiddenComments.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Hôm nay</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.todayComments.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Filter */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm theo nội dung, tên người dùng, email..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <select
                        value={hiddenFilter}
                        onChange={(e) => {
                            setHiddenFilter(e.target.value);
                            setPage(1);
                        }}
                        className="bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-8 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer min-w-[200px]"
                    >
                        <option value="">Tất cả bình luận</option>
                        <option value="false">Đang hiển thị</option>
                        <option value="true">Đã ẩn</option>
                    </select>
                </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
                {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                        <div key={i} className="bg-white rounded-[32px] border border-slate-200 p-6 animate-pulse">
                            <div className="h-20 bg-slate-50 rounded-2xl" />
                        </div>
                    ))
                ) : comments.length > 0 ? (
                    comments.map((comment) => (
                        <div
                            key={comment.id}
                            className={`bg-white rounded-[32px] border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all ${comment.isHidden ? 'opacity-60 bg-slate-50' : ''
                                }`}
                        >
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 text-base font-bold text-white">
                                            {comment.user.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-900 break-words">{comment.user.displayName}</p>
                                            <p className="text-xs font-medium text-slate-400 break-all">{comment.user.email}</p>
                                            <p className="mt-1 text-[11px] font-medium text-slate-400">{formatDate(comment.createdAt)}</p>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            onClick={() => handleToggleHidden(comment.id, comment.isHidden)}
                                            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${comment.isHidden
                                                ? 'text-emerald-600 hover:bg-emerald-50'
                                                : 'text-amber-600 hover:bg-amber-50'
                                                }`}
                                            title={comment.isHidden ? 'Hien thi' : 'An'}
                                        >
                                            {comment.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl text-red-600 transition-all hover:bg-red-50"
                                            title="Xoa"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">
                                        <BookOpen className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{comment.story.title}</span>
                                    </span>
                                    <span className="inline-flex max-w-full rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 break-words">
                                        Chuong {comment.chapter.chapterNumber}: {comment.chapter.title}
                                    </span>
                                    {comment.timestampSeconds && (
                                        <span className="inline-flex items-center gap-1 rounded-xl border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-600">
                                            <Clock className="w-3 h-3" />
                                            {formatTimestamp(comment.timestampSeconds)}
                                        </span>
                                    )}
                                </div>

                                {comment.parent && (
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                        <div className="mb-1 flex items-center gap-2">
                                            <Reply className="w-3 h-3 text-slate-400" />
                                            <p className="text-xs font-bold text-slate-500">
                                                Tra loi {comment.parent.user.displayName}:
                                            </p>
                                        </div>
                                        <p className="text-xs leading-5 text-slate-600 break-words">{comment.parent.content}</p>
                                    </div>
                                )}

                                <p className="text-sm leading-7 text-slate-700 break-words">{comment.content}</p>

                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span className="font-medium">Yeu thich: {comment.likesCount}</span>
                                    {comment._count.replies > 0 && (
                                        <span className="font-medium">Tra loi: {comment._count.replies}</span>
                                    )}
                                    {comment.isHidden && (
                                        <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 font-bold text-red-600">
                                            <EyeOff className="w-3 h-3" />
                                            Da an
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-[32px] border border-slate-200 p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <MessageSquare className="w-6 h-6 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Chưa có bình luận nào</h3>
                        <p className="text-slate-500 mt-1">Các bình luận sẽ hiển thị ở đây.</p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm px-8 py-6 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                        Trang {page} / {totalPages} (Tổng {total} bình luận)
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


