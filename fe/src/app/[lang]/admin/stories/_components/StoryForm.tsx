"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Loader2,
    Save,
    X,
    ChevronDown,
    Search,
    Check,
    Plus,
    Music,
    Trash2,
    Facebook,
} from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import type { Category, Chapter, Author, StorySubmitPayload } from '@/types/admin';
import { AuthorForm } from '../../authors/_components/AuthorForm';
import { CategoryForm } from '../../categories/_components/CategoryForm';

const storySchema = z.object({
    titleVi: z.string().optional(),
    titleEn: z.string().optional(),
    slug: z.string().min(1, 'Slug không được để trống'),
    descriptionVi: z.string().optional(),
    descriptionEn: z.string().optional(),
    thumbnailUrl: z.string().optional().nullable(),
    authorId: z.string().uuid('Vui lòng chọn tác giả'),
    status: z.enum(['ongoing', 'completed']),
    categoryIds: z.array(z.number()).min(1, 'Chọn ít nhất một thể loại'),
    audioUrl: z.string().optional().nullable(),
    isRecommended: z.boolean().optional(),
    isInteractive: z.boolean().optional(),
    language: z.string().optional(),
}).refine((data) => data.titleVi || data.titleEn, {
    message: 'Phải có ít nhất một tiêu đề (Tiếng Việt hoặc English)',
    path: ['titleVi'],
}).refine((data) => data.descriptionVi || data.descriptionEn, {
    message: 'Phải có ít nhất một mô tả (Tiếng Việt hoặc English)',
    path: ['descriptionVi'],
});

export type StoryFormValues = z.infer<typeof storySchema>;

