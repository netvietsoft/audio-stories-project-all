"use client";

import React, { useState, useEffect } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import NextImage from 'next/image';
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
    Newspaper,
    SlidersHorizontal,
    Tags,
    ImageIcon,
} from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList, unwrapData } from '@/lib/api/unwrap';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import type { Category, Chapter, Author, StorySubmitPayload } from '@/types/admin';
import { AuthorForm } from '../../authors/_components/AuthorForm';
import { CategoryForm } from '../../categories/_components/CategoryForm';
import { formatThousand, parseThousand } from '@/lib/format-number';

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
    labelId: z.number().nullable().optional(),
    labelDurationDaysOverride: z.coerce.number().int().min(0).optional(),
    audioUrl: z.string().optional().nullable(),
    isRecommended: z.boolean().optional(),
    isInteractive: z.boolean().optional(),
    unlockPrice: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? 0 : Number(value)),
        z.number().min(0, 'Giá mở khóa không hợp lệ'),
    ),
    discountPercent: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? 0 : Number(value)),
        z.number().min(0, 'Giảm giá không hợp lệ').max(100, 'Giảm giá tối đa 100%'),
    ),
    language: z.string().optional(),
}).refine((data) => data.titleVi || data.titleEn, {
    message: 'Phải có ít nhất một tiêu đề (Tiếng Việt hoặc English)',
    path: ['titleVi'],
}).refine((data) => data.descriptionVi || data.descriptionEn, {
    message: 'Phải có ít nhất một mô tả (Tiếng Việt hoặc English)',
    path: ['descriptionVi'],
});

export type StoryFormValues = z.infer<typeof storySchema>;

