"use client";

import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    X,
    Music,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Filter,
    Check,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { ChapterForm } from '../stories/[id]/chapters/_components/ChapterForm';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';

interface Chapter {
    id: string;
    chapterNumber: number;
    title: string;
    titleVi?: string;
    titleEn?: string;
    description: string | null;
    descriptionVi?: string | null;
    descriptionEn?: string | null;
    content: string | null;
    contentVi?: string | null;
    contentEn?: string | null;
    audioUrlVi?: string | null;
    audioUrlEn?: string | null;
    r2AudioUrl: string | null;
    thumbnailUrl?: string | null;
    youtubeVideoId: string | null;
    audioDuration: number | null;
    accessType: 'free' | 'timed' | 'vip';
    storyId: string | null;
    createdAt: string;
    story?: {
        title: string;
        titleVi?: string;
        titleEn?: string;
    };
}

export default function ChaptersGlobalPage() {
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [filterAccess, setFilterAccess] = useState('all');
    const [filterStoryId, setFilterStoryId] = useState('all');
    const [selectedLocale, setSelectedLocale] = useState('vi');
    const { languages } = useAdminLanguages();
    const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const [stories, setStories] = useState<any[]>([]);
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
                const res = await apiClient.get('/stories', {
                    params: {
                        all: true,
                        lang: selectedLocale,
                    },
                });
                setStories(Array.isArray(res.data) ? res.data : res.data.data || []);
            } catch (error) {
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
            setChapters(res.data.data);
            setTotal(res.data.meta.total);
            setTotalPages(res.data.meta.totalPages);
            setSelectedChapters(new Set()); // Clear selection when fetching new data
        } catch (error) {
            console.error('Failed to fetch chapters:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingChapter(null);
        setIsModalOpen(true);
    };

    const handleEdit = (chapter: Chapter) => {
        setEditingChapter(chapter);
        setIsModalOpen(true);
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

    const handleSubmit = async (data: {
        chapterNumber: number;
        titleVi: string;
        titleEn: string;
        descriptionVi?: string;
        descriptionEn?: string;
        contentVi?: string;
        contentEn?: string;
        audioUrlVi?: string;
        audioUrlEn?: string;
        thumbnailUrl?: string;
        youtubeVideoId?: string;
        audioDuration?: number;
        accessType: 'free' | 'timed' | 'vip';
        storyId?: string;
        unlocksAt?: string;
        language?: string;
    }) => {
        setIsSubmitting(true);
        try {
            if (editingChapter) {
                const updatePayload = {
                    chapterNumber: data.chapterNumber,
                    titleVi: data.titleVi,
                    titleEn: data.titleEn,
                    descriptionVi: data.descriptionVi || undefined,
                    descriptionEn: data.descriptionEn || undefined,
                    contentVi: data.contentVi || undefined,
                    contentEn: data.contentEn || undefined,
                    audioUrlVi: data.audioUrlVi || undefined,
                    audioUrlEn: data.audioUrlEn || undefined,
                    thumbnailUrl: data.thumbnailUrl || undefined,
                    youtubeVideoId: data.youtubeVideoId || undefined,
                    audioDuration: typeof data.audioDuration === 'number' ? data.audioDuration : undefined,
                    accessType: data.accessType,
                    language: selectedLocale,
                };
                await apiClient.patch(`/chapters/${editingChapter.id}`, updatePayload);
            } else {
                const createPayload = {
                    ...data,
                    descriptionVi: data.descriptionVi || undefined,
                    descriptionEn: data.descriptionEn || undefined,
                    contentVi: data.contentVi || undefined,
                    contentEn: data.contentEn || undefined,
                    audioUrlVi: data.audioUrlVi || undefined,
                    audioUrlEn: data.audioUrlEn || undefined,
                    thumbnailUrl: data.thumbnailUrl || undefined,
                    youtubeVideoId: data.youtubeVideoId || undefined,
                    audioDuration: typeof data.audioDuration === 'number' ? data.audioDuration : undefined,
                    language: selectedLocale,
                };
                await apiClient.post(`/chapters`, createPayload);
            }
            setIsModalOpen(false);
            fetchChapters();
        } catch (error) {
            console.error('Failed to save chapter:', error);
            const apiMessage = (error as any)?.response?.data?.message;
            const detail = Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage;
            alert(detail ? `KhÃ´ng thá»ƒ lÆ°u chÆ°Æ¡ng: ${detail}` : 'KhÃ´ng thá»ƒ lÆ°u chÆ°Æ¡ng. Vui lÃ²ng kiá»ƒm tra dá»¯ liá»‡u vÃ  thá»­ láº¡i.');
        } finally {
            setIsSubmitting(false);
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
                        Quan ly Chuong
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Tat ca cac chuong trong he thong ({total} chuong)
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
                        Them chuong moi
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col gap-4">
                {/* Bulk Delete Button */}
                {selectedChapters.size > 0 && (
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-2xl">
                        <p className="text-sm font-bold text-red-900">
                            Da chon {selectedChapters.size} chuong
                        </p>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isDeletingBulk}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDeletingBulk ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Dang xoa...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Xoa da chon
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
                        placeholder="Tim theo tieu de chuong..."
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
                            <option value="all">Tat ca loai truy cap</option>
                            <option value="free">Mien phi (Free)</option>
                            <option value="timed">Mo khoa theo thoi gian</option>
                            <option value="vip">Danh cho VIP</option>
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
                                    ? 'Tat ca truyen' 
                                    : filterStoryId === 'null'
                                    ? 'Chua gan truyen'
                                    : getLocalizedText(stories.find(s => s.id === filterStoryId)?.title, selectedLocale) || 'Loc theo truyen'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isStoryFilterOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isStoryFilterOpen && (
                            <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-white border border-slate-100 rounded-[24px] shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                <div className="relative mb-2">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tim truyen..."
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
                                        Tat ca truyen
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
                                        Chua gan truyen
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
                                        <p className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khong tim thay</p>
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
                        Ch?n t?t c?
                    </label>
                    <p className="text-xs font-bold text-slate-400">{chapters.length} chuong</p>
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
                                            Chuong {chapter.chapterNumber}: {selectedLocale === 'en'
                                                ? (chapter.titleEn || chapter.titleVi || chapter.title)
                                                : (chapter.titleVi || chapter.titleEn || chapter.title)}
                                        </p>
                                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                                            {chapter.story
                                                ? (selectedLocale === 'en'
                                                    ? (chapter.story.titleEn || chapter.story.titleVi || chapter.story.title)
                                                    : (chapter.story.titleVi || chapter.story.titleEn || chapter.story.title))
                                                : 'Chua gán truy?n'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(chapter)}
                                        className="rounded-xl p-2 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                        title="Ch?nh s?a"
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
                            Trang {page} / {totalPages} (Tá»•ng {total} chÆ°Æ¡ng)
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

            {/* Modal for Create/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-[90vw] max-w-7xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">
                                    {editingChapter ? 'Chá»‰nh sá»­a ChÆ°Æ¡ng' : 'ThÃªm ChÆ°Æ¡ng Má»›i'}
                                </h2>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    {getLocalizedText(editingChapter?.story?.title, selectedLocale) || 'ChÆ°Æ¡ng Ä‘á»™c láº­p'}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <ChapterForm
                                initialData={editingChapter ? {
                                    chapterNumber: editingChapter.chapterNumber,
                                    titleVi: editingChapter.titleVi || editingChapter.title,
                                    titleEn: editingChapter.titleEn || '',
                                    descriptionVi: editingChapter.descriptionVi || editingChapter.description || '',
                                    descriptionEn: editingChapter.descriptionEn || '',
                                    contentVi: editingChapter.contentVi || editingChapter.content || '',
                                    contentEn: editingChapter.contentEn || '',
                                    audioUrlVi: editingChapter.audioUrlVi || editingChapter.r2AudioUrl || '',
                                    audioUrlEn: editingChapter.audioUrlEn || '',
                                    r2AudioUrl: editingChapter.r2AudioUrl ?? undefined,
                                    thumbnailUrl: editingChapter.thumbnailUrl ?? undefined,
                                    youtubeVideoId: editingChapter.youtubeVideoId ?? undefined,
                                    audioDuration: editingChapter.audioDuration ?? 0,
                                    accessType: editingChapter.accessType,
                                } : {}}
                                selectedLocale={selectedLocale}
                                onSubmit={handleSubmit}
                                onCancel={() => setIsModalOpen(false)}
                                isLoading={isSubmitting}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}