interface StoryFormProps {
    initialData?: Partial<StoryFormValues> & { id?: string };
    selectedLocale?: string;
    onSubmit: (data: StorySubmitPayload) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const StoryForm = ({ initialData, selectedLocale = 'vi', onSubmit, onCancel, isLoading }: StoryFormProps) => {
    const { languages } = useAdminLanguages();
    const [categories, setCategories] = useState<Category[]>([]);
    const [authors, setAuthors] = useState<Author[]>([]);
    const [isFetchingMeta, setIsFetchingMeta] = useState(true);
    const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
    const [urlText, setUrlText] = useState<string>(initialData?.thumbnailUrl || '');

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
    
    // Quick Creation Modal States
    const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
    const [isSubmittingAuthor, setIsSubmittingAuthor] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

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
            titleVi: '',
            titleEn: '',
            slug: '',
            descriptionVi: '',
            descriptionEn: '',
            thumbnailUrl: '',
            status: 'ongoing',
            categoryIds: [],
            isRecommended: false,
            isInteractive: false,
            language: initialData?.language || selectedLocale,
            ...(initialData
                ? {
                    titleVi: initialData.titleVi,
                    titleEn: initialData.titleEn,
                    slug: initialData.slug,
                    descriptionVi: initialData.descriptionVi,
                    descriptionEn: initialData.descriptionEn,
                    thumbnailUrl: initialData.thumbnailUrl,
                    authorId: initialData.authorId,
                    status: initialData.status,
                    categoryIds: initialData.categoryIds,
                    audioUrl: initialData.audioUrl,
                    isRecommended: initialData.isRecommended,
                    isInteractive: initialData.isInteractive,
                    language: initialData.language,
                }
                : {}),
        },
    });

    const titleVi = watch('titleVi');
    const selectedLanguage = watch('language') || selectedLocale;
    const isEnglishLocale = selectedLanguage === 'en';
    const selectedAuthorId = watch('authorId');
    const selectedCategoryIds = watch('categoryIds') || [];

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [catsRes, authorsRes, allChaptersRes] = await Promise.all([
                    apiClient.get(`/stories/categories?language=${selectedLanguage}`),
                    apiClient.get('/stories/authors'),
                    apiClient.get(`/chapters?limit=1000&lang=${selectedLanguage}`),
                ]);
                setCategories(catsRes.data);
                setAuthors(authorsRes.data);
                const fetchedChapters = Array.isArray(allChaptersRes.data?.data) ? allChaptersRes.data.data : [];
                setAvailableChapters(
                    fetchedChapters.filter((chapter: Chapter) => chapter.language === selectedLanguage),
                );

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
    }, [initialData?.id, selectedLanguage]);

    useEffect(() => {
        if (initialData?.id) return;

        setSelectedChapterIds((prev) =>
            prev.filter((chapterId) => {
                const chapter = availableChapters.find((item) => item.id === chapterId);
                return !!chapter && !chapter.storyId && chapter.language === selectedLanguage;
            }),
        );
    }, [availableChapters, initialData?.id, selectedLanguage]);

    // Sync initial thumbnail URL into local urlText and form value
    useEffect(() => {
        if (initialData?.thumbnailUrl) {
            setUrlText(initialData.thumbnailUrl);
            setValue('thumbnailUrl', initialData.thumbnailUrl);
        }
    }, [initialData?.thumbnailUrl, setValue]);

    // Create object URL for preview when a file is selected
    useEffect(() => {
        if (!selectedFile) {
            setSelectedFilePreview(null);
            return;
        }
        const objUrl = URL.createObjectURL(selectedFile);
        setSelectedFilePreview(objUrl);
        return () => URL.revokeObjectURL(objUrl);
    }, [selectedFile]);

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
        if (!initialData?.slug && titleVi) {
            const generatedSlug = titleVi
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
    }, [titleVi, setValue, initialData]);

    const handleFormSubmit = async (values: StoryFormValues) => {
        try {
            const cleanText = (value?: string) => {
                const trimmed = value?.trim();
                return trimmed ? trimmed : undefined;
            };

            const titleVi = cleanText(values.titleVi);
            const titleEn = cleanText(values.titleEn);
            const descriptionVi = cleanText(values.descriptionVi);
            const descriptionEn = cleanText(values.descriptionEn);

            const title = isEnglishLocale ? (titleEn || titleVi) : (titleVi || titleEn);
            if (!title) {
                alert('Vui lòng nhập ít nhất một tiêu đề truyện.');
                return;
            }

            const description = isEnglishLocale ? (descriptionEn || descriptionVi) : (descriptionVi || descriptionEn);

            // If a local file is selected, upload it first to backend and get local URL
            setIsUploadingThumbnail(true);
            let finalThumbnailUrl = values.thumbnailUrl;
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                try {
                    const uploadRes = await apiClient.post('/upload/image', formData);
                    finalThumbnailUrl = uploadRes.data?.url;
                } catch (err) {
                    console.error('Failed to upload image:', err);
                    alert('Lỗi khi tải ảnh lên server. Vui lòng thử lại.');
                    return;
                }
            }

            const finalData: StorySubmitPayload = {
                title,
                slug: values.slug.trim(),
                description,
                thumbnailUrl: finalThumbnailUrl || undefined,
                authorId: values.authorId,
                status: values.status,
                categoryIds: values.categoryIds,
                audioUrl: values.audioUrl || undefined,
                isRecommended: values.isRecommended,
                isInteractive: values.isInteractive,
                language: selectedLanguage,
            };

            // Include selected chapter IDs for new stories
            if (!initialData?.id && selectedChapterIds.length > 0) {
                finalData.chapterIds = selectedChapterIds;
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

    const filteredCategories = categories.filter(c => {
        const searchTerm = categorySearch.toLowerCase();
        const localizedName = (selectedLanguage === 'en' ? c.nameEn || c.name : c.nameVi || c.name).toLowerCase();
        return localizedName.includes(searchTerm) && !selectedCategoryIds.includes(c.id);
    });

    const isChapterLocaleMatched = (chapter: Chapter) => chapter.language === selectedLanguage;

    const filteredChapters = initialData?.id
        ? chapters.filter(c => {
            const searchTerm = chapterSearch.toLowerCase();
            const localizedTitle = (selectedLanguage === 'en' ? c.titleEn || c.title : c.titleVi || c.title).toLowerCase();
            return (localizedTitle.includes(searchTerm) || c.chapterNumber.toString().includes(searchTerm));
        })
        : availableChapters.filter(c => {
            const searchTerm = chapterSearch.toLowerCase();
            const localizedTitle = (selectedLanguage === 'en' ? c.titleEn || c.title : c.titleVi || c.title).toLowerCase();
            return (
                (localizedTitle.includes(searchTerm) || c.chapterNumber.toString().includes(searchTerm))
                && !c.storyId
                && isChapterLocaleMatched(c)
            );
        });

    const selectedChapters = availableChapters.filter(
        c => selectedChapterIds.includes(c.id) && isChapterLocaleMatched(c),
    );

    const handleChapterToggle = (chapterId: string) => {
        if (selectedChapterIds.includes(chapterId)) {
            setSelectedChapterIds(prev => prev.filter(id => id !== chapterId));
        } else {
            setSelectedChapterIds(prev => [...prev, chapterId]);
        }
    };

    const handleAuthorModalSubmit = async (data: any) => {
        setIsSubmittingAuthor(true);
        try {
            const res = await apiClient.post('/authors', data);
            const newAuthor = res.data;
            setAuthors(prev => [...prev, newAuthor].sort((a, b) => a.name.localeCompare(b.name)));
            setValue('authorId', newAuthor.id);
            setIsAuthorModalOpen(false);
        } catch (error) {
            console.error('Failed to create author:', error);
            alert('Không thể tạo tác giả mới.');
        } finally {
            setIsSubmittingAuthor(false);
        }
    };

    const handleCategoryModalSubmit = async (data: any) => {
        setIsSubmittingCategory(true);
        try {
            const res = await apiClient.post('/categories', {
                ...data,
                language: selectedLanguage,
            });
            const newCategory = res.data;
            setCategories(prev => [...prev, newCategory]);
            setValue('categoryIds', [...selectedCategoryIds, newCategory.id]);
            setIsCategoryModalOpen(false);
        } catch (error) {
            console.error('Failed to create category:', error);
            alert('Không thể tạo thể loại mới.');
        } finally {
            setIsSubmittingCategory(false);
        }
    };

    const selectedAuthor = authors.find(a => a.id === selectedAuthorId);

    return (
        <>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 w-full">

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 space-y-8">
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                            {isEnglishLocale ? 'Story Title (English)' : 'Tiêu đề truyện (Tiếng Việt)'}
                        </label>
                        <input
                            {...register(isEnglishLocale ? 'titleEn' : 'titleVi')}
                            placeholder={isEnglishLocale ? 'Enter story title in English' : 'Nhập tên truyện tiếng Việt'}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                        />
                        {!isEnglishLocale && errors.titleVi && <p className="text-xs font-bold text-red-500 ml-2">{errors.titleVi.message}</p>}
                        {isEnglishLocale && errors.titleEn && <p className="text-xs font-bold text-red-500 ml-2">{errors.titleEn.message}</p>}
                    </div>

                    {/* Hàng 2: Input slug, trạng thái và ngôn ngữ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Slug (URL)</label>
                            <input
                                {...register('slug')}
                                placeholder="ten-truyen-slug..."
                                className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                            />
                            {errors.slug && <p className="text-xs font-bold text-red-500 ml-2">{errors.slug.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Trạng thái</label>
                            <div className="relative">
                                <select
                                    {...register('status')}
                                    className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 appearance-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer shadow-sm transition-all"
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
                                    className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 appearance-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer shadow-sm transition-all"
                                >
                                    {languages.map((language) => (
                                        <option key={language.id} value={language.key}>
                                            {language.name} ({language.key})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                            <label className="flex cursor-pointer items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wider text-slate-700">Đề xuất ở trang đọc</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">Bật để truyện xuất hiện trong slider "Có thể bạn sẽ thích".</p>
                                </div>
                                <input type="checkbox" {...register('isRecommended')} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            </label>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                            <label className="flex cursor-pointer items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wider text-amber-900">Là Truyện Tương Tác</p>
                                    <p className="mt-1 text-xs font-medium text-amber-700">Bật nếu truyện này sẽ cho phép người chơi rẽ nhánh.</p>
                                </div>
                                <input type="checkbox" {...register('isInteractive')} className="h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                            </label>
                        </div>
                    </div>

                    {/* Hàng 3: Chọn tác giả nguyên 1 hàng (Searchable Dropdown) */}
                    <div className="space-y-2" ref={authorRef}>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tác giả</label>
                            <button
                                type="button"
                                onClick={() => setIsAuthorModalOpen(true)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Thêm tác giả mới"
                            >
                                <Plus className="w-4 h-4 text-pink-600" />
                            </button>
                        </div>
                        <div className="relative">

                            <button
                                type="button"
                                onClick={() => setIsAuthorOpen(!isAuthorOpen)}
                                className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all flex items-center justify-between shadow-sm"
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
                                                className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                                                    className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-white hover:text-indigo-600 transition-colors flex items-center justify-between group"
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
                            <button
                                type="button"
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Thêm thể loại mới"
                            >
                                <Plus className="w-4 h-4 text-pink-600" />
                            </button>
                        </div>
                        <div className="relative">

                            <button
                                type="button"
                                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all flex items-center justify-between min-h-[56px] shadow-sm"
                            >
                                <div className="flex flex-wrap gap-2">
                                    {selectedCategoryIds.length > 0 ? (
                                        selectedCategoryIds.map(id => {
                                            const cat = categories.find(c => c.id === id);
                                            return cat ? (
                                                <span 
                                                    key={id} 
                                                    className="group relative bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-lg uppercase tracking-wider hover:pr-7 transition-all duration-200"
                                                >
                                                    {selectedLanguage === 'en' ? cat.nameEn || cat.name : cat.nameVi || cat.name}
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setValue('categoryIds', selectedCategoryIds.filter((cid: number) => cid !== id));
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setValue('categoryIds', selectedCategoryIds.filter((cid: number) => cid !== id));
                                                            }
                                                        }}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-indigo-700 rounded p-0.5"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </span>
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
                                                className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                                                    className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-white hover:text-indigo-600 transition-colors flex items-center justify-between group"
                                                >
                                                    {selectedLanguage === 'en' ? cat.nameEn || cat.name : cat.nameVi || cat.name}
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
                    {!initialData?.id && (
                        <div className="space-y-4" ref={chapterRef}>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Chương</label>
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsChapterOpen(!isChapterOpen)}
                                    className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all flex items-center justify-between min-h-[56px] shadow-sm"
                                >
                                    <div className="flex flex-wrap gap-2">
                                        {selectedChapterIds.length > 0 ? (
                                            <span className="text-slate-700">
                                                Đã chọn {selectedChapterIds.length} chương
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">
                                                Chọn chương có sẵn
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
                                                    className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                                    value={chapterSearch}
                                                    onChange={(e) => setChapterSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                            {filteredChapters.length > 0 ? (
                                                filteredChapters.map((chap: Chapter) => (
                                                    <button
                                                        key={chap.id}
                                                        type="button"
                                                        onClick={() => handleChapterToggle(chap.id)}
                                                        className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-white hover:text-indigo-600 transition-colors flex items-center justify-between group"
                                                    >
                                                        <span>Chương {chap.chapterNumber}: {selectedLanguage === 'en' ? chap.titleEn || chap.title : chap.titleVi || chap.title}</span>
                                                        {selectedChapterIds.includes(chap.id) && (
                                                            <Check className="w-4 h-4 text-indigo-600" />
                                                        )}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-6 py-4 text-sm font-medium text-slate-400 italic">
                                                    Không có chương chưa gán. Vui lòng tạo chương mới tại trang Quản lý Chương.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Display selected chapters for new story */}
                            {selectedChapters.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Các chương đã chọn:</p>
                                    <div className="space-y-2">
                                        {selectedChapters.map((chap) => (
                                            <div
                                                key={chap.id}
                                                className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5"
                                            >
                                                <span className="text-sm font-bold text-indigo-900">
                                                    Chương {chap.chapterNumber}: {selectedLanguage === 'en' ? chap.titleEn || chap.title : chap.titleVi || chap.title}
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
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                            {isEnglishLocale ? 'Story Description (English)' : 'Giới thiệu truyện (Tiếng Việt)'}
                        </label>
                        <textarea
                            {...register(isEnglishLocale ? 'descriptionEn' : 'descriptionVi')}
                            rows={5}
                            placeholder={isEnglishLocale ? 'Enter English description...' : 'Nhập giới thiệu tiếng Việt...'}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-[24px] py-4 px-6 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none shadow-sm"
                        />
                        {!isEnglishLocale && errors.descriptionVi && <p className="text-xs font-bold text-red-500 ml-2">{errors.descriptionVi.message}</p>}
                        {isEnglishLocale && errors.descriptionEn && <p className="text-xs font-bold text-red-500 ml-2">{errors.descriptionEn.message}</p>}
                    </div>

                    {/* Thumbnail: allow URL input OR file select (mutually exclusive) */}
                    <div className="space-y-4">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ảnh bìa (Thumbnail)</label>

                        {/* Preview if either a selected local file or existing URL is present */}
                        {selectedFilePreview || watch('thumbnailUrl') ? (
                            <div className="relative group w-full aspect-[2/3] md:w-48 overflow-hidden rounded-[32px] border-4 border-white shadow-2xl transition-transform hover:scale-[1.02] mx-auto md:mx-0">
                                <img src={selectedFilePreview ?? watch('thumbnailUrl') ?? ''} alt="Thumbnail" className="w-full h-full object-cover" />
                                <div className="absolute top-4 right-4 flex items-center gap-2">
                                    {selectedFile && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFile(null)}
                                            className="p-2 bg-white/90 text-slate-700 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                            title="Xóa file đã chọn"
                                        >
                                            X
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setValue('thumbnailUrl', '');
                                            setUrlText('');
                                            setSelectedFile(null);
                                        }}
                                        className="p-2 bg-white/90 backdrop-blur-sm text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                        title="Xóa ảnh hiện tại"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">Link ảnh (URL)</label>
                                    <input
                                        type="url"
                                        value={urlText}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setUrlText(v);
                                            setValue('thumbnailUrl', v);
                                            if (v) setSelectedFile(null);
                                        }}
                                        placeholder="https://..."
                                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                                        disabled={!!selectedFile}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">Hoặc chọn file</label>
                                    <div className="flex items-center gap-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl py-[9px] px-4 shadow-sm transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 h-[52px]">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] ?? null;
                                                setSelectedFile(f);
                                                if (f) {
                                                    setValue('thumbnailUrl', '');
                                                    setUrlText('');
                                                }
                                            }}
                                            disabled={!!urlText}
                                            className="text-sm font-medium text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-colors cursor-pointer w-full"
                                        />
                                        {selectedFile && (
                                            <button type="button" onClick={() => setSelectedFile(null)} className="px-3 py-2 bg-white border rounded-lg text-sm">
                                                X, xóa file
                                            </button>
                                        )}
                                    </div>
                                    <input {...register('thumbnailUrl')} type="hidden" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                {/* Footer Actions */}
                <div className="p-8 bg-white border-t border-slate-100 flex items-center justify-end gap-4">
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

        {/* Author Quick Creation Modal */}
        {isAuthorModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-xl">
                                <Plus className="w-5 h-5 text-indigo-600" />
                            </div>
                            Tạo Tác Giả Mới
                        </h2>
                        <button
                            type="button"
                            onClick={() => setIsAuthorModalOpen(false)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-8">
                        <AuthorForm
                            defaultLanguage={selectedLanguage}
                            onSubmit={handleAuthorModalSubmit}
                            onCancel={() => setIsAuthorModalOpen(false)}
                            isLoading={isSubmittingAuthor}
                        />
                    </div>
                </div>
            </div>
        )}

        {/* Category Quick Creation Modal */}
        {isCategoryModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-xl">
                                <Plus className="w-5 h-5 text-indigo-600" />
                            </div>
                            Tạo Thể Loại Mới
                        </h2>
                        <button
                            type="button"
                            onClick={() => setIsCategoryModalOpen(false)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-8">
                        <CategoryForm
                            defaultLanguage={selectedLanguage}
                            onSubmit={handleCategoryModalSubmit}
                            onCancel={() => setIsCategoryModalOpen(false)}
                            isLoading={isSubmittingCategory}
                        />
                    </div>
                </div>
            </div>
        )}
    </>
    );
};
