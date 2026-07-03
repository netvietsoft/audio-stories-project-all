"use client";

import React, { useState, useEffect } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    Newspaper,
    Search,
    MoreVertical,
    Calendar,
    ChevronRight,
    ChevronDown,
    Loader2,
    Filter,
    ArrowUpDown,
    Download,
    Eye,
    Star,
    BookOpen,
    Layers,
    Music,
    Edit2,
    Trash2,
    Plus,
    CheckCircle2,
    X,
    Pencil,
} from 'lucide-react';

import Link from '@/components/shared/LocalizedLink';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import { StoryForm } from './_components/StoryForm';
import { ChapterForm, type ChapterSubmitPayload } from './[id]/chapters/_components/ChapterForm';
import type { StorySubmitPayload } from '@/types/admin';
import { unwrapList, unwrapData } from '@/lib/api/unwrap';

interface Story {
    id: string;
    title: string;
    titleVi?: string;
    titleEn?: string;
    slug: string;
    thumbnailUrl: string | null;
    status: 'ongoing' | 'completed';
    isRecommended: boolean;
    unlockPrice?: number;
    discountPercent?: number;
    totalViews: number;
    averageRating: number | string;
    language: string;
    createdAt: string;
    author: {
        id: string;
        name: string;
    };
    categories: Array<{
        category: {
            name: string;
        };
    }>;
    _count: {
        chapters: number;
    };
}

const StoryThumbnail = ({ story }: { story: Story }) => {
    const [imageError, setImageError] = useState(false);
    const hasImage = story.thumbnailUrl && !imageError;

    return (
        <div className="w-12 h-16 rounded-lg flex-shrink-0 bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shadow-sm border border-slate-200 group-hover:border-indigo-200 transition-colors">
            {hasImage ? (
                <img
                    src={story.thumbnailUrl!}
                    alt=""
                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                    onError={() => setImageError(true)}
                />
            ) : (
                <BookOpen className="w-6 h-6 opacity-20" />
            )}
        </div>
    );
};

