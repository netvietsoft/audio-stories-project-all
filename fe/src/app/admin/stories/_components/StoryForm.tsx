"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Loader2,
    Save,
    X,
    Upload,
    Image as ImageIcon,
    ChevronDown,
    Search,
    Check,
    Plus,
    Music,
    Trash2,
} from 'lucide-react';
import Link from 'next/link';

import { apiClient } from '@/lib/api/api-client';

const storySchema = z.object({

    title: z.string().min(1, 'Tiêu đề không được để trống'),
    slug: z.string().min(1, 'Slug không được để trống'),
    description: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    authorId: z.string().uuid('Vui lòng chọn tác giả'),
    status: z.enum(['ongoing', 'completed']),
    categoryIds: z.array(z.number()).min(1, 'Chọn ít nhất một thể loại'),
    audioUrl: z.string().optional(),
});


type StoryFormValues = z.infer<typeof storySchema>;

interface Category {
    id: number;
    name: string;
}

interface Author {
    id: string;
    name: string;
}

interface StoryFormProps {
    initialData?: Partial<StoryFormValues>;
    onSubmit: (data: StoryFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const StoryForm = ({ initialData, onSubmit, onCancel, isLoading }: StoryFormProps) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [authors, setAuthors] = useState<Author[]>([]);
    const [isFetchingMeta, setIsFetchingMeta] = useState(true);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);


    // Searchable Select States
    const [isAuthorOpen, setIsAuthorOpen] = useState(false);
    const [authorSearch, setAuthorSearch] = useState('');
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');

    const authorRef = React.useRef<HTMLDivElement>(null);
    const categoryRef = React.useRef<HTMLDivElement>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<StoryFormValues>({
        resolver: zodResolver(storySchema),
        defaultValues: {
            title: '',
            slug: '',
            description: '',
            thumbnailUrl: '',
            status: 'ongoing',
            categoryIds: [],
            ...initialData,
        },
    });

