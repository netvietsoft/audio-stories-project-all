"use client";

import React, { useState, useEffect } from 'react';
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

interface Story {
    id: string;
    title: string;
    titleVi?: string;
    titleEn?: string;
    slug: string;
    thumbnailUrl: string | null;
    status: 'ongoing' | 'completed';
    isRecommended: boolean;
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
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedLocale, setSelectedLocale] = useState('vi');
    const { languages } = useAdminLanguages();
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [updatingRecommendId, setUpdatingRecommendId] = useState<string | null>(null);

    // Modal States
    const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
    const [editingStoryData, setEditingStoryData] = useState<any | null>(null);
    const [isFetchingStoryData, setIsFetchingStoryData] = useState(false);
    const [isSubmittingStory, setIsSubmittingStory] = useState(false);

    const [chaptersModalOpen, setChaptersModalOpen] = useState(false);
    const [selectedStoryForChapters, setSelectedStoryForChapters] = useState<Story | null>(null);
    const [chapters, setChapters] = useState<any[]>([]);
    const [isFetchingChapters, setIsFetchingChapters] = useState(false);

    const [isCreatingChapter, setIsCreatingChapter] = useState(false);
    const [isSubmittingNewChapter, setIsSubmittingNewChapter] = useState(false);

    useEffect(() => {
        fetchStories();
    }, [page, filterStatus, selectedLocale]);

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
            const res = await apiClient.get(`/stories/admin?${params.toString()}`);
            setStories(res.data.data);
            setTotal(res.data.meta.total);
        } catch (error) {
            console.error('Failed to fetch stories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchStories();
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
        setIsFetchingStoryData(true);
        try {
            const res = await apiClient.get(`/stories/admin/${story.id}`);
            const data = res.data;
            
            const mappedData = {
                ...data,
                titleVi: data.titleVi || data.title || "",
                titleEn: data.titleEn || "",
                slug: data.slug || "",
                descriptionVi: data.descriptionVi || data.description || "",
                descriptionEn: data.descriptionEn || "",
                categoryIds: (data.categories || []).map((item: any) => 
                    item.category?.id || item.categoryId || (typeof item === 'number' ? item : item.id)
                ).filter(Boolean),
                authorId: data.author?.id || data.authorId,
                status: data.status || "ongoing",
                isInteractive: !!data.isInteractive,
                isRecommended: !!data.isRecommended,
            };
            
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

    const handleOpenChapters = async (story: Story) => {
        setSelectedStoryForChapters(story);
        setChaptersModalOpen(true);
        setIsFetchingChapters(true);
        try {
            const res = await apiClient.get(`/chapters?storyId=${story.id}&limit=100`);
            setChapters(res.data.data || res.data || []);
        } catch (error) {
            console.error('Failed to fetch chapters:', error);
            alert('Không thể tải danh sách chương.');
        } finally {
            setIsFetchingChapters(false);
        }
    };

    const handleChapterCreateSubmit = async (data: any) => {
        if (!selectedStoryForChapters) return;
        setIsSubmittingNewChapter(true);
        try {
            await apiClient.post(`/stories/${selectedStoryForChapters.id}/chapters`, data);
            setIsCreatingChapter(false);
            
            // Refresh chapters list
            const res = await apiClient.get(`/chapters?storyId=${selectedStoryForChapters.id}&limit=100`);
            setChapters(res.data.data || res.data || []);
        } catch (error) {
            console.error('Failed to create chapter:', error);
            alert('Không thể tạo chương mới.');
        } finally {
            setIsSubmittingNewChapter(false);
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
                    <Link href={`/admin/stories/new?lang=${selectedLocale}`} className="w-full md:w-auto">
                        <button className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 hover:bg-indigo-700 md:min-h-0 md:w-auto md:rounded-xl">
                            <Plus className="w-4 h-4" />
                            Thêm truyện mới
                        </button>
                    </Link>
                </div>
            </div>

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
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </form>
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-56">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={filterStatus}
                                onChange={(e) => {
                                    setFilterStatus(e.target.value);
                                    setPage(1);
                                }}
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
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Ngôn ngữ</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Chương</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Lượt nghe</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Đề xuất</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Đánh giá</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Ngày tạo</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
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
                                    <tr key={story.id} className="group hover:bg-slate-50/50 transition-all duration-300">
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
                                                        By <span className="text-slate-700">{story.author.name}</span>
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
                                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border
                                                ${story.language === 'vi'
                                                    ? 'bg-red-50 text-red-700 border-red-100'
                                                    : 'bg-indigo-50 text-indigo-700 border-indigo-100'}
                                            `}>
                                                {story.language === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
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
                                                disabled={updatingRecommendId === story.id}
                                                onClick={() => void toggleRecommended(story)}
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
                                                <span className="text-xs font-black">{Number(story.averageRating).toFixed(1)}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                                {formatDate(story.createdAt)}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenChapters(story)}
                                                    title="Danh sách chương"
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <Music className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEditStory(story)}
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(story.id, story.title)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>

                                    </tr>
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
                                <div key={story.id} className="space-y-4 p-5">
                                    <div className="min-w-0 flex items-center gap-4">
                                        <StoryThumbnail story={story} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-base font-black leading-6 text-slate-900 break-words">{displayTitle}</p>
                                            <p className="mt-1 text-sm font-bold text-slate-500">
                                                By <span className="text-slate-700">{story.author.name}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-[72px]">
                                        <button
                                            onClick={() => handleOpenChapters(story)}
                                            title="Danh sách chương"
                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                        >
                                            <Music className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEditStory(story)}
                                            title="Chỉnh sửa truyện"
                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(story.id, story.title)}
                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                                            title="Xóa truyện"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
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

            {/* MODAL: Edit Story */}
            {editingStoryId && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] max-w-5xl w-full max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-100 flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
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
                        
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
                </div>
            )}

            {/* MODAL: Chapters List */}
            {chaptersModalOpen && selectedStoryForChapters && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[32px] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-white border-b border-slate-100 px-8 py-6 rounded-t-[32px] flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                            <Music className="w-5 h-5" />
                                        </div>
                                        Danh sách chương
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {selectedStoryForChapters.titleVi || selectedStoryForChapters.titleEn || selectedStoryForChapters.title}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsCreatingChapter(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                                        title="Thêm chương mới"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Thêm chương mới
                                    </button>
                                    <button
                                        onClick={() => {
                                            setChaptersModalOpen(false);
                                            setSelectedStoryForChapters(null);
                                            setChapters([]);
                                        }}
                                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                            {isFetchingChapters ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                </div>
                            ) : chapters.length > 0 ? (
                                <div className="space-y-3">
                                    {chapters.map((chapter: any) => (
                                        <div key={chapter.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black">
                                                    {chapter.chapterNumber}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">
                                                        {chapter.title || chapter.titleVi || chapter.titleEn || `Chương ${chapter.chapterNumber}`}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {chapter.accessType === 'free' ? 'Miễn phí' : `${chapter.unlockPrice || 0} credits`}
                                                    </p>
                                                </div>
                                                <Link
                                                    href={`/admin/chapters/${chapter.id}`}
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Music className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 mb-1">Chưa có chương</h3>
                                    <p className="text-sm text-slate-500">Truyện này chưa có chương nào.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="px-8 py-5 border-t border-slate-100 bg-white rounded-b-[32px] flex items-center justify-between">
                            <p className="text-xs font-medium text-slate-400">
                                Tổng số: {chapters.length} chương
                            </p>
                            <Link
                                href={`/admin/stories/${selectedStoryForChapters.id}/chapters`}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                            >
                                Quản lý chi tiết
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Create Chapter */}
            {isCreatingChapter && selectedStoryForChapters && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] max-w-5xl w-full max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-100 flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-100 flex items-center justify-center text-white">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Thêm Chương Mới</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                                        {selectedStoryForChapters.titleVi || selectedStoryForChapters.titleEn || selectedStoryForChapters.title}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsCreatingChapter(false);
                                }}
                                className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <ChapterForm
                                initialData={{
                                    chapterNumber: chapters.length + 1,
                                    titleVi: '',
                                    descriptionVi: '',
                                    contentVi: '',
                                    accessType: 'free',
                                    storyId: selectedStoryForChapters.id,
                                }}
                                selectedLocale={selectedLocale}
                                onSubmit={handleChapterCreateSubmit}
                                onCancel={() => {
                                    setIsCreatingChapter(false);
                                }}
                                isLoading={isSubmittingNewChapter}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