export default function StoriesPage() {
    const [stories, setStories] = useState<Story[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const searchParams = useSearchParams();
    const searchParamsKey = searchParams.toString();
    const router = useRouter();
    const pathname = usePathname();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');
    const params = useParams<{ lang?: string }>();
    const urlLang = params?.lang === 'en' ? 'en' : 'vi';
    const [selectedLocale, setSelectedLocale] = useState(urlLang);
    const { languages } = useAdminLanguages();
    const [page, setPage] = useState(() => {
        const nextPage = Number(searchParams.get('page') || '1');
        return Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1;
    });
    const [total, setTotal] = useState(0);
    const [updatingRecommendId, setUpdatingRecommendId] = useState<string | null>(null);
    const [localSearch, setLocalSearch] = useState(searchParams.get('q') || '');
    const [localDate, setLocalDate] = useState(searchParams.get('date') || searchParams.get('createdAt') || '');

    // Modal States
    const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
    const [editingStoryData, setEditingStoryData] = useState<any | null>(null);
    const [isFetchingStoryData, setIsFetchingStoryData] = useState(false);
    const [isSubmittingStory, setIsSubmittingStory] = useState(false);

    const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
    const [storyChapters, setStoryChapters] = useState<Record<string, any[]>>({});
    const [loadingChapters, setLoadingChapters] = useState<string | null>(null);

    const [isCreatingChapter, setIsCreatingChapter] = useState(false);
    const [storyIdForNewChapter, setStoryIdForNewChapter] = useState<string | null>(null);
    const [isSubmittingNewChapter, setIsSubmittingNewChapter] = useState(false);

    const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
    const [editingChapterData, setEditingChapterData] = useState<any | null>(null);
    const [isSubmittingChapter, setIsSubmittingChapter] = useState(false);

    const sortChaptersByNumber = (chapters: any[]) => {
        return [...chapters].sort((a, b) => {
            const aNumber = Number(a?.chapterNumber ?? 0);
            const bNumber = Number(b?.chapterNumber ?? 0);
            if (aNumber !== bNumber) return aNumber - bNumber;

            const aCreatedAt = new Date(a?.createdAt || 0).getTime();
            const bCreatedAt = new Date(b?.createdAt || 0).getTime();
            return aCreatedAt - bCreatedAt;
        });
    };

    const reorderForColumnFirstGrid = (chapters: any[], columnCount: number) => {
        if (!Array.isArray(chapters) || chapters.length === 0 || columnCount <= 1) {
            return chapters;
        }

        const sorted = sortChaptersByNumber(chapters);
        const rowCount = Math.ceil(sorted.length / columnCount);
        const reordered: any[] = [];

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
                const sourceIndex = colIndex * rowCount + rowIndex;
                if (sourceIndex < sorted.length) {
                    reordered.push(sorted[sourceIndex]);
                }
            }
        }

        return reordered;
    };

    const updateUrlParams = (mutate: (params: URLSearchParams) => void) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        mutate(nextParams);

        nextParams.set('page', '1');
        setPage(1);

        const nextQuery = nextParams.toString();
        const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        router.push(nextUrl, { scroll: false });
        router.refresh();
    };

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value === 'all' || value === '') {
            params.delete(key);
            if (key === 'isRecommended') {
                params.delete('recommended');
            }
        } else {
            params.set(key, value);
        }

        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
        router.refresh();

        if (key === 'q') {
            setSearchTerm(value);
        }

        if (key === 'status') {
            setFilterStatus(value || 'all');
        }

    };

    const handleSortChange = (field: 'chapters_count' | 'views', order: string) => {
        updateUrlParams((nextParams) => {
            if (!order || order === 'all') {
                nextParams.delete('sortBy');
                nextParams.delete('sortOrder');
            } else {
                nextParams.set('sortBy', field);
                nextParams.set('sortOrder', order);
            }
        });
    };

    useEffect(() => {
        fetchStories();
    }, [page, filterStatus, selectedLocale, searchTerm, searchParamsKey]);

    useEffect(() => {
        const nextPage = Number(searchParams.get('page') || '1');
        const safeNextPage = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1;
        const nextStatus = searchParams.get('status') || 'all';
        const nextSearchTerm = searchParams.get('q') || '';
        const nextDate = searchParams.get('date') || searchParams.get('createdAt') || '';

        setPage((prev) => (prev === safeNextPage ? prev : safeNextPage));
        setFilterStatus((prev) => (prev === nextStatus ? prev : nextStatus));
        setSearchTerm((prev) => (prev === nextSearchTerm ? prev : nextSearchTerm));
        setLocalSearch((prev) => (prev === nextSearchTerm ? prev : nextSearchTerm));
        setLocalDate((prev) => (prev === nextDate ? prev : nextDate));
    }, [searchParams]);

    useEffect(() => {
        const currentQ = searchParams.get('q') || '';
        if (localSearch === currentQ) return;

        const debounceId = setTimeout(() => {
            handleFilterChange('q', localSearch);
        }, 500);

        return () => clearTimeout(debounceId);
    }, [localSearch, searchParams]);



    useEffect(() => {
        if (!languages.some((language) => language.key === selectedLocale)) {
            setSelectedLocale(languages[0]?.key || 'vi');
        }
    }, [languages, selectedLocale]);

    const fetchStories = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                lang: selectedLocale,
                isInteractive: 'false',
                ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
                ...(searchTerm ? { search: searchTerm } : {}),
            });

            const advancedKeys = [
                'isRecommended',
                'recommended',
                'rating',
                'sortBy',
                'sortOrder',
                'date',
                'createdAt',
            ];

            advancedKeys.forEach((key) => {
                const value = searchParams.get(key);
                if (value && value !== 'all') {
                    params.set(key, value);
                }
            });

            const res = await apiClient.get(`/stories/admin?${params.toString()}`);
            setStories(unwrapList<Story>(res.data));
            setTotal((res.data?.data?.meta ?? res.data?.meta)?.total ?? 0);
        } catch (error) {
            console.error('Failed to fetch stories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange('q', localSearch);
    };

    const toggleRecommended = async (story: Story) => {
        setUpdatingRecommendId(story.id);
        try {
            await apiClient.patch(`/stories/${story.id}/recommended`, {
                isRecommended: !story.isRecommended,
            });

            setStories((prev) =>
                prev.map((item) =>
                    item.id === story.id
                        ? { ...item, isRecommended: !item.isRecommended }
                        : item,
                ),
            );
        } catch (error) {
            console.error('Failed to update recommended flag:', error);
        } finally {
            setUpdatingRecommendId(null);
        }
    };

    const handleDelete = async (storyId: string, storyTitle: string) => {
        if (!confirm(`Bạn có chắc muốn xóa truyện "${storyTitle}"? Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            await apiClient.delete(`/stories/${storyId}`);
            setStories((prev) => prev.filter((s) => s.id !== storyId));
            setTotal((prev) => prev - 1);
        } catch (error) {
            console.error('Failed to delete story:', error);
            alert('Không thể xóa truyện. Vui lòng thử lại.');
        }
    };

    const handleEditStory = async (story: Story) => {
        setEditingStoryId(story.id);
        // Form hiện inline dưới trang (đã bỏ popup) -> cuộn tới panel sau khi render.
        setTimeout(() => {
            document.getElementById('story-edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        setIsFetchingStoryData(true);
        try {
            const res = await apiClient.get(`/stories/admin/${story.id}`);
            const data = unwrapData<any>(res.data) ?? {};

            // Extract category IDs from various possible structures
            let categoryIds: number[] = [];
            if (data.categories && Array.isArray(data.categories)) {
                categoryIds = data.categories.map((item: any) => {
                    // Handle different response structures
                    if (typeof item === 'number') return item;
                    if (item.category?.id) return item.category.id;
                    if (item.categoryId) return item.categoryId;
                    if (item.id) return item.id;
                    return null;
                }).filter((id: any): id is number => typeof id === 'number');
            }
            
            const mappedData = {
                ...data,
                titleVi: data.language === 'en' ? (data.titleVi || "") : (data.titleVi || data.title || ""),
                titleEn: data.language === 'en' ? (data.titleEn || data.title || "") : (data.titleEn || ""),
                slug: data.slug || "",
                descriptionVi: data.language === 'en' ? (data.descriptionVi || "") : (data.descriptionVi || data.description || ""),
                descriptionEn: data.language === 'en' ? (data.descriptionEn || data.description || "") : (data.descriptionEn || ""),
                thumbnailUrl: data.thumbnailUrl || "",
                audioUrl: data.audioUrl || "",
                categoryIds,
                authorId: data.author?.id || data.authorId,
                status: data.status || "ongoing",
                isInteractive: !!data.isInteractive,
                isRecommended: !!data.isRecommended,
                unlockPrice: Number(data.unlockPrice || 0),
                discountPercent: Number(data.discountPercent || 0),
                language: data.language,
            };
            
            console.log('Mapped story data for editing:', mappedData);
            setEditingStoryData(mappedData);
        } catch (error) {
            console.error('Failed to fetch story details:', error);
            alert('Không thể tải thông tin truyện.');
            setEditingStoryId(null);
        } finally {
            setIsFetchingStoryData(false);
        }
    };

    const handleStorySubmit = async (data: StorySubmitPayload) => {
        if (!editingStoryId) return;
        setIsSubmittingStory(true);
        try {
            await apiClient.patch(`/stories/${editingStoryId}`, data);
            setEditingStoryId(null);
            setEditingStoryData(null);
            await fetchStories();
        } catch (error) {
            console.error('Failed to update story:', error);
            alert('Không thể cập nhật truyện.');
        } finally {
            setIsSubmittingStory(false);
        }
    };

    const toggleStory = async (storyId: string) => {
        if (expandedStoryId === storyId) {
            setExpandedStoryId(null);
            return;
        }
        setExpandedStoryId(storyId);

        if (storyChapters[storyId]) return;

        setLoadingChapters(storyId);
        try {
            const res = await apiClient.get(`/chapters?storyId=${storyId}&limit=100`);
            const chapters = unwrapList<any>(res.data);
            setStoryChapters((prev) => ({ ...prev, [storyId]: sortChaptersByNumber(chapters) }));
        } catch (error) {
            console.error('Failed to fetch chapters:', error);
        } finally {
            setLoadingChapters(null);
        }
    };

    const handleChapterCreateSubmit = async (data: any) => {
        if (!storyIdForNewChapter) return;
        setIsSubmittingNewChapter(true);
        try {
            await apiClient.post(`/stories/${storyIdForNewChapter}/chapters`, data);
            
            // Refetch chapters for this story
            const res = await apiClient.get(`/chapters?storyId=${storyIdForNewChapter}&limit=100`);
            const chapters = unwrapList<any>(res.data);
            setStoryChapters((prev) => ({ ...prev, [storyIdForNewChapter]: sortChaptersByNumber(chapters) }));
            
            // Update UI count
            setStories(prev => prev.map(s => 
                s.id === storyIdForNewChapter 
                    ? { ...s, _count: { ...s._count, chapters: (s._count?.chapters || 0) + 1 } } 
                    : s
            ));
            
            setStoryIdForNewChapter(null);
            setIsCreatingChapter(false);
        } catch (error) {
            console.error('Failed to create chapter:', error);
            alert('Không thể tạo chương mới.');
        } finally {
            setIsSubmittingNewChapter(false);
        }
    };

    const handleEditChapter = async (storyId: string, chapter: any) => {
        setEditingChapterId(chapter.id);
        // Keep a fast fallback so modal can open immediately.
        setEditingChapterData({ ...chapter, storyId });

        try {
            const res = await apiClient.get(`/chapters/${chapter.id}`);
            const fullChapter = unwrapData<any>(res.data) ?? {};

            setEditingChapterData({
                ...chapter,
                ...fullChapter,
                storyId,
            });
        } catch (error) {
            console.error('Failed to fetch full chapter details:', error);
            alert('Không thể tải đầy đủ dữ liệu chương.');
        }
    };

    const handleChapterSubmit = async (data: ChapterSubmitPayload) => {
        if (!editingChapterId || !editingChapterData) return;
        setIsSubmittingChapter(true);
        try {
            const payload = {
                ...data,
                thumbnailUrl: data.thumbnailUrl || undefined,
                youtubeVideoId: data.youtubeVideoId || undefined,
                r2AudioUrl: data.r2AudioUrl || undefined,
                storyId: data.storyId || undefined,
                unlocksAt: data.unlocksAt || undefined,
            };

            await apiClient.patch(`/chapters/${editingChapterId}`, payload);
            
            // Optimistic update
            const updatedTitle = payload.title || editingChapterData.title;
            setStoryChapters((prev) => ({
                ...prev,
                [editingChapterData.storyId]: (prev[editingChapterData.storyId] || []).map(ch => 
                    ch.id === editingChapterId ? { ...ch, title: updatedTitle } : ch
                ),
            }));
            
            setEditingChapterId(null);
            setEditingChapterData(null);
        } catch (error) {
            console.error('Failed to update chapter:', error);
            alert('Không thể cập nhật chương.');
        } finally {
            setIsSubmittingChapter(false);
        }
    };

    const handleDeleteChapter = async (storyId: string, chapterId: string, title: string) => {
        if (!confirm(`Bạn có chắc muốn xóa chương "${title}"?`)) return;
        try {
            await apiClient.delete(`/chapters/${chapterId}`);
            setStoryChapters((prev) => ({
                ...prev,
                [storyId]: (prev[storyId] || []).filter((ch) => ch.id !== chapterId),
            }));
            
            // Update total count
            setStories(prev => prev.map(s => 
                s.id === storyId 
                    ? { ...s, _count: { ...s._count, chapters: Math.max(0, (s._count?.chapters || 0) - 1) } } 
                    : s
            ));
        } catch (error) {
            console.error('Failed to delete chapter:', error);
            alert('Không thể xóa chương.');
        }
    };

    const formatDate = (dateString: string) => {
        try {
            return new Intl.DateTimeFormat('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(new Date(dateString));
        } catch (e) {
            return dateString;
        }
    };

    const getChapterAccessMeta = (chapter: { accessType?: string | null }) => {
        const accessType = chapter?.accessType || 'free';
        if (accessType === 'vip') {
            return {
                label: 'VIP',
                className: 'text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded',
            };
        }
        if (accessType === 'timed') {
            return {
                label: 'Hẹn giờ',
                className: 'text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded',
            };
        }
        if (accessType === 'ads') {
            return {
                label: 'Quảng cáo',
                className: 'text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded',
            };
        }
        return {
            label: 'Miễn phí',
            className: 'text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded',
        };
    };

    // Form chương hiện inline (đã bỏ popup) -> tự cuộn tới panel khi mở thêm/sửa chương.
    useEffect(() => {
        const id = editingChapterId ? 'chapter-edit-panel' : (isCreatingChapter ? 'chapter-create-panel' : null);
        if (!id) return;
        const t = setTimeout(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
        return () => clearTimeout(t);
    }, [editingChapterId, isCreatingChapter]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Newspaper className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Truyện
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Danh sách và thông tin chi tiết các tác phẩm trên hệ thống.</p>
                </div>
                <div className="grid w-full grid-cols-2 gap-3 md:flex md:w-auto md:items-center">
                    {/* Locale Selector */}
                    <AdminLanguageDropdown
                        languages={languages}
                        value={selectedLocale}
                        onChange={(nextKey) => {
                            setSelectedLocale(nextKey);
                            setPage(1);
                        }}
                        className="col-span-2 md:w-56"
                    />
                    <button className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-600 shadow-sm transition-all active:scale-95 hover:bg-slate-50 md:min-h-0 md:w-auto md:rounded-xl">
                        <Download className="w-4 h-4" />
                        Xuất báo cáo
                    </button>
                    <Link href={`/stories/new?lang=${selectedLocale}`} className="w-full md:w-auto">
                        <button className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 hover:bg-indigo-700 md:min-h-0 md:w-auto md:rounded-xl">
                            <Plus className="w-4 h-4" />
                            Thêm truyện mới
                        </button>
                    </Link>
                </div>
            </div>

            {/* PANEL: Edit Story (inline đầu trang, đã bỏ popup) */}
            {editingStoryId && (
                <div id="story-edit-panel" className="scroll-mt-6 bg-white rounded-[40px] shadow-sm overflow-hidden border border-slate-200">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100 flex items-center justify-center text-white">
                                <Pencil className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Chi tiết truyện</h3>
                                <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                                    {isFetchingStoryData ? 'Đang tải thông tin...' : 'Chỉnh sửa thông tin cơ bản'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setEditingStoryId(null);
                                setEditingStoryData(null);
                            }}
                            className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-8 custom-scrollbar">
                        {isFetchingStoryData ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                                <p className="text-sm font-bold text-slate-400">Đang lấy dữ liệu truyện...</p>
                            </div>
                        ) : editingStoryData && (
                            <StoryForm
                                initialData={editingStoryData}
                                selectedLocale={selectedLocale}
                                onSubmit={handleStorySubmit}
                                onCancel={() => {
                                    setEditingStoryId(null);
                                    setEditingStoryData(null);
                                }}
                                isLoading={isSubmittingStory}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Quick Stats Overlay */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng số truyện</p>
                        <p className="text-xl font-black text-slate-900">{total.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đang phát hành</p>
                        <p className="text-xl font-black text-slate-900">{stories.filter(s => s.status === 'ongoing').length} truyện</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hoàn thành</p>
                        <p className="text-xl font-black text-slate-900">{stories.filter(s => s.status === 'completed').length} truyện</p>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                    <form onSubmit={handleSearch} className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tiêu đề hoặc tác giả..."
                            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                        />
                    </form>
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-56">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={filterStatus}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-10 pr-10 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="ongoing">Đang ra (Ongoing)</option>
                                <option value="completed">Đã xong (Completed)</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stories Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Truyện</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Chương</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Lượt nghe</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Đề xuất</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Đánh giá</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Ngày tạo</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                            </tr>
                            <tr className="bg-[#ffddef]/35 border-b border-gray-200">
                                <td className="bg-gray-50/50 border-b border-gray-200 px-4 py-3">
                                    <input
                                        type="text"
                                        placeholder="Tìm tên..."
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-pink-200 focus:border-pink-300 outline-none"
                                        value={localSearch}
                                        onChange={(e) => setLocalSearch(e.target.value)}
                                    />
                                </td>
                                <td className="bg-gray-50/50 border-b border-gray-200 px-4 py-3">
                                    <select
                                        className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-pink-200 outline-none"
                                        value={searchParams.get('status') ?? 'all'}
                                        onChange={(e) => handleFilterChange('status', e.target.value)}
                                    >
                                        <option value="all">Tất cả</option>
                                        <option value="ongoing">Đang ra</option>
                                        <option value="completed">Hoàn thành</option>
                                    </select>
                                </td>
                                <td className="bg-gray-50/50 border-b border-gray-200 px-4 py-3">
                                    <div className="flex flex-col gap-1.5">
                                        <select
                                            className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-pink-200 outline-none"
                                            value={searchParams.get('sortBy') === 'chapters_count' ? (searchParams.get('sortOrder') ?? 'all') : 'all'}
                                            onChange={(e) => handleSortChange('chapters_count', e.target.value)}
                                        >
                                            <option value="all">Sắp xếp</option>
                                            <option value="desc">Nhiều -&gt; Ít</option>
                                            <option value="asc">Ít -&gt; Nhiều</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="bg-gray-50/50 border-b border-gray-200 px-4 py-3">
                                    <div className="flex flex-col gap-1.5">
                                        <select
                                            className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-pink-200 outline-none"
                                            value={searchParams.get('sortBy') === 'views' ? (searchParams.get('sortOrder') ?? 'all') : 'all'}
                                            onChange={(e) => handleSortChange('views', e.target.value)}
                                        >
                                            <option value="all">Sắp xếp</option>
                                            <option value="desc">Nhiều -&gt; Ít</option>
                                            <option value="asc">Ít -&gt; Nhiều</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="bg-gray-50/50 border-b border-gray-200 px-4 py-3">
                                    <select
                                        className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-pink-200 outline-none"
                                        value={searchParams.get('isRecommended') || searchParams.get('recommended') || 'all'}
                                        onChange={(e) => handleFilterChange('isRecommended', e.target.value)}
                                    >
                                        <option value="all">Tất cả</option>
                                        <option value="true">Có</option>
                                        <option value="false">Không</option>
                                    </select>
                                </td>
                                <td className="bg-gray-50/50 border-b border-gray-200 px-4 py-3">
                                    <select
                                        className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-pink-200 outline-none"
                                        value={searchParams.get('rating') ?? 'all'}
                                        onChange={(e) => handleFilterChange('rating', e.target.value)}
                                    >
                                        <option value="all">Tất cả</option>
                                        <option value="4">&gt;= 4 sao</option>
                                        <option value="3">&gt;= 3 sao</option>
                                        <option value="2">&gt;= 2 sao</option>
                                        <option value="1">&gt;= 1 sao</option>
                                    </select>
                                </td>
                                <td className="bg-gray-50/50 border-b border-gray-200 px-4 py-3">
                                    <input
                                        type="date"
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-pink-200 focus:border-pink-300 outline-none"
                                        value={localDate}
                                        onChange={(e) => {
                                            setLocalDate(e.target.value);
                                            handleFilterChange('date', e.target.value);
                                        }}
                                    />
                                </td>
                                <td className="bg-gray-50/50 border-b border-gray-200"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={8} className="px-8 py-6">
                                            <div className="h-12 bg-slate-50 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : stories.length > 0 ? (
                                stories.map((story) => (
                                    <React.Fragment key={story.id}>
                                        <tr 
                                            onClick={() => toggleStory(story.id)}
                                            className="group hover:bg-slate-50/50 transition-all duration-300 cursor-pointer"
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <StoryThumbnail story={story} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors" title={selectedLocale === 'en' ? (story.titleEn || story.titleVi || story.title) : (story.titleVi || story.titleEn || story.title)}>
                                                            {(() => {
                                                                const displayTitle = selectedLocale === 'en' ? (story.titleEn || story.titleVi || story.title) : (story.titleVi || story.titleEn || story.title);
                                                                return displayTitle.length > 26 ? `${displayTitle.substring(0, 26)}...` : displayTitle;
                                                            })()}
                                                        </p>
                                                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                                                            By <span className="text-slate-700">{story.author?.name}</span>
                                                        </p>
                                                        <div className="flex gap-1 mt-1.5 overflow-hidden">
                                                            {story.categories.slice(0, 2).map((c, idx) => (
                                                                <span key={idx} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md uppercase tracking-tight">
                                                                    {c.category.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border
                                                    ${story.status === 'ongoing'
                                                        ? 'bg-pink-50 text-pink-700 border-pink-100'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'}
                                                `}>
                                                    {story.status === 'ongoing' ? 'Đang ra' : 'Hoàn thành'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <p className="text-sm font-black text-slate-700">{story._count.chapters}</p>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex items-center justify-center gap-1.5 text-slate-500">
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span className="text-sm font-bold text-slate-700">{story.totalViews.toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleRecommended(story); }}
                                                    disabled={updatingRecommendId === story.id}
                                                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider transition ${story.isRecommended
                                                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} disabled:opacity-50`}
                                                >
                                                    {story.isRecommended ? 'Đang bật' : 'Đang tắt'}
                                                </button>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex items-center justify-center gap-1 text-amber-500 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 max-w-fit mx-auto">
                                                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                                                    <span className="text-xs font-black">{Number(story.averageRating || 0).toFixed(1)}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                                    {new Date(story.createdAt).toLocaleDateString()}
                                                </p>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setStoryIdForNewChapter(story.id);
                                                            setIsCreatingChapter(true);
                                                        }}
                                                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                        title="Thêm chương"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditStory(story);
                                                        }}
                                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                        title="Sửa truyện"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(story.id, story.title);
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Xóa truyện"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <ChevronDown
                                                        className={`w-5 h-5 ml-2 text-slate-400 transition-transform duration-200 ${expandedStoryId === story.id ? "rotate-180" : ""}`}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedStoryId === story.id && (
                                            <tr className="bg-slate-50/50">
                                                <td colSpan={8} className="p-0 border-b border-slate-100">
                                                    <div className="px-8 py-6 border-t border-slate-100">
                                                        {loadingChapters === story.id ? (
                                                            <div className="flex justify-center py-8">
                                                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                                            </div>
                                                        ) : (storyChapters[story.id]?.length || 0) === 0 ? (
                                                            <p className="text-center text-sm text-slate-500 py-8">Chưa có chương nào.</p>
                                                        ) : (
                                                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                                                {reorderForColumnFirstGrid(storyChapters[story.id] || [], 3).map((chapter) => (
                                                                    <div key={chapter.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-50 transition-all">
                                                                        <div className="flex min-w-0 items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">
                                                                                {chapter.chapterNumber}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-bold text-slate-900 line-clamp-2">
                                                                                    Chương {chapter.chapterNumber}: {chapter.title}
                                                                                </p>
                                                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                                                    <span className={getChapterAccessMeta(chapter).className}>
                                                                                        {getChapterAccessMeta(chapter).label}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                                        {Number(chapter.unlockPrice || 0).toLocaleString('vi-VN')} credit
                                                                                    </span>
                                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                                                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                                                        {Number(chapter.averageRating ?? story.averageRating ?? 0).toFixed(1)}
                                                                                    </span>
                                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                        <Eye className="w-3 h-3" />
                                                                                        {Number(chapter.viewCount || 0).toLocaleString('vi-VN')}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handleEditChapter(story.id, chapter)}
                                                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                                            >
                                                                                <Edit2 className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteChapter(story.id, chapter.id, chapter.title)}
                                                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-8 py-20 text-center">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <Newspaper className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Không tìm thấy truyện</h3>
                                        <p className="text-slate-500 mt-1">Vui lòng thử điều chỉnh lại bộ lọc tìm kiếm.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse p-5">
                                <div className="h-20 rounded-3xl bg-slate-50" />
                            </div>
                        ))
                    ) : stories.length > 0 ? (
                        stories.map((story) => {
                            const displayTitle = selectedLocale === 'en' ? (story.titleEn || story.titleVi || story.title) : (story.titleVi || story.titleEn || story.title);
                            return (
                                <div key={story.id} className="bg-white">
                                    <div 
                                        onClick={() => toggleStory(story.id)}
                                        className="space-y-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <div className="min-w-0 flex items-center gap-4">
                                            <StoryThumbnail story={story} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-base font-black leading-6 text-slate-900 break-words">{displayTitle}</p>
                                                <p className="mt-1 text-sm font-bold text-slate-500">
                                                    By <span className="text-slate-700">{story.author?.name}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-[72px]">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setStoryIdForNewChapter(story.id);
                                                    setIsCreatingChapter(true);
                                                }}
                                                title="Thêm chương"
                                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditStory(story);
                                                }}
                                                title="Chỉnh sửa truyện"
                                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(story.id, story.title);
                                                }}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                                                title="Xóa truyện"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <div className="flex-1" />
                                            <ChevronDown
                                                className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expandedStoryId === story.id ? "rotate-180" : ""}`}
                                            />
                                        </div>
                                    </div>
                                    {expandedStoryId === story.id && (
                                        <div className="bg-slate-50/50 border-t border-slate-100 px-5 py-4">
                                            {loadingChapters === story.id ? (
                                                <div className="flex justify-center py-6">
                                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                                </div>
                                            ) : (storyChapters[story.id]?.length || 0) === 0 ? (
                                                <p className="text-center text-sm text-slate-500 py-6">Chưa có chương nào.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {sortChaptersByNumber(storyChapters[story.id] || []).map((chapter) => (
                                                        <div key={chapter.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-900">
                                                                        Chương {chapter.chapterNumber}: {chapter.title}
                                                                    </p>
                                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                                        <span className={getChapterAccessMeta(chapter).className}>
                                                                            {getChapterAccessMeta(chapter).label}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                            {Number(chapter.unlockPrice || 0).toLocaleString('vi-VN')} credit
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                                            {Number(chapter.averageRating ?? story.averageRating ?? 0).toFixed(1)}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                            <Eye className="w-3 h-3" />
                                                                            {Number(chapter.viewCount || 0).toLocaleString('vi-VN')}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleEditChapter(story.id, chapter)}
                                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    >
                                                                        <Edit2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteChapter(story.id, chapter.id, chapter.title)}
                                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-8 py-20 text-center">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-slate-100 bg-slate-50">
                                <Newspaper className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Không tìm thấy truyện</h3>
                            <p className="mt-1 text-slate-500">Vui lòng thử điều chỉnh lại bộ lọc tìm kiếm.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-bold text-slate-500">
                        Hiển thị <span className="text-slate-900">{stories.length}</span> / <span className="text-slate-900">{total}</span> truyện
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                        >
                            Trước
                        </button>
                        {[...Array(Math.ceil(total / 20))].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i + 1)}
                                className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95
                                    ${page === i + 1 ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}
                                `}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            disabled={page >= Math.ceil(total / 20)}
                            onClick={() => setPage(page + 1)}
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                        >
                            Tiếp
                        </button>
                    </div>
                </div>
            </div>

            {/* PANEL: Create Chapter (inline, bỏ popup) */}
            {isCreatingChapter && storyIdForNewChapter && (
                <div id="chapter-create-panel" className="scroll-mt-6 mt-8 bg-white rounded-[40px] shadow-sm overflow-hidden border border-slate-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-100 flex items-center justify-center text-white">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Thêm Chương Mới</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                                        {stories.find(s => s.id === storyIdForNewChapter)?.titleVi || stories.find(s => s.id === storyIdForNewChapter)?.titleEn || stories.find(s => s.id === storyIdForNewChapter)?.title}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsCreatingChapter(false);
                                    setStoryIdForNewChapter(null);
                                }}
                                className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 custom-scrollbar">
                            <ChapterForm
                                initialData={{
                                    chapterNumber: (storyChapters[storyIdForNewChapter]?.length || 0) + 1,
                                    titleVi: '',
                                    descriptionVi: '',
                                    contentVi: '',
                                    accessType: 'free',
                                    storyId: storyIdForNewChapter,
                                }}
                                selectedLocale={selectedLocale}
                                onSubmit={handleChapterCreateSubmit}
                                onCancel={() => {
                                    setIsCreatingChapter(false);
                                    setStoryIdForNewChapter(null);
                                }}
                                isLoading={isSubmittingNewChapter}
                            />
                        </div>
                </div>
            )}

            {/* PANEL: Edit Chapter (inline, bỏ popup) */}
            {editingChapterId && editingChapterData && (
                <div id="chapter-edit-panel" className="scroll-mt-6 mt-8 bg-white rounded-[40px] shadow-sm overflow-hidden border border-slate-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100 flex items-center justify-center text-white">
                                    <Edit2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Chi tiết chương</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                                        Chỉnh sửa nội dung chương
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingChapterId(null);
                                    setEditingChapterData(null);
                                }}
                                className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 custom-scrollbar">
                            <ChapterForm
                                initialData={editingChapterData}
                                selectedLocale={selectedLocale}
                                onSubmit={handleChapterSubmit}
                                onCancel={() => {
                                    setEditingChapterId(null);
                                    setEditingChapterData(null);
                                }}
                                isLoading={isSubmittingChapter}
                            />
                        </div>
                </div>
            )}
        </div>
    );
}
