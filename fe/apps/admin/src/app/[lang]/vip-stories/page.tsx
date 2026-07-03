"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from '@/components/shared/LocalizedLink';
import { useParams } from 'next/navigation';
import {
    ArrowUpDown,
    BookOpen,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Crown,
    Filter,
    Search,
    TrendingUp,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';

type AccessTypeFilter = 'all' | 'vip' | 'timed';
type SortBy = 'credits' | 'opens';
type SortOrder = 'desc' | 'asc';

interface VipChapterItem {
    id: string;
    chapterNumber: number;
    title: string | null;
    accessType: 'vip' | 'timed';
    unlockPrice: number;
    updatedAt: string;
    viewCount: number;
    unlocksAt: string | null;
}

interface VipStoryRow {
    storyId: string;
    storyTitle: string;
    storySlug: string;
    storyThumbnailUrl: string | null;
    authorName: string;
    createdAt: string;
    totalViews: number;
    vipChapterCount: number;
    timedChapterCount: number;
    totalChapterCount: number;
    vipOpenCount: number;
    timedOpenCount: number;
    totalOpenCount: number;
    totalCredits: number;
    vipCredits: number;
    timedCredits: number;
    chapters: VipChapterItem[];
}

interface VipStatsResponse {
    data: VipStoryRow[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    summary: {
        totalStories: number;
        totalVipChapters: number;
        totalTimedChapters: number;
        totalVipOpens: number;
        totalTimedOpens: number;
        totalCredits: number;
    };
}

const PAGE_SIZE = 12;

export default function VipStoriesStatsPage() {
    const params = useParams<{ lang?: string }>();
    const urlLang = params?.lang === 'en' ? 'en' : 'vi';

    const [selectedLocale] = useState(urlLang);
    const [rows, setRows] = useState<VipStoryRow[]>([]);
    const [summary, setSummary] = useState<VipStatsResponse['summary'] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [accessType, setAccessType] = useState<AccessTypeFilter>('all');
    const [sortBy, setSortBy] = useState<SortBy>('credits');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchVipStats();
    }, [page, searchTerm, accessType, sortBy, sortOrder, selectedLocale]);

    const fetchVipStats = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: PAGE_SIZE.toString(),
                ...(searchTerm && { search: searchTerm }),
                ...(accessType !== 'all' && { accessType }),
                sortBy,
                sortOrder,
            });

            const res = await apiClient.get(`/stats/vip-chapters?${params.toString()}`);
            const body = res.data as any;
            const meta = body?.data?.meta ?? body?.meta;
            const summaryData = body?.data?.summary ?? body?.summary;
            setRows(unwrapList<VipStoryRow>(res.data));
            setSummary(summaryData || null);
            setTotal(meta?.total || 0);
            setTotalPages(meta?.totalPages || 1);
        } catch (error) {
            console.error('Failed to fetch VIP chapter stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount ?? 0) + ' Pulse';
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

    const sortedLabel = useMemo(() => {
        if (sortBy === 'credits') return sortOrder === 'desc' ? 'Tổng credits: nhiều → ít' : 'Tổng credits: ít → nhiều';
        return sortOrder === 'desc' ? 'Lượt mở: nhiều → ít' : 'Lượt mở: ít → nhiều';
    }, [sortBy, sortOrder]);

    const accessLabel = (value: 'vip' | 'timed') => value === 'vip' ? 'VIP' : 'Theo thời gian';

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">
                        <Crown className="h-3.5 w-3.5" /> Thống kê doanh thu
                    </div>
                    <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                        Thống kê Truyện VIP
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-500">
                        Theo dõi các chương đang mở khóa theo thời gian hoặc VIP, tổng credits cấu hình và số chương đang nằm trong báo cáo doanh thu.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link
                        href={`/${selectedLocale}/stories`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        <ChevronLeft className="h-4 w-4" /> Quay lại truyện
                    </Link>
                </div>
            </div>

            {summary && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Số truyện</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{summary.totalStories.toLocaleString()}</p>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng lượt mở VIP/timed</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{(summary.totalVipOpens + summary.totalTimedOpens).toLocaleString()}</p>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Pulse thực thu</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{formatCurrency(summary.totalCredits)}</p>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Hiện tại đang sort</p>
                        <p className="mt-2 text-sm font-bold leading-6 text-slate-900">{sortedLabel}</p>
                    </div>
                </div>
            )}

            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(event) => {
                                setSearchTerm(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Tìm theo tên truyện hoặc tác giả..."
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[620px]">
                        <div className="relative">
                            <Filter className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <select
                                value={accessType}
                                onChange={(event) => {
                                    setAccessType(event.target.value as AccessTypeFilter);
                                    setPage(1);
                                }}
                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                            >
                                <option value="all">Tất cả loại mở</option>
                                <option value="vip">Chỉ VIP</option>
                                <option value="timed">Chỉ theo thời gian</option>
                            </select>
                        </div>

                        <div className="relative">
                            <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <select
                                value={sortBy}
                                onChange={(event) => {
                                    setSortBy(event.target.value as SortBy);
                                    setPage(1);
                                }}
                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                            >
                                <option value="credits">Sắp xếp theo credits</option>
                                <option value="opens">Sắp xếp theo lượt mở</option>
                            </select>
                        </div>

                        <div className="relative">
                            <TrendingUp className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <select
                                value={sortOrder}
                                onChange={(event) => {
                                    setSortOrder(event.target.value as SortOrder);
                                    setPage(1);
                                }}
                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                            >
                                <option value="desc">Nhiều đến ít</option>
                                <option value="asc">Ít đến nhiều</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">
                        Đang tải dữ liệu thống kê...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">
                        Không có truyện nào khớp bộ lọc hiện tại.
                    </div>
                ) : (
                    rows.map((story) => (
                        <section key={story.storyId} className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between md:p-6">
                                <div className="flex min-w-0 gap-4">
                                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                                        {story.storyThumbnailUrl ? (
                                            <img src={story.storyThumbnailUrl} alt={story.storyTitle} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                                                <BookOpen className="h-6 w-6" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-xl font-black tracking-tight text-slate-900">{story.storyTitle}</h2>
                                            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                                {story.authorName || 'Không rõ tác giả'}
                                            </span>
                                        </div>

                                        <p className="mt-1 text-sm font-medium text-slate-500">
                                            Slug: {story.storySlug} · Cập nhật: {formatDate(story.createdAt)}
                                        </p>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-700">
                                                VIP mở: {(story.vipOpenCount ?? 0).toLocaleString()}
                                            </span>
                                            <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                Theo thời gian: {(story.timedOpenCount ?? 0).toLocaleString()}
                                            </span>
                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                Tổng chương: {story.totalChapterCount ?? 0}
                                            </span>
                                            <span className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
                                                Tổng lượt mở: {(story.totalOpenCount ?? 0).toLocaleString()}
                                            </span>
                                            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                                Pulse thực thu: {(story.totalCredits ?? 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 md:min-w-[320px] md:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lượt mở VIP</p>
                                        <p className="mt-1 text-lg font-black text-slate-900">{(story.vipOpenCount ?? 0).toLocaleString()}</p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lượt mở theo thời gian</p>
                                        <p className="mt-1 text-lg font-black text-slate-900">{(story.timedOpenCount ?? 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 md:px-6">
                                <details className="group">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-widest text-slate-500">Danh sách chương đang theo dõi</p>
                                            <p className="mt-1 text-xs font-medium text-slate-400">
                                                Chỉ gồm chương hiện tại đang có access type VIP hoặc theo thời gian.
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm transition group-open:rotate-180">
                                            <ChevronDown className="h-4 w-4" />
                                        </span>
                                    </summary>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {story.chapters.map((chapter) => (
                                            <article key={chapter.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chương {chapter.chapterNumber}</p>
                                                        <h3 className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">
                                                            {chapter.title || 'Không có tiêu đề'}
                                                        </h3>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${chapter.accessType === 'vip' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                                                        {accessLabel(chapter.accessType)}
                                                    </span>
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-slate-500">
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Credits</p>
                                                        <p className="mt-1 font-black text-slate-900">{chapter.unlockPrice.toLocaleString()}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Lượt xem</p>
                                                        <p className="mt-1 font-black text-slate-900">{chapter.viewCount.toLocaleString()}</p>
                                                    </div>
                                                    <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Cập nhật</p>
                                                        <p className="mt-1 font-black text-slate-900">{formatDate(chapter.updatedAt)}</p>
                                                    </div>
                                                    {chapter.unlocksAt ? (
                                                        <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-2">
                                                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Mở theo thời gian</p>
                                                            <p className="mt-1 font-black text-slate-900">{formatDate(chapter.unlocksAt)}</p>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        </section>
                    ))
                )}
            </div>

            <div className="flex flex-col items-center justify-between gap-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
                <p className="text-sm font-medium text-slate-500">
                    Tổng {total.toLocaleString()} truyện khớp điều kiện, đang xem trang {page}/{totalPages}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ChevronLeft className="h-4 w-4" /> Trước
                    </button>
                    <button
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page >= totalPages}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Sau <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}