interface Label {
    id: number;
    name: string;
    text: string;
    color: string;
}

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
    const [labels, setLabels] = useState<Label[]>([]);
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
        setError,
        watch,
        formState: { errors },
    } = useForm<StoryFormValues>({
        resolver: zodResolver(storySchema) as any,
        defaultValues: {
            titleVi: '',
            titleEn: '',
            slug: '',
            descriptionVi: '',
            descriptionEn: '',
            thumbnailUrl: '',
            status: 'ongoing',
            categoryIds: [],
            labelId: null,
            labelDurationDaysOverride: undefined,
            isRecommended: false,
            isInteractive: false,
            unlockPrice: 0,
            discountPercent: 0,
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
                    labelId: initialData.labelId ?? null,
                    labelDurationDaysOverride: undefined,
                    audioUrl: initialData.audioUrl,
                    isRecommended: initialData.isRecommended,
                    isInteractive: initialData.isInteractive,
                    unlockPrice: initialData.unlockPrice ?? 0,
                    discountPercent: initialData.discountPercent ?? 0,
                    language: initialData.language,
                }
                : {}),
        },
    });

    const titleVi = watch('titleVi');
    const titleEn = watch('titleEn');
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
                setCategories(unwrapList<Category>(catsRes.data));
                setAuthors(unwrapList<Author>(authorsRes.data));
                const fetchedChapters = unwrapList<Chapter>(allChaptersRes.data);
                setAvailableChapters(
                    fetchedChapters.filter((chapter: Chapter) => chapter.language === selectedLanguage),
                );

                if (initialData?.id) {
                    const chapsRes = await apiClient.get(`/stories/${initialData.id}/chapters`);
                    const chaps = unwrapList<Chapter>(chapsRes.data);
                    setChapters(chaps);
                    setSelectedChapterIds(chaps.map((c: Chapter) => c.id));
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
        const fetchLabels = async () => {
            try {
                const labelsRes = await apiClient.get('/labels?limit=100');
                setLabels(unwrapList<Label>(labelsRes.data));
            } catch (error) {
                console.error('Failed to fetch labels:', error);
            }
        };
        fetchLabels();
    }, []);

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

    // Simple slugify for FE - support both Vietnamese and English
    useEffect(() => {
        if (!initialData?.slug) {
            const sourceTitle = isEnglishLocale ? (titleEn || titleVi) : (titleVi || titleEn);
            if (sourceTitle) {
                const generatedSlug = sourceTitle
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
        }
    }, [titleVi, titleEn, isEnglishLocale, setValue, initialData]);

    const handleFormSubmit = async (values: StoryFormValues) => {
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
            // Set field-level error instead of alert
            if (isEnglishLocale) {
                setError('titleEn', { type: 'manual', message: 'Vui lòng nhập ít nhất một tiêu đề truyện.' });
            } else {
                setError('titleVi', { type: 'manual', message: 'Vui lòng nhập ít nhất một tiêu đề truyện.' });
            }
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
                finalThumbnailUrl = unwrapData<any>(uploadRes.data)?.url;
            } catch (err: any) {
                console.error('Failed to upload image:', err);
                setError('thumbnailUrl', { type: 'server', message: 'Lỗi khi tải ảnh lên server. Vui lòng thử lại.' });
                setIsUploadingThumbnail(false);
                return;
            }
        }

        const finalData: StorySubmitPayload & { labelId?: number | null; labelDurationDaysOverride?: number } = {
            title,
            slug: values.slug?.trim(),
            description,
            thumbnailUrl: finalThumbnailUrl || undefined,
            authorId: values.authorId,
            status: values.status,
            categoryIds: values.categoryIds,
            labelId: values.labelId ?? null,
            ...(values.labelDurationDaysOverride != null && !Number.isNaN(values.labelDurationDaysOverride)
                ? { labelDurationDaysOverride: values.labelDurationDaysOverride } : {}),
            audioUrl: values.audioUrl || undefined,
            isRecommended: values.isRecommended,
            isInteractive: values.isInteractive,
            unlockPrice: Math.max(0, Math.floor(Number(values.unlockPrice || 0))),
            discountPercent: Math.max(0, Math.min(100, Math.floor(Number(values.discountPercent || 0)))),
            language: selectedLanguage,
        };

        // Include selected chapter IDs for new stories
        if (!initialData?.id && selectedChapterIds.length > 0) {
            finalData.chapterIds = selectedChapterIds;
        }

        try {
            await onSubmit(finalData);
        } catch (err: any) {
            const res = err?.response?.data;
            const status = err?.response?.status;
            if (status === 400 || status === 422) {
                if (res?.errors && typeof res.errors === 'object') {
                    for (const key in res.errors) {
                        const message = Array.isArray(res.errors[key]) ? res.errors[key][0] : res.errors[key];
                        setError(key as any, { type: 'server', message: String(message) });
                    }
                    return;
                }
                if (Array.isArray(res?.fieldErrors)) {
                    res.fieldErrors.forEach((fe: any) => {
                        setError(fe.field as any, { type: 'server', message: fe.message });
                    });
                    return;
                }
            }
            console.error('Failed to submit story:', err);
            throw err;
        } finally {
            setIsUploadingThumbnail(false);
        }
    };

    const handleFormError = (formErrors: FieldErrors<StoryFormValues>) => {
        const firstKey = Object.keys(formErrors)[0] as keyof StoryFormValues | undefined;
        if (firstKey) {
            const el = document.querySelector(`[name="${String(firstKey)}"]`) as HTMLElement | null;
            if (el && typeof el.focus === 'function') el.focus();
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
            const newAuthor = unwrapData<any>(res.data);
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
            const newCategory = unwrapData<any>(res.data);
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
                <div className="p-6 space-y-6 sm:p-8">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                            <Newspaper className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Thông tin chính</h3>
                            <p className="text-xs font-medium text-slate-400">Tiêu đề, đường dẫn, trạng thái và ngôn ngữ.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                            {isEnglishLocale ? 'Story Title (English)' : 'Tiêu đề truyện (Tiếng Việt)'}
                        </label>
                        <input
                            {...register(isEnglishLocale ? 'titleEn' : 'titleVi')}
                            placeholder={isEnglishLocale ? 'Enter story title in English' : 'Nhập tên truyện tiếng Việt'}
                            className={`admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-medium transition-all ${isEnglishLocale ? (errors.titleEn ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm') : (errors.titleVi ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm')}`}
                        />
                        {!isEnglishLocale && errors.titleVi && <p className="text-red-500 text-xs mt-1">{errors.titleVi.message}</p>}
                        {isEnglishLocale && errors.titleEn && <p className="text-red-500 text-xs mt-1">{errors.titleEn.message}</p>}
                    </div>

                    {/* Hàng 2: Input slug, trạng thái và ngôn ngữ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Slug (URL)</label>
                            <input
                                {...register('slug')}
                                placeholder="ten-truyen-slug..."
                                className={`admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.slug ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
                            />
                            {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Trạng thái</label>
                            <select
                                {...register('status')}
                                className={`admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 cursor-pointer transition-all ${errors.status ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
                            >
                                <option value="ongoing">Đang ra (Ongoing)</option>
                                <option value="completed">Hoàn thành (Completed)</option>
                            </select>
                            {errors.status && <p className="text-red-500 text-xs mt-1">{errors.status.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ngôn ngữ</label>
                            <select
                                {...register('language')}
                                className={`admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 cursor-pointer transition-all ${errors.language ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
                            >
                                {languages.map((language) => (
                                    <option key={language.id} value={language.key}>
                                        {language.name} ({language.key})
                                    </option>
                                ))}
                            </select>
                            {errors.language && <p className="text-red-500 text-xs mt-1">{errors.language.message}</p>}
                        </div>

                    </div>

                    <div className="flex items-center gap-3 border-t border-slate-100 pt-6">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                            <SlidersHorizontal className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Cấu hình & giá</h3>
                            <p className="text-xs font-medium text-slate-400">Hiển thị nổi bật và giá mở khóa toàn truyện.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className={`admin-input rounded-2xl border border-slate-200 bg-white px-5 py-4 ${errors.isRecommended ? 'admin-input-error' : ''}`}>
                            <label className="flex cursor-pointer items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wider text-slate-700">Đề xuất ở trang đọc</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">Bật để truyện xuất hiện trong slider "Có thể bạn sẽ thích".</p>
                                </div>
                                <input type="checkbox" {...register('isRecommended')} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            </label>
                            {errors.isRecommended && <p className="text-red-500 text-xs mt-1">{errors.isRecommended.message}</p>}
                        </div>

                        <div className={`admin-input rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 ${errors.isInteractive ? 'admin-input-error' : ''}`}>
                            <label className="flex cursor-pointer items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wider text-amber-900">Là Truyện Tương Tác</p>
                                    <p className="mt-1 text-xs font-medium text-amber-700">Bật nếu truyện này sẽ cho phép người chơi rẽ nhánh.</p>
                                </div>
                                <input type="checkbox" {...register('isInteractive')} className="h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                            </label>
                            {errors.isInteractive && <p className="text-red-500 text-xs mt-1">{errors.isInteractive.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giá mở khóa toàn bộ truyện (Pulse)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={formatThousand((watch('unlockPrice') as number) ?? 0)}
                                onChange={(e) => setValue('unlockPrice', parseThousand(e.target.value), { shouldValidate: true, shouldDirty: true })}
                                onFocus={(e) => e.target.select()}
                                className={`admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.unlockPrice ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
                                placeholder="Ví dụ: 299"
                            />
                            {errors.unlockPrice && <p className="text-red-500 text-xs mt-1">{errors.unlockPrice.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giảm giá (%)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={formatThousand((watch('discountPercent') as number) ?? 0)}
                                onChange={(e) => setValue('discountPercent', Math.min(100, parseThousand(e.target.value)), { shouldValidate: true, shouldDirty: true })}
                                onFocus={(e) => e.target.select()}
                                className={`admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.discountPercent ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
                                placeholder="Ví dụ: 10"
                            />
                            {errors.discountPercent && <p className="text-red-500 text-xs mt-1">{errors.discountPercent.message}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-slate-100 pt-6">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                            <Tags className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Phân loại</h3>
                            <p className="text-xs font-medium text-slate-400">Tác giả, thể loại{!initialData?.id ? ' và chương' : ''}.</p>
                        </div>
                    </div>

                    {/* Hàng 3-5: Tác giả + thể loại + chương trên cùng 1 hàng (4 cột) */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
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
                                name="authorId"
                                type="button"
                                onClick={() => setIsAuthorOpen(!isAuthorOpen)}
                                className={`admin-input w-full bg-white border border-slate-200 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 transition-all flex items-center justify-between min-h-[56px] ${errors.authorId ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
                            >
                                <span className={selectedAuthor ? 'text-slate-900' : 'text-slate-400'}>
                                    {selectedAuthor ? selectedAuthor.name : 'Chọn tác giả'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAuthorOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <input type="hidden" {...register('authorId')} />

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
                        {errors.authorId && <p className="text-red-500 text-xs mt-1">{errors.authorId.message}</p>}
                    </div>

                    {/* Hàng 4: Chọn thể loại (Searchable Dropdown) */}
                    <div className="space-y-2" ref={categoryRef}>
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
                                name="categoryIds"
                                type="button"
                                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                className={`admin-input w-full bg-white border border-slate-200 text-left rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 transition-all flex items-center justify-between min-h-[56px] ${errors.categoryIds ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
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
                            <input type="hidden" {...register('categoryIds')} />

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
                        {errors.categoryIds && <p className="text-red-500 text-xs mt-1">{errors.categoryIds.message}</p>}
                    </div>

                    {/* Label (Hot/New...) + số ngày gim override */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Label (Hot/New…)</label>
                        <select
                            value={watch('labelId') ?? ''}
                            onChange={(e) => setValue('labelId', e.target.value === '' ? null : Number(e.target.value), { shouldDirty: true })}
                            className="admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 cursor-pointer transition-all focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                        >
                            <option value="">— Không label —</option>
                            {labels.map((l) => (
                                <option key={l.id} value={l.id}>{l.name} ({l.text})</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min={0}
                            placeholder="Số ngày gim (để trống = mặc định của label)"
                            {...register('labelDurationDaysOverride', {
                                setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                            })}
                            className="admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-medium transition-all focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                        />
                        {errors.labelDurationDaysOverride && <p className="text-red-500 text-xs mt-1">{errors.labelDurationDaysOverride.message}</p>}
                    </div>

                    {/* Hàng 5: Quản lý chương */}
                    {!initialData?.id && (
                        <div className="space-y-2" ref={chapterRef}>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Chương</label>
                                <div className="w-6 h-6"></div>
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

                    </div>

                    <div className="flex items-center gap-3 border-t border-slate-100 pt-6">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <ImageIcon className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Nội dung</h3>
                            <p className="text-xs font-medium text-slate-400">Giới thiệu truyện.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                            {isEnglishLocale ? 'Story Description (English)' : 'Giới thiệu truyện (Tiếng Việt)'}
                        </label>
                        <textarea
                            {...register(isEnglishLocale ? 'descriptionEn' : 'descriptionVi')}
                            rows={5}
                            placeholder={isEnglishLocale ? 'Enter English description...' : 'Nhập giới thiệu tiếng Việt...'}
                            className={`admin-input w-full bg-white border border-slate-200 rounded-[24px] py-4 px-6 text-sm font-medium transition-all resize-none shadow-sm ${isEnglishLocale ? (errors.descriptionEn ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10') : (errors.descriptionVi ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10')}`}
                        />
                        {!isEnglishLocale && errors.descriptionVi && <p className="text-red-500 text-xs mt-1">{errors.descriptionVi.message}</p>}
                        {isEnglishLocale && errors.descriptionEn && <p className="text-red-500 text-xs mt-1">{errors.descriptionEn.message}</p>}
                    </div>

                    {/* Ảnh bìa (Thumbnail) — cùng dòng với Nội dung */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ảnh bìa (Thumbnail)</label>

                        {selectedFilePreview || watch('thumbnailUrl') ? (
                            <div className="relative group w-full max-w-[220px] aspect-[2/3] overflow-hidden rounded-[24px] border-4 border-white shadow-xl">
                                <NextImage
                                    src={selectedFilePreview ?? watch('thumbnailUrl') ?? ''}
                                    alt="Thumbnail"
                                    fill
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                                <div className="absolute top-3 right-3 flex items-center gap-2">
                                    {selectedFile && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFile(null)}
                                            className="p-2 bg-white/90 text-slate-700 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                            title="Xóa file đã chọn"
                                        >
                                            <X className="w-5 h-5" />
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
                            <div className="space-y-3">
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
                                        name="thumbnailUrl"
                                        className={`admin-input w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.thumbnailUrl ? 'admin-input-error' : 'focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
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
                                            <button
                                                type="button"
                                                onClick={() => setSelectedFile(null)}
                                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                                                title="Xóa file đã chọn"
                                            >
                                                <X className="h-3.5 w-3.5" /> Xóa file
                                            </button>
                                        )}
                                    </div>
                                    <input {...register('thumbnailUrl')} type="hidden" />
                                </div>
                            </div>
                        )}
                        {errors.thumbnailUrl && <p className="text-red-500 text-xs mt-1">{errors.thumbnailUrl.message}</p>}
                    </div>
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
