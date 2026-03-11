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

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { UploadButton } from '@/lib/uploadthing';

const storySchema = z.object({

    title: z.string().min(1, 'Tiêu đề không được để trống'),
    slug: z.string().min(1, 'Slug không được để trống'),
    description: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    authorId: z.string().uuid('Vui lòng chọn tác giả'),
    status: z.enum(['ongoing', 'completed']),
    language: z.enum(['vi', 'en']),
    categoryIds: z.array(z.number()).min(1, 'Chọn ít nhất một thể loại'),
    audioUrl: z.string().optional(),
    isRecommended: z.boolean().optional(),
});


type StoryFormValues = z.infer<typeof storySchema>;

interface Category {
    id: number;
    name: string;
}

interface Chapter {
    id: string;
    chapterNumber: number;
    title: string;
    storyId?: string | null;
}

interface Author {
    id: string;
    name: string;
}

interface StoryFormProps {
    initialData?: Partial<StoryFormValues> & { id?: string };
    onSubmit: (data: StoryFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const StoryForm = ({ initialData, onSubmit, onCancel, isLoading }: StoryFormProps) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [authors, setAuthors] = useState<Author[]>([]);
    const [isFetchingMeta, setIsFetchingMeta] = useState(true);
    const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

    // Available chapters for selection (all chapters in system)
    const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
    const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

    // Searchable Select States
    const [isAuthorOpen, setIsAuthorOpen] = useState(false);
    const [authorSearch, setAuthorSearch] = useState('');
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isChapterOpen, setIsChapterOpen] = useState(false);
    const [chapterSearch, setChapterSearch] = useState('');

