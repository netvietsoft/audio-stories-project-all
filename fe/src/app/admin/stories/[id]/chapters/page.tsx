"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ChevronLeft,
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    X,
    Music,
    Youtube,
    Lock,
    Clock,
    BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/api-client';
import { ChapterForm } from './_components/ChapterForm';

interface Chapter {
    id: string;
    chapterNumber: number;
    title: string;
    description: string | null;
    content: string | null;
    r2AudioUrl: string | null;
    youtubeVideoId: string | null;
    audioDuration: number | null;
    accessType: 'free' | 'timed' | 'vip';
    createdAt: string;
}

interface Story {
    id: string;
    title: string;
}

export default function ChaptersPage() {
    const params = useParams();
    const router = useRouter();
    const storyId = params.id as string;

    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [story, setStory] = useState<Story | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchStory();
        fetchChapters();
    }, [storyId]);

    const fetchStory = async () => {
        try {
            const res = await apiClient.get(`/stories/admin?search=${storyId}`);
            // Assuming we can find the story in the list or have a direct endpoint
            // For now, let's try to get detail by ID if exists, or use stories list
            const stories = res.data.data;
            const currentStory = stories.find((s: any) => s.id === storyId);
            if (currentStory) setStory(currentStory);
        } catch (error) {
            console.error('Failed to fetch story:', error);
        }
    };

    const fetchChapters = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get(`/stories/${storyId}/chapters`);
            setChapters(res.data);
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
        if (!window.confirm('Bạn có chắc chắn muốn xóa chương này?')) return;

        try {
            await apiClient.delete(`/chapters/${id}`);
            setChapters(chapters.filter(c => c.id !== id));
        } catch (error) {
            console.error('Failed to delete chapter:', error);
        }
    };

    const handleSubmit = async (data: any) => {
        setIsSubmitting(true);
        try {
            if (editingChapter) {
                const updatePayload = {
                    chapterNumber: data.chapterNumber,
                    title: data.title,
                    description: data.description || undefined,
                    content: data.content || undefined,
                    audioUrl: data.audioUrl || undefined,
                    thumbnailUrl: data.thumbnailUrl || undefined,
                    youtubeVideoId: data.youtubeVideoId || undefined,
                    audioDuration: typeof data.audioDuration === 'number' ? data.audioDuration : undefined,
                    accessType: data.accessType,
                };
                await apiClient.patch(`/chapters/${editingChapter.id}`, updatePayload);
            } else {
                const createPayload = {
                    chapterNumber: data.chapterNumber,
                    title: data.title,
                    description: data.description || undefined,
                    content: data.content || undefined,
                    audioUrl: data.audioUrl || undefined,
                    thumbnailUrl: data.thumbnailUrl || undefined,
                    youtubeVideoId: data.youtubeVideoId || undefined,
                    audioDuration: typeof data.audioDuration === 'number' ? data.audioDuration : undefined,
                    accessType: data.accessType,
                };
                await apiClient.post(`/stories/${storyId}/chapters`, createPayload);
            }

            await fetchChapters();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save chapter:', error);
            alert('Không thể lưu chương. Vui lòng kiểm tra dữ liệu (đặc biệt URL audio) và thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredChapters = chapters.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.chapterNumber.toString().includes(searchTerm)
    );

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/stories"
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Danh sách chương
                        </h1>
                        <p className="text-indigo-600 font-bold text-sm tracking-wide uppercase mt-1">
                            {story?.title || 'Đang tải...'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                >
                    <Plus className="w-4 h-4" />
                    Thêm chương mới
                </button>
            </div>

            {/* Search */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm theo tiêu đề hoặc số chương..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Chapters Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-24">#</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tiêu đề chương</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Audio / Thống kê</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Loại</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-8 py-6">
                                            <div className="h-12 bg-slate-50 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredChapters.length > 0 ? (
                                filteredChapters.map((chapter) => (
                                    <tr key={chapter.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-5 text-center">
                                            <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                                                {chapter.chapterNumber}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900">{chapter.title}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                {chapter.r2AudioUrl ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                        <Music className="w-3 h-3" /> UploadThing Audio
                                                    </span>
                                                ) : chapter.youtubeVideoId ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                                        <Youtube className="w-3 h-3" /> YouTube
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                        No Audio
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatDuration(chapter.audioDuration)}
                                                </div>
                                                {chapter.content && (
                                                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-500">
                                                        <BookOpen className="w-3.5 h-3.5" />
                                                        Có văn bản ({chapter.content.length} ký tự)
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            {chapter.accessType === 'vip' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                                    <Lock className="w-3 h-3" /> VIP
                                                </span>
                                            ) : chapter.accessType === 'timed' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                    <Clock className="w-3 h-3" /> Timed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                    Free
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => handleEdit(chapter)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(chapter.id)}
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
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <Music className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Chưa có chương nào</h3>
                                        <p className="text-slate-500 mt-1">Bắt đầu bằng cách thêm chương đầu tiên cho truyện này.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Create/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">
                                    {editingChapter ? 'Chỉnh sửa Chương' : 'Thêm Chương Mới'}
                                </h2>
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">
                                    {story?.title}
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
                                    title: editingChapter.title,
                                    description: editingChapter.description ?? undefined,
                                    content: editingChapter.content ?? undefined,
                                    r2AudioUrl: editingChapter.r2AudioUrl ?? undefined,
                                    audioUrl: editingChapter.r2AudioUrl ?? undefined,
                                    thumbnailUrl: editingChapter.thumbnailUrl ?? undefined,
                                    youtubeVideoId: editingChapter.youtubeVideoId ?? undefined,
                                    audioDuration: editingChapter.audioDuration ?? 0,
                                    accessType: editingChapter.accessType,
                                } : {}}
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