    const title = watch('title');
    const selectedAuthorId = watch('authorId');
    const selectedCategoryIds = watch('categoryIds') || [];

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [catsRes, authorsRes] = await Promise.all([
                    apiClient.get('/stories/categories'),
                    apiClient.get('/stories/authors'),
                ]);
                setCategories(catsRes.data);
                setAuthors(authorsRes.data);
            } catch (error) {
                console.error('Failed to fetch metadata:', error);
            } finally {
                setIsFetchingMeta(false);
            }
        };
        fetchMetadata();
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (authorRef.current && !authorRef.current.contains(event.target as Node)) {
                setIsAuthorOpen(false);
            }
            if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
                setIsCategoryOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Simple slugify for FE
    useEffect(() => {
        if (!initialData?.slug && title) {
            const generatedSlug = title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[đĐ]/g, 'd')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
            setValue('slug', generatedSlug);
        }
    }, [title, setValue, initialData]);

    const handleFormSubmit = async (values: StoryFormValues) => {
        try {
            let finalData = { ...values };

            if (audioFile) {
                setIsUploadingAudio(true);
                const formData = new FormData();
                formData.append('file', audioFile);

                const uploadRes = await apiClient.post('/stories/upload-audio', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                finalData.audioUrl = uploadRes.data.url;
            }

            await onSubmit(finalData);
        } catch (error) {
            console.error('Failed to submit story:', error);
            alert('Có lỗi xảy ra khi lưu truyện. Vui lòng thử lại.');
        } finally {
            setIsUploadingAudio(false);
        }
    };


    const handleCategoryToggle = (id: number) => {
        if (selectedCategoryIds.includes(id)) {
            setValue('categoryIds', selectedCategoryIds.filter(c => c !== id));
        } else {
            setValue('categoryIds', [...selectedCategoryIds, id]);
        }
    };

    const filteredAuthors = authors.filter(a =>
        a.name.toLowerCase().includes(authorSearch.toLowerCase())
    );

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(categorySearch.toLowerCase())
    );

    const selectedAuthor = authors.find(a => a.id === selectedAuthorId);

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 max-w-4xl mx-auto">

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 space-y-8">
                    {/* Hàng 1: Tên truyện nguyên 1 hàng */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tiêu đề truyện</label>
                        <input
                            {...register('title')}
                            placeholder="Nhập tên truyện..."
                            className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                        {errors.title && <p className="text-xs font-bold text-red-500 ml-2">{errors.title.message}</p>}
                    </div>

                    {/* Hàng 2: Input slug và chọn trạng thái */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Slug (URL)</label>
                            <input
                                {...register('slug')}
                                placeholder="ten-truyen-slug..."
                                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            />
                            {errors.slug && <p className="text-xs font-bold text-red-500 ml-2">{errors.slug.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Trạng thái</label>
                            <div className="relative">
                                <select
                                    {...register('status')}
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="ongoing">Đang ra (Ongoing)</option>
                                    <option value="completed">Hoàn thành (Completed)</option>
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Hàng 3: Chọn tác giả nguyên 1 hàng (Searchable Dropdown) */}
                    <div className="space-y-2" ref={authorRef}>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tác giả</label>
                            <Link
                                href="/admin/authors"
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Quản lý tác giả"
                            >
                                <Plus className="w-4 h-4" />
                            </Link>
                        </div>
                        <div className="relative">

                            <button
                                type="button"
                                onClick={() => setIsAuthorOpen(!isAuthorOpen)}
                                className="w-full bg-slate-50 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all flex items-center justify-between"
                            >
                                <span className={selectedAuthor ? 'text-slate-900' : 'text-slate-400'}>
                                    {selectedAuthor ? selectedAuthor.name : 'Chọn tác giả'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAuthorOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isAuthorOpen && (
                                <div className="absolute z-20 top-full left-0 w-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-slate-100">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Tìm tên tác giả..."
                                                className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                value={authorSearch}
                                                onChange={(e) => setAuthorSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {filteredAuthors.length > 0 ? (
                                            filteredAuthors.map(a => (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setValue('authorId', a.id);
                                                        setIsAuthorOpen(false);
                                                        setAuthorSearch('');
                                                    }}
                                                    className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-between group"
                                                >
                                                    {a.name}
                                                    {selectedAuthorId === a.id && <Check className="w-4 h-4 text-indigo-600" />}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-6 py-4 text-sm font-medium text-slate-400 italic">
                                                Không tìm thấy tác giả nào
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {errors.authorId && <p className="text-xs font-bold text-red-500 ml-2">{errors.authorId.message}</p>}
                    </div>

                    {/* Hàng 4: Chọn thể loại (Searchable Dropdown) */}
                    <div className="space-y-4" ref={categoryRef}>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Thể loại</label>
                            <Link
                                href="/admin/categories"
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Quản lý thể loại"
                            >
                                <Plus className="w-4 h-4" />
                            </Link>
                        </div>
                        <div className="relative">

                            <button
                                type="button"
                                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                className="w-full bg-slate-50 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all flex items-center justify-between min-h-[56px]"
                            >
                                <div className="flex flex-wrap gap-2">
                                    {selectedCategoryIds.length > 0 ? (
                                        selectedCategoryIds.map(id => {
                                            const cat = categories.find(c => c.id === id);
                                            return cat ? (
                                                <span key={id} className="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-lg uppercase tracking-wider">
                                                    {cat.name}
                                                </span>
                                            ) : null;
                                        })
                                    ) : (
                                        <span className="text-slate-400 font-bold">Chọn thể loại (có thể chọn nhiều)</span>
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isCategoryOpen && (
                                <div className="absolute z-20 top-full left-0 w-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-slate-100">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Tìm thể loại..."
                                                className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                value={categorySearch}
                                                onChange={(e) => setCategorySearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {filteredCategories.length > 0 ? (
                                            filteredCategories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => handleCategoryToggle(cat.id)}
                                                    className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-between group"
                                                >
                                                    {cat.name}
                                                    {selectedCategoryIds.includes(cat.id) && <Check className="w-4 h-4 text-indigo-600" />}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-6 py-4 text-sm font-medium text-slate-400 italic">
                                                Không tìm thấy thể loại nào
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {errors.categoryIds && <p className="text-xs font-bold text-red-500 ml-2">{errors.categoryIds.message}</p>}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Mô tả chi tiết</label>
                        <textarea
                            {...register('description')}
                            rows={5}
                            placeholder="Nhập giới thiệu về truyện..."
                            className="w-full bg-slate-50 border-none rounded-[24px] py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                        />
                    </div>

                    {/* Thumbnail URL */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ảnh bìa (Thumbnail URL)</label>
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <input
                                    {...register('thumbnailUrl')}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>
                            <div className="w-24 h-32 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                                {watch('thumbnailUrl') ? (
                                    <img src={watch('thumbnailUrl')} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-slate-300" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Audio Upload */}
                    <div className="space-y-4">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Audio File (MP3/WAV)</label>
                        <div className="flex flex-col gap-4">
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    id="audio-upload"
                                />
                                <label
                                    htmlFor="audio-upload"
                                    className="flex flex-col items-center justify-center w-full min-h-[140px] px-6 py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-50/30 transition-all group"
                                >
                                    {audioFile ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
                                                <Music className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-slate-900 line-clamp-1">{audioFile.name}</p>
                                                <p className="text-xs font-medium text-slate-400">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                                <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-slate-700">Click để chọn file âm thanh</p>
                                                <p className="text-xs font-medium text-slate-400">Hỗ trợ file MP3, WAV (Tối đa 50MB)</p>
                                            </div>
                                        </div>
                                    )}
                                </label>
                                {audioFile && (
                                    <button
                                        type="button"
                                        onClick={() => setAudioFile(null)}
                                        className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-red-500 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                                        title="Xóa file đã chọn"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {watch('audioUrl') && !audioFile && (
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500 rounded-lg text-white">
                                        <Check className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Đã có audio URL</p>
                                        <p className="text-sm font-medium text-emerald-600 truncate">{watch('audioUrl')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                {/* Footer Actions */}
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest flex items-center gap-2"
                    >
                        <X className="w-4 h-4" />
                        Hủy
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || isUploadingAudio}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 flex items-center gap-3 disabled:opacity-50"
                    >
                        {isLoading || isUploadingAudio ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isUploadingAudio ? 'Đang tải audio...' : 'Lưu truyện'}
                    </button>
                </div>
            </div>
        </form>
    );
};