    const authorRef = React.useRef<HTMLDivElement>(null);
    const categoryRef = React.useRef<HTMLDivElement>(null);
    const chapterRef = React.useRef<HTMLDivElement>(null);

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
            language: 'vi',
            categoryIds: [],
            isRecommended: false,
            ...initialData,
        },
    });

    const title = watch('title');
    const selectedAuthorId = watch('authorId');
    const selectedCategoryIds = watch('categoryIds') || [];

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [catsRes, authorsRes, allChaptersRes] = await Promise.all([
                    apiClient.get('/stories/categories'),
                    apiClient.get('/stories/authors'),
                    apiClient.get('/chapters?limit=1000'), // Fetch all available chapters
                ]);
                setCategories(catsRes.data);
                setAuthors(authorsRes.data);
                setAvailableChapters(allChaptersRes.data.data);

                if (initialData?.id) {
                    const chapsRes = await apiClient.get(`/stories/${initialData.id}/chapters`);
                    setChapters(chapsRes.data);
                    setSelectedChapterIds(chapsRes.data.map((c: Chapter) => c.id));
                }
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
            if (chapterRef.current && !chapterRef.current.contains(event.target as Node)) {
                setIsChapterOpen(false);
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

            // Include selected chapter IDs for new stories
            if (!initialData?.id && selectedChapterIds.length > 0) {
                (finalData as any).chapterIds = selectedChapterIds;
            }

            await onSubmit(finalData);
        } catch (error) {
            console.error('Failed to submit story:', error);
            alert('Có lỗi xảy ra khi lưu truyện. Vui lòng thử lại.');
        } finally {
            setIsUploadingThumbnail(false);
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

    const filteredChapters = initialData?.id
        ? chapters.filter(c =>
            c.title.toLowerCase().includes(chapterSearch.toLowerCase()) || c.chapterNumber.toString().includes(chapterSearch)
        )
        : availableChapters.filter(c =>
            (c.title.toLowerCase().includes(chapterSearch.toLowerCase()) || c.chapterNumber.toString().includes(chapterSearch)) &&
            !c.storyId // Only show chapters not assigned to any story
        );

    const selectedChapters = availableChapters.filter(c => selectedChapterIds.includes(c.id));

    const handleChapterToggle = (chapterId: string) => {
        if (selectedChapterIds.includes(chapterId)) {
            setSelectedChapterIds(prev => prev.filter(id => id !== chapterId));
        } else {
            setSelectedChapterIds(prev => [...prev, chapterId]);
        }
    };

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

                    {/* Hàng 2: Input slug, trạng thái và ngôn ngữ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ngôn ngữ</label>
                            <div className="relative">
                                <select
                                    {...register('language')}
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="vi">Tiếng Việt</option>
                                    <option value="en">English</option>
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            {errors.language && <p className="text-xs font-bold text-red-500 ml-2">{errors.language.message}</p>}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <label className="flex cursor-pointer items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-black uppercase tracking-wider text-slate-700">Đề xuất ở trang đọc</p>
                                <p className="mt-1 text-xs font-medium text-slate-500">Bật để truyện xuất hiện trong slider "Có thể bạn sẽ thích".</p>
                            </div>
                            <input type="checkbox" {...register('isRecommended')} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        </label>
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
                                <Plus className="w-4 h-4 text-blue-600" />
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
                                <Plus className="w-4 h-4 text-blue-600" />
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

                    {/* Hàng 5: Quản lý chương */}
                    <div className="space-y-4" ref={chapterRef}>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Chương</label>
                            {initialData?.id ? (
                                <Link
                                    href={`/admin/stories/${initialData.id}/chapters`}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Quản lý / Thêm chương"
                                >
                                    <Plus className="w-5 h-5 text-blue-600" />
                                </Link>
                            ) : (
                                <Link
                                    href="/admin/chapters"
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Quản lý chương"
                                >
                                    <Plus className="w-5 h-5 text-blue-600" />
                                </Link>
                            )}
                        </div>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsChapterOpen(!isChapterOpen)}
                                className="w-full bg-slate-50 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all flex items-center justify-between min-h-[56px]"
                            >
                                <div className="flex flex-wrap gap-2">
                                    {selectedChapterIds.length > 0 ? (
                                        <span className="text-slate-700">
                                            {initialData?.id 
                                                ? `Đã có ${chapters.length} chương` 
                                                : `Đã chọn ${selectedChapterIds.length} chương`}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">
                                            {initialData?.id ? 'Xem danh sách chương' : 'Chọn chương có sẵn'}
                                        </span>
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isChapterOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isChapterOpen && (
                                <div className="absolute z-20 top-full left-0 w-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-slate-100">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Tìm theo tên hoặc số chương..."
                                                className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                value={chapterSearch}
                                                onChange={(e) => setChapterSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {filteredChapters.length > 0 ? (
                                            filteredChapters.map((chap: Chapter) => (
                                                initialData?.id ? (
                                                    <Link
                                                        key={chap.id}
                                                        href={`/admin/stories/${initialData.id}/chapters`}
                                                        className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-between group block"
                                                    >
                                                        <span>Chương {chap.chapterNumber}: {chap.title}</span>
                                                        <Music className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                                                    </Link>
                                                ) : (
                                                    <button
                                                        key={chap.id}
                                                        type="button"
                                                        onClick={() => handleChapterToggle(chap.id)}
                                                        className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-between group"
                                                    >
                                                        <span>Chương {chap.chapterNumber}: {chap.title}</span>
                                                        {selectedChapterIds.includes(chap.id) && (
                                                            <Check className="w-4 h-4 text-indigo-600" />
                                                        )}
                                                    </button>
                                                )
                                            ))
                                        ) : (
                                            <div className="px-6 py-4 text-sm font-medium text-slate-400 italic">
                                                {initialData?.id 
                                                    ? 'Không tìm thấy chương nào' 
                                                    : 'Không có chương chưa gán. Vui lòng tạo chương mới tại trang Quản lý Chương.'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Display selected chapters for new story */}
                        {!initialData?.id && selectedChapters.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Các chương đã chọn:</p>
                                <div className="space-y-2">
                                    {selectedChapters.map((chap) => (
                                        <div
                                            key={chap.id}
                                            className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5"
                                        >
                                            <span className="text-sm font-bold text-indigo-900">
                                                Chương {chap.chapterNumber}: {chap.title}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleChapterToggle(chap.id)}
                                                className="p-1 text-indigo-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Bỏ chọn"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Story Introduction */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giới thiệu truyện</label>
                        <textarea
                            {...register('description')}
                            rows={5}
                            placeholder="Nhập giới thiệu về truyện..."
                            className="w-full bg-slate-50 border-none rounded-[24px] py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                        />
                    </div>

                    {/* Thumbnail Upload using UploadThing - Redesigned */}
                    <div className="space-y-4">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ảnh bìa (Thumbnail)</label>

                        {watch('thumbnailUrl') ? (
                            <div className="relative group w-full aspect-[2/3] md:w-48 overflow-hidden rounded-[32px] border-4 border-white shadow-2xl transition-transform hover:scale-[1.02] mx-auto md:mx-0">
                                <img src={watch('thumbnailUrl')} alt="Thumbnail" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setValue('thumbnailUrl', '')}
                                    className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-sm text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-black/10"
                                    title="Xóa ảnh hiện tại"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative group">
                                <UploadButton
                                    endpoint="imageUploader"
                                    onUploadProgress={() => setIsUploadingThumbnail(true)}
                                    onClientUploadComplete={async (res) => {
                                        setIsUploadingThumbnail(false);
                                        if (res && res[0]) {
                                            const newUrl = res[0].url;
                                            setValue('thumbnailUrl', newUrl);
                                        }
                                    }}
                                    onUploadError={(error: Error) => {
                                        setIsUploadingThumbnail(false);
                                        alert(`Lỗi tải ảnh: ${error.message}`);
                                    }}
                                    appearance={{
                                        container: {
                                            width: "100%",
                                        },
                                        button({ ready, isUploading }) {
                                            return {
                                                width: "100%",
                                                minHeight: "160px",
                                                backgroundColor: "#f8fafc", // bg-slate-50
                                                border: "2px dashed #e2e8f0", // border-slate-200
                                                borderRadius: "24px",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "12px",
                                                color: "#334155", // text-slate-700
                                                transition: "all 0.2s",
                                                cursor: "pointer",
                                                fontSize: "0px", // Hide default browser file text
                                                ...(isUploading ? { opacity: 0.7, cursor: "not-allowed" } : {}),
                                            };
                                        },
                                        allowedContent: {
                                            display: "none"
                                        }
                                    }}
                                    content={{
                                        button({ isUploading }) {
                                            if (isUploading) return (
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                                    <span className="text-sm font-bold">Đang tải ảnh...</span>
                                                </div>
                                            );
                                            return (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                                        <Upload className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Click để chọn ảnh bìa</p>
                                                        <p className="text-xs font-medium text-slate-400 mt-1">Hỗ trợ tất cả định dạng ảnh (Tối đa 4MB)</p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    }}
                                />
                                <input {...register('thumbnailUrl')} type="hidden" />
                            </div>
                        )}
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
                        disabled={isLoading || isUploadingThumbnail}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 flex items-center gap-3 disabled:opacity-50"
                    >
                        {isLoading || isUploadingThumbnail ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isUploadingThumbnail ? 'Đang tải ảnh...' : 'Lưu truyện'}
                    </button>
                </div>
            </div>


        </form>
    );
};
