"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    Music,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Filter,
    Check,
} from 'lucide-react';
import { adminApiClient as apiClient, ADMIN_ACCESS_TOKEN_KEY } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import { useParams, useRouter } from 'next/navigation';
import type { Chapter } from '@/types/admin';
import { useAdminStore } from '@/stores/admin-store';



interface StoryOption {
    id: string;
    title?: unknown;
    titleVi?: string;
    titleEn?: string;
}
export default function ChaptersGlobalPage() {
    const router = useRouter();
    const clearAdminAuth = useAdminStore((state) => state.clearAuth);

    const getLocalePrefix = () => {
        if (typeof window === 'undefined') return 'vi';
        const locale = window.location.pathname.split('/')[1];
        return locale === 'en' ? 'en' : 'vi';
    };

    const handleAdminAuthError = (error: unknown) => {
        if (!axios.isAxiosError(error)) return false;

        const status = error.response?.status;
        if (status !== 401 && status !== 403) return false;

        if (typeof window !== 'undefined') {
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('userEmail');
            localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
        }
        clearAdminAuth();

        const locale = getLocalePrefix();
        const reason = status === 401 ? 'expired' : 'unauthorized';
        router.push(`/${locale}/login?reason=${reason}`);
        return true;
    };
    const getLocalizedText = (value: unknown, localeKey = 'vi'): string => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            const titleVi = typeof record.titleVi === 'string' ? record.titleVi : '';
            const titleEn = typeof record.titleEn === 'string' ? record.titleEn : '';
            if (titleVi || titleEn) return localeKey === 'en' ? titleEn || titleVi : titleVi || titleEn;
            const vi = typeof record.vi === 'string' ? record.vi : '';
            const en = typeof record.en === 'string' ? record.en : '';
            return localeKey === 'en' ? en || vi || '' : vi || en || '';
        }
        return '';
    };

    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [filterAccess, setFilterAccess] = useState('all');
    const [filterStoryId, setFilterStoryId] = useState('all');
    const params = useParams<{ lang?: string }>();
    const urlLang = params?.lang === 'en' ? 'en' : 'vi';
    const [selectedLocale, setSelectedLocale] = useState(urlLang);
    const { languages } = useAdminLanguages();
    const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const [stories, setStories] = useState<StoryOption[]>([]);
    const [isStoryFilterOpen, setIsStoryFilterOpen] = useState(false);
    const [storySearch, setStorySearch] = useState('');
    const storyFilterRef = React.useRef<HTMLDivElement>(null);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    useEffect(() => {
        if (!languages.some((language) => language.key === selectedLocale)) {
            setSelectedLocale(languages[0]?.key || 'vi');
        }
    }, [languages, selectedLocale]);

    useEffect(() => {
        fetchChapters();
    }, [page, searchTerm, filterAccess, filterStoryId, selectedLocale]);

    useEffect(() => {
        const fetchStories = async () => {
            try {
                // Don't pass lang to get all stories
                const res = await apiClient.get('/stories/admin', {
                    params: {
                        all: true,
                    },
                });
                setStories(unwrapList<StoryOption>(res.data));
            } catch (error) {
                if (handleAdminAuthError(error)) return;
                console.error('Failed to fetch stories:', error);
            }
        };
        fetchStories();
    }, [selectedLocale]);

    // Handle click outside for searchable select
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (storyFilterRef.current && !storyFilterRef.current.contains(event.target as Node)) {
                setIsStoryFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchChapters = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                lang: selectedLocale,
                ...(searchTerm && { search: searchTerm }),
                ...(filterAccess !== 'all' && { accessType: filterAccess }),
                ...(filterStoryId !== 'all' && { storyId: filterStoryId }),
            });
            const res = await apiClient.get(`/chapters?${params}`);
            setChapters(unwrapList<Chapter>(res.data));
            setTotal((res.data?.data?.meta ?? res.data?.meta)?.total ?? 0);
            setTotalPages((res.data?.data?.meta ?? res.data?.meta)?.totalPages ?? 1);
            setSelectedChapters(new Set()); // Clear selection when fetching new data
        } catch (error) {
            if (handleAdminAuthError(error)) return;
            console.error('Failed to fetch chapters:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        router.push(`/${selectedLocale}/chapters/new`);
    };

    const handleEdit = (chapter: Chapter) => {
        router.push(`/${selectedLocale}/chapters/${chapter.id}`);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a chÆ°Æ¡ng nÃ y?')) return;

        try {
            await apiClient.delete(`/chapters/${id}`);
            fetchChapters();
        } catch (error) {
            console.error('Failed to delete chapter:', error);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedChapters.size === 0) return;
        if (!window.confirm(`Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a ${selectedChapters.size} chÆ°Æ¡ng Ä‘Ã£ chá»n?`)) return;

        setIsDeletingBulk(true);
        try {
            await Promise.all(
                Array.from(selectedChapters).map(id => apiClient.delete(`/chapters/${id}`))
            );
            setSelectedChapters(new Set());
            fetchChapters();
        } catch (error) {
            console.error('Failed to delete chapters:', error);
            alert('CÃ³ lá»—i xáº£y ra khi xÃ³a chapters');
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const toggleChapterSelection = (id: string) => {
        const newSelection = new Set(selectedChapters);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedChapters(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedChapters.size === chapters.length) {
            setSelectedChapters(new Set());
        } else {
            setSelectedChapters(new Set(chapters.map(c => c.id)));
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Music className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Chương
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Tất cả các chương trong hệ thống ({total} chương)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <AdminLanguageDropdown
                        languages={languages}
                        value={selectedLocale}
                        onChange={(nextKey) => {
                            setSelectedLocale(nextKey);
                            setPage(1);
                        }}
                    />
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm chương mới
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col gap-4">
                {/* Bulk Delete Button */}
                {selectedChapters.size > 0 && (
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-2xl">
                        <p className="text-sm font-bold text-red-900">
                            Đã chọn {selectedChapters.size} chương
                        </p>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isDeletingBulk}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDeletingBulk ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang xóa...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Xóa đã chọn
                                </>
                            )}
                        </button>
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm theo tiêu đề chương..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-56">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={filterAccess}
                            onChange={(e) => {
                                setFilterAccess(e.target.value);
                                setPage(1);
                            }}
                            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-10 pr-10 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                            <option value="all">Tất cả loại truy cập</option>
                            <option value="free">Miễn phí (Free)</option>
                            <option value="timed">Mở khóa theo thời gian</option>
                            <option value="vip">Dành cho VIP</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Story Filter (Searchable) */}
                    <div className="relative flex-1 md:w-64" ref={storyFilterRef}>
                        <button
                            onClick={() => setIsStoryFilterOpen(!isStoryFilterOpen)}
                            className="w-full h-full bg-slate-50 border-none rounded-2xl py-3 pl-6 pr-10 text-sm font-bold text-slate-700 flex items-center justify-between hover:ring-2 hover:ring-indigo-500/10 transition-all cursor-pointer"
                        >
                            <span className="truncate">
                                {filterStoryId === 'all' 
                                    ? 'Tất cả truyện' 
                                    : filterStoryId === 'null'
                                    ? 'Chưa gán truyện'
                                    : getLocalizedText(stories.find(s => s.id === filterStoryId)?.title, selectedLocale) || 'Lọc theo truyện'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isStoryFilterOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isStoryFilterOpen && (
                            <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-white border border-slate-100 rounded-[24px] shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                <div className="relative mb-2">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm truyện..."
                                        className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
                                        value={storySearch}
                                        onChange={(e) => setStorySearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    <button
                                        onClick={() => {
                                            setFilterStoryId('all');
                                            setIsStoryFilterOpen(false);
                                            setPage(1);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${filterStoryId === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        Tất cả truyện
                                        {filterStoryId === 'all' && <Check className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFilterStoryId('null');
                                            setIsStoryFilterOpen(false);
                                            setPage(1);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${filterStoryId === 'null' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        Chưa gán truyện
                                        {filterStoryId === 'null' && <Check className="w-4 h-4" />}
                                    </button>
                                    <div className="h-px bg-slate-100 my-1 mx-2" />
                                    {stories.filter(s => getLocalizedText(s.title, selectedLocale).toLowerCase().includes(storySearch.toLowerCase())).length > 0 ? (
                                        stories.filter(s => getLocalizedText(s.title, selectedLocale).toLowerCase().includes(storySearch.toLowerCase())).map((story) => (
                                            <button
                                                key={story.id}
                                                onClick={() => {
                                                    setFilterStoryId(story.id);
                                                    setIsStoryFilterOpen(false);
                                                    setStorySearch('');
                                                    setPage(1);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between group transition-all ${filterStoryId === story.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                                            >
                                                <span className="truncate">{getLocalizedText(story.title, selectedLocale)}</span>
                                                {filterStoryId === story.id && <Check className="w-4 h-4 shrink-0" />}
                                            </button>
                                        ))
                                    ) : (
                                        <p className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Không tìm thấy</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </div>

            {/* Chapters List */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4 md:px-8">
                    <label className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-500">
                        <input
                            type="checkbox"
                            checked={chapters.length > 0 && selectedChapters.size === chapters.length}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        Chọn tất cả
                    </label>
                    <p className="text-xs font-bold text-slate-400">{chapters.length} chương</p>
                </div>

                <div className="divide-y divide-slate-100">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="px-6 py-5 md:px-8 animate-pulse">
                                <div className="h-14 bg-slate-50 rounded-2xl" />
                            </div>
                        ))
                    ) : chapters.length > 0 ? (
                        chapters.map((chapter) => (
                            <div
                                key={chapter.id}
                                className="group flex items-center justify-between gap-4 px-6 py-5 transition-all duration-300 hover:bg-slate-50/60 md:px-8"
                            >
                                <div className="flex min-w-0 items-center gap-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedChapters.has(chapter.id)}
                                        onChange={() => toggleChapterSelection(chapter.id)}
                                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />

                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-slate-900 md:text-base">
                                            Chương {chapter.chapterNumber}: {selectedLocale === 'en'
                                                ? (chapter.titleEn || chapter.titleVi || chapter.title)
                                                : (chapter.titleVi || chapter.titleEn || chapter.title)}
                                        </p>
                                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                                            {chapter.story
                                                ? (selectedLocale === 'en'
                                                    ? (chapter.story.titleEn || chapter.story.titleVi || chapter.story.title)
                                                    : (chapter.story.titleVi || chapter.story.titleEn || chapter.story.title))
                                                : 'Chưa gán truyện'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(chapter)}
                                        className="rounded-xl p-2 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                        title="Chỉnh sửa"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(chapter.id)}
                                        className="rounded-xl p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                                        title="Xóa"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Music className="w-6 h-6 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">ChÆ°a cÃ³ chÆ°Æ¡ng nÃ o</h3>
                            <p className="text-slate-500 mt-1">Báº¯t Ä‘áº§u báº±ng cÃ¡ch thÃªm chÆ°Æ¡ng Ä‘áº§u tiÃªn.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Trang {page} / {totalPages} (Tổng {total} chương)
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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




