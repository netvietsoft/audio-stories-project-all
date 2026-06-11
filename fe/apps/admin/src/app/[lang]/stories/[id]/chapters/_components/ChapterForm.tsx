"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import NextImage from 'next/image';
import {
    Loader2,
    Save,
    X,
    Music,
    Youtube,
    Clock,
    Lock,
    ChevronDown,
    Search,
    Check,
    BookOpen,
    Image,
    Scissors,
} from 'lucide-react';

import { UploadButton } from '@/lib/uploadthing';
import { adminApiClient } from '@/lib/api/admin-api-client';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';
import 'react-quill-new/dist/quill.snow.css';
import { useTranslations } from 'next-intl';

const ReactQuill: any = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[400px] bg-slate-50 animate-pulse rounded-2xl w-full border border-slate-200"></div>
});
type Locale = 'vi' | 'en';
type LocalizedText = { vi: string; en: string };

const chapterSchema = z.object({
    chapterNumber: z.coerce.number().min(0, 'Số chương không được âm'),
    titleVi: z.string().optional(),
    titleEn: z.string().optional(),
    descriptionVi: z.string().optional(),
    descriptionEn: z.string().optional(),
    contentVi: z.string().optional(),
    contentEn: z.string().optional(),
    audioUrlVi: z.string().optional(),
    audioUrlEn: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    youtubeVideoId: z.string().optional(),
    audioDuration: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? undefined : Number(value)),
        z.number().min(0, 'Thời lượng không hợp lệ').optional(),
    ),
    accessType: z.enum(['free', 'timed', 'vip', 'ads']),
    unlockPrice: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? undefined : Number(value)),
        z.number().min(0, 'Credits mở khóa không hợp lệ').optional(),
    ),
    discountPercent: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? 0 : Number(value)),
        z.number().min(0, 'Giảm giá không hợp lệ').max(100, 'Giảm giá tối đa 100%'),
    ),
    language: z.string().min(1, 'Vui lòng chọn ngôn ngữ'),
    storyId: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? undefined : value),
        z.string().uuid('ID truyện không hợp lệ').optional(),
    ),
    unlocksAt: z.string().optional(),
    unlockAdId: z.string().optional(),
});

export type ChapterFormValues = {
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
    accessType: 'free' | 'timed' | 'vip' | 'ads';
    unlockPrice?: number;
    discountPercent?: number;
    language: string;
    unlocksAt?: string;
    storyId?: string;
    unlockAdId?: string;
};

export type ChapterSubmitPayload = {
    chapterNumber: number;
    title: string | null;
    description?: string | null;
    content?: string | null;
    r2AudioUrl?: string | null;
    thumbnailUrl?: string | null;
    youtubeVideoId?: string | null;
    audioDuration?: number;
    accessType: 'free' | 'timed' | 'vip' | 'ads';
    unlockPrice?: number;
    discountPercent?: number;
    storyId?: string;
    language?: string;
    unlocksAt?: string;
    unlockAdId?: string;
};

interface ChapterFormProps {
    initialData?: Partial<ChapterFormValues> & {
        r2AudioUrl?: string;
        thumbnailUrl?: string;
        title?: unknown;
        titleVi?: string;
        titleEn?: string;
        description?: unknown;
        descriptionVi?: string;
        descriptionEn?: string;
        content?: unknown;
        contentVi?: string;
        contentEn?: string;
        audioUrl?: unknown;
        audioUrlVi?: string;
        audioUrlEn?: string;
    };
    selectedLocale?: string;
    onSubmit: (data: ChapterSubmitPayload) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

interface StoryOption {
    id: string;
    title?: unknown;
    titleVi?: string;
    titleEn?: string;
    language?: 'vi' | 'en' | string | null;
}

type UnlockAdOption = {
    id: string;
    title: string;
    language?: string | null;
    isGlobal?: boolean;
    routeType?: number;
};

const toLocalizedText = (value: unknown, locale: string = 'vi'): LocalizedText => {
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as Record<string, unknown>;
            if (parsed && typeof parsed === 'object') {
                return {
                    vi: typeof parsed.vi === 'string' ? parsed.vi : '',
                    en: typeof parsed.en === 'string' ? parsed.en : '',
                };
            }
        } catch {
            // Keep backward compatibility for legacy plain string content.
        }
        // Fallback flat string to current locale
        return locale === 'en' ? { vi: '', en: value } : { vi: value, en: '' };
    }

    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return {
            vi:
                typeof record.vi === 'string'
                    ? record.vi
                    : typeof record.titleVi === 'string'
                        ? record.titleVi
                        : typeof record.descriptionVi === 'string'
                            ? record.descriptionVi
                            : typeof record.contentVi === 'string'
                                ? record.contentVi
                                : typeof record.audioUrlVi === 'string'
                                    ? record.audioUrlVi
                                    : '',
            en:
                typeof record.en === 'string'
                    ? record.en
                    : typeof record.titleEn === 'string'
                        ? record.titleEn
                        : typeof record.descriptionEn === 'string'
                            ? record.descriptionEn
                            : typeof record.contentEn === 'string'
                                ? record.contentEn
                                : typeof record.audioUrlEn === 'string'
                                    ? record.audioUrlEn
                                    : '',
        };
    }

    return { vi: '', en: '' };
};

const getLocalizedText = (value: unknown, locale = 'vi'): string => {
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const vi = typeof record.titleVi === 'string' ? record.titleVi : '';
        const en = typeof record.titleEn === 'string' ? record.titleEn : '';
        if (vi || en) {
            return locale === 'en' ? en || vi : vi || en;
        }
    }

    const parsed = toLocalizedText(value);
    return locale === 'en' ? parsed.en || parsed.vi || '' : parsed.vi || parsed.en || '';
};

export const ChapterForm = ({ initialData, selectedLocale = 'vi', onSubmit, onCancel, isLoading }: ChapterFormProps) => {
    const tChapter = useTranslations('StoryChapterClient');
    const { languages } = useAdminLanguages();
    const [stories, setStories] = useState<StoryOption[]>([]);
    const [isStoryOpen, setIsStoryOpen] = useState(false);
    const [storySearch, setStorySearch] = useState('');
    const storyRef = useRef<HTMLDivElement>(null);
    const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
    const [isUploadingAudioVi, setIsUploadingAudioVi] = useState(false);
    const [isUploadingAudioEn, setIsUploadingAudioEn] = useState(false);
    const [unlockAds, setUnlockAds] = useState<UnlockAdOption[]>([]);

    // Debug: Log initialData
    useEffect(() => {
        console.log('ChapterForm initialData:', initialData);
        console.log('ChapterForm initialData.storyId:', initialData?.storyId);
    }, [initialData]);

    // Memoize localized text to prevent recalculation on every render
    const { initialTitle, initialDescription, initialContent, initialAudio } = useMemo(() => {
        const title = toLocalizedText(initialData?.title, selectedLocale);
        const desc = toLocalizedText(initialData?.description, selectedLocale);
        const cont = toLocalizedText(initialData?.content, selectedLocale);
        const audio = toLocalizedText(initialData?.audioUrl, selectedLocale);
        
        if (!audio.vi && !audio.en && initialData?.r2AudioUrl) {
            if (selectedLocale === 'en') {
                audio.en = initialData.r2AudioUrl;
            } else {
                audio.vi = initialData.r2AudioUrl;
            }
        }
        
        return { initialTitle: title, initialDescription: desc, initialContent: cont, initialAudio: audio };
    }, [initialData, selectedLocale]);

    const safeString = (value: unknown, fallback = ''): string =>
        typeof value === 'string' ? value : fallback;
    const safeNumber = (value: unknown, fallback = 0): number =>
        typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const safeAccessType = (value: unknown): 'free' | 'timed' | 'vip' | 'ads' =>
        value === 'timed' || value === 'vip' || value === 'ads' ? value : 'free';

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        setError,
        formState: { errors },
    } = useForm<ChapterFormValues>({
        resolver: zodResolver(chapterSchema) as any,
        defaultValues: {
            chapterNumber: safeNumber(initialData?.chapterNumber, 1),
            titleVi: safeString(initialData?.titleVi, initialTitle.vi),
            titleEn: safeString(initialData?.titleEn, initialTitle.en),
            descriptionVi: safeString(initialData?.descriptionVi, initialDescription.vi),
            descriptionEn: safeString(initialData?.descriptionEn, initialDescription.en),
            contentVi: safeString(initialData?.contentVi, initialContent.vi),
            contentEn: safeString(initialData?.contentEn, initialContent.en),
            audioUrlVi: safeString(initialData?.audioUrlVi, initialAudio.vi),
            audioUrlEn: safeString(initialData?.audioUrlEn, initialAudio.en),
            thumbnailUrl: safeString(initialData?.thumbnailUrl),
            youtubeVideoId: safeString(initialData?.youtubeVideoId),
            audioDuration: safeNumber(initialData?.audioDuration, 0),
            accessType: safeAccessType(initialData?.accessType),
            unlockPrice: safeNumber((initialData as { unlockPrice?: unknown } | undefined)?.unlockPrice, 0),
            discountPercent: safeNumber((initialData as { discountPercent?: unknown } | undefined)?.discountPercent, 0),
            language: safeString((initialData as { language?: unknown } | undefined)?.language, selectedLocale),
            storyId: safeString(initialData?.storyId),
            unlocksAt: safeString(initialData?.unlocksAt),
            unlockAdId: safeString((initialData as { unlockAdId?: unknown } | undefined)?.unlockAdId),
        },
    });

    // Update form when initialData changes (e.g., after async fetch)
    useEffect(() => {
        if (!initialData) return;
        
        reset({
            chapterNumber: safeNumber(initialData?.chapterNumber, 1),
            titleVi: safeString(initialData?.titleVi, initialTitle.vi),
            titleEn: safeString(initialData?.titleEn, initialTitle.en),
            descriptionVi: safeString(initialData?.descriptionVi, initialDescription.vi),
            descriptionEn: safeString(initialData?.descriptionEn, initialDescription.en),
            contentVi: safeString(initialData?.contentVi, initialContent.vi),
            contentEn: safeString(initialData?.contentEn, initialContent.en),
            audioUrlVi: safeString(initialData?.audioUrlVi, initialAudio.vi),
            audioUrlEn: safeString(initialData?.audioUrlEn, initialAudio.en),
            thumbnailUrl: safeString(initialData?.thumbnailUrl),
            youtubeVideoId: safeString(initialData?.youtubeVideoId),
            audioDuration: safeNumber(initialData?.audioDuration, 0),
            accessType: safeAccessType(initialData?.accessType),
            unlockPrice: safeNumber((initialData as { unlockPrice?: unknown } | undefined)?.unlockPrice, 0),
            discountPercent: safeNumber((initialData as { discountPercent?: unknown } | undefined)?.discountPercent, 0),
            language: safeString((initialData as { language?: unknown } | undefined)?.language, selectedLocale),
            storyId: safeString(initialData?.storyId),
            unlocksAt: safeString(initialData?.unlocksAt),
            unlockAdId: safeString((initialData as { unlockAdId?: unknown } | undefined)?.unlockAdId),
        });
    }, [initialData, reset]);

    const selectedLanguage = watch('language') || selectedLocale;
    const isUploadingAudio = isUploadingAudioVi || isUploadingAudioEn;

    const handleI18nChange = (field: 'title' | 'description' | 'content' | 'audioUrl', lang: Locale, value: string) => {
        const fieldMap = {
            title: lang === 'vi' ? 'titleVi' : 'titleEn',
            description: lang === 'vi' ? 'descriptionVi' : 'descriptionEn',
            content: lang === 'vi' ? 'contentVi' : 'contentEn',
            audioUrl: lang === 'vi' ? 'audioUrlVi' : 'audioUrlEn',
        } as const;

        setValue(fieldMap[field], value as any, {
            shouldDirty: true,
            shouldValidate: true,
        });
        if (field === 'title') {
            userChangedTitle.current = true;
        }
    };

    const extractFileKey = (url: string): string | null => {
        try {
            if (!url || typeof url !== 'string') return null;
            const match = url.match(/\/f\/([^/?]+)/);
            return match && match[1] ? match[1] : null;
        } catch {
            return null;
        }
    };

    const deleteOldThumbnail = async (thumbnailUrl: string) => {
        const fileKey = extractFileKey(thumbnailUrl);
        if (!fileKey) return;

        try {
            await fetch('/api/chapter-thumbnail/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileKey }),
            });
        } catch (error) {
            console.error('Failed to delete old thumbnail:', error);
        }
    };

    const deleteOldAudio = async (audioUrl: string) => {
        const fileKey = extractFileKey(audioUrl);
        if (!fileKey) return;

        try {
            await fetch('/api/chapter-audio/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileKey }),
            });
        } catch (error) {
            console.error('Failed to delete old audio:', error);
        }
    };

    const extractYoutubeId = (url: string) => {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7] && match[7].length === 11) ? match[7] : url;
    };

    const formatContentIntoParagraphs = (text: string) => {
        const cleanText = text.trim().replace(/([^\n])\s*\[/g, '$1\n[').replace(/\s+/g, ' ');
        const existingParagraphs = cleanText.split(/\n\n+/);

        const formattedParagraphs: string[] = [];
        let paragraphNumber = 1;

        existingParagraphs.forEach((para) => {
            const words = para.trim().split(/\s+/);

            if (words.length >= 200 && words.length <= 300) {
                formattedParagraphs.push(`[Paragraph ${paragraphNumber}] ${para.trim()}`);
                paragraphNumber++;
            } else if (words.length < 200) {
                formattedParagraphs.push(`[Paragraph ${paragraphNumber}] ${para.trim()}`);
                paragraphNumber++;
            } else {
                let currentChunk: string[] = [];
                words.forEach((word, index) => {
                    currentChunk.push(word);
                    if (currentChunk.length >= 250 || index === words.length - 1) {
                        if (currentChunk.length > 0) {
                            formattedParagraphs.push(`[Paragraph ${paragraphNumber}] ${currentChunk.join(' ')}`);
                            paragraphNumber++;
                            currentChunk = [];
                        }
                    }
                });
            }
        });

        return formattedParagraphs.join('\n\n');
    };

    const handleContentPaste = (lang: Locale) => (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const formatted = formatContentIntoParagraphs(pastedText);
        handleI18nChange('content', lang, formatted);
    };

    useEffect(() => {
        const fetchStories = async () => {
            try {
                // Don't pass lang param to get all stories regardless of language
                const res = await adminApiClient.get('/stories/admin', {
                    params: {
                        all: true,
                        // Remove lang filter to show all stories
                    },
                });
                const fetchedStories = Array.isArray(res.data) ? res.data : res.data.data || [];

                // Don't filter by language - show all stories
                // Users can choose any story regardless of language
                setStories(fetchedStories);

                console.log('Fetched stories:', fetchedStories.length);

                // After stories are loaded, ensure storyId is set if it exists in initialData
                if (initialData?.storyId && fetchedStories.some((s: StoryOption) => s.id === initialData.storyId)) {
                    setValue('storyId', initialData.storyId);
                }
            } catch (error) {
                console.error('Failed to fetch stories:', error);
            }
        };
        fetchStories();
    }, [selectedLocale, initialData?.storyId, setValue]);

    useEffect(() => {
        const fetchUnlockAds = async () => {
            try {
                const res = await adminApiClient.get('/ads', {
                    params: {
                        lang: selectedLanguage,
                        routeType: 2,
                    },
                });
                const items = Array.isArray(res.data?.data) ? res.data.data : [];
                setUnlockAds(items);
            } catch (error) {
                console.error('Failed to fetch unlock ads:', error);
                setUnlockAds([]);
            }
        };

        void fetchUnlockAds();
    }, [selectedLanguage]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (storyRef.current && !storyRef.current.contains(event.target as Node)) {
                setIsStoryOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedStoryId = watch('storyId');
    const selectedStory = stories.find((s) => s.id === selectedStoryId);

    // Debug: Log selected story
    useEffect(() => {
        console.log('Selected storyId:', selectedStoryId);
        console.log('Selected story:', selectedStory);
        console.log('Available stories:', stories.length);
    }, [selectedStoryId, selectedStory, stories]);

    // Track whether user manually edited chapterNumber or title to avoid overwriting
    const userChangedChapterNumber = useRef(false);
    const userChangedTitle = useRef(false);

    // When the selected story changes, auto-compute next chapter number and
    // prefill a simple title prefix if the user hasn't typed one yet.
    useEffect(() => {
        if (!selectedStoryId) return;

        // Respect explicit initialData values when editing
        if (initialData?.storyId && initialData?.storyId === selectedStoryId && initialData?.chapterNumber) {
            return;
        }

        if (userChangedChapterNumber.current) return;

        const setNextNumber = (next: number) => {
            if (!userChangedChapterNumber.current) {
                setValue('chapterNumber', next, { shouldDirty: true, shouldValidate: true });
            }

            // Prefill titles if empty and user hasn't edited them
            const viTitle = watch('titleVi') || '';
            const enTitle = watch('titleEn') || '';
            if (!userChangedTitle.current) {
                if (!viTitle) setValue('titleVi', `Chương ${next}`, { shouldDirty: true });
                if (!enTitle) setValue('titleEn', `Chapter ${next}`, { shouldDirty: true });
            }
        };

        (async () => {
            try {
                const count = (selectedStory as any)?._count?.chapters;
                if (typeof count === 'number') {
                    setNextNumber(count + 1);
                    return;
                }

                // Fallback: fetch chapters to compute max chapterNumber
                const res = await adminApiClient.get(`/chapters`, { params: { storyId: selectedStoryId, limit: 100 } });
                const chaptersRaw = res.data.data || res.data || [];
                const maxChapter = chaptersRaw.reduce((m: number, ch: any) => {
                    const num = Number(ch?.chapterNumber ?? 0);
                    return Number.isFinite(num) ? Math.max(m, num) : m;
                }, 0);
                setNextNumber(maxChapter + 1);
            } catch (err) {
                console.warn('Could not auto-compute next chapter number:', err);
            }
        })();
    }, [selectedStoryId]);

    const filteredStories = stories.filter((s) =>
        getLocalizedText(s.title, selectedLanguage).toLowerCase().includes(storySearch.toLowerCase()),
    );

    useEffect(() => {
        if (!selectedStoryId) return;
        if (!stories.some((story) => story.id === selectedStoryId)) {
            setValue('storyId', '');
        }
    }, [selectedStoryId, setValue, stories]);

    const renderLangColumn = (lang: Locale, title: string, accentClass: string) => {
        const titleField = lang === 'vi' ? 'titleVi' : 'titleEn';
        const descriptionField = lang === 'vi' ? 'descriptionVi' : 'descriptionEn';
        const contentField = lang === 'vi' ? 'contentVi' : 'contentEn';
        const audioField = lang === 'vi' ? 'audioUrlVi' : 'audioUrlEn';
        const audioValue = watch(audioField) || '';

        return (
            <div className={`flex flex-col gap-4`}>
                <h3 className={`text-lg font-bold ${accentClass}`}>{title}</h3>

                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tiêu đề chương</label>
                    <input
                        name={titleField}
                        value={watch(titleField) || ''}
                        onChange={(e) => handleI18nChange('title', lang, e.target.value)}
                        placeholder={lang === 'vi' ? 'Chương 1: Khởi đầu...' : 'Chapter 1: Beginning...'}
                        className={`admin-input ${errors[titleField as keyof ChapterFormValues] ? 'admin-input-error' : ''}`}
                    />
                    {errors[titleField as keyof ChapterFormValues] && (
                        <p className="text-red-500 text-xs mt-1">{(errors[titleField as keyof ChapterFormValues]?.message as string) || ''}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giới thiệu chương</label>
                    <textarea
                        name={descriptionField}
                        value={watch(descriptionField) || ''}
                        onChange={(e) => handleI18nChange('description', lang, e.target.value)}
                        rows={3}
                        placeholder={lang === 'vi' ? 'Nhập giới thiệu chương...' : 'Enter chapter description...'}
                        className={`admin-input ${errors[descriptionField as keyof ChapterFormValues] ? 'admin-input-error' : ''} resize-none`}
                    />
                    {errors[descriptionField as keyof ChapterFormValues] && (
                        <p className="text-red-500 text-xs mt-1">{(errors[descriptionField as keyof ChapterFormValues]?.message as string) || ''}</p>
                    )}
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Music className="w-4 h-4 text-indigo-500" />
                        {lang === 'vi' ? 'Audio Tiếng Việt' : 'Audio English'}
                    </label>
                    <div className="relative group">
                        <UploadButton
                            endpoint="audioUploader"
                            onUploadBegin={() => {
                                if (lang === 'vi') setIsUploadingAudioVi(true);
                                if (lang === 'en') setIsUploadingAudioEn(true);
                                if (audioValue) {
                                    void deleteOldAudio(audioValue);
                                }
                            }}
                            onClientUploadComplete={async (res) => {
                                if (lang === 'vi') setIsUploadingAudioVi(false);
                                if (lang === 'en') setIsUploadingAudioEn(false);
                                if (res && res[0]) {
                                    const uploadedUrl = (res[0] as any).ufsUrl || (res[0] as any).url;
                                    if (uploadedUrl) {
                                        handleI18nChange('audioUrl', lang, uploadedUrl);
                                    }
                                }
                            }}
                            onUploadError={(error: Error) => {
                                if (lang === 'vi') setIsUploadingAudioVi(false);
                                if (lang === 'en') setIsUploadingAudioEn(false);
                                setError(audioField as any, { type: 'upload', message: `Lỗi tải audio: ${error.message}` });
                            }}
                            appearance={{
                                container: { width: '100%' },
                                button({ isUploading }) {
                                    return {
                                        width: '100%',
                                        minHeight: '130px',
                                        backgroundColor: '#f8fafc',
                                        border: '2px dashed #e2e8f0',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        color: '#334155',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                        fontSize: '0px',
                                        ...(isUploading ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                                    };
                                },
                                allowedContent: { display: 'none' },
                            }}
                            content={{
                                button({ isUploading }) {
                                    if (isUploading) {
                                        return (
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                                                <span className="text-sm font-bold">Đang tải audio...</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                                <Music className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                                                {lang === 'vi' ? 'Upload Audio Tiếng Việt' : 'Upload English Audio'}
                                            </p>
                                        </div>
                                    );
                                },
                            }}
                        />
                    </div>

                    {audioValue ? (
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
                            <audio controls src={audioValue} className="w-full h-10" />
                            <button
                                type="button"
                                onClick={async () => {
                                    await deleteOldAudio(audioValue);
                                    handleI18nChange('audioUrl', lang, '');
                                }}
                                className="p-2 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-all shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Nội dung chữ</label>
                    <textarea
                        name={contentField}
                        value={watch(contentField) || ''}
                        onChange={(e) => handleI18nChange('content', lang, e.target.value)}
                        rows={8}
                        placeholder={lang === 'vi' ? 'Dán nội dung chương tiếng Việt...' : 'Paste chapter content in English...'}
                        onPaste={handleContentPaste(lang)}
                        className={`admin-input ${errors[contentField as keyof ChapterFormValues] ? 'admin-input-error' : ''} resize-none`}
                    />
                    {errors[contentField as keyof ChapterFormValues] && (
                        <p className="text-red-500 text-xs mt-1">{(errors[contentField as keyof ChapterFormValues]?.message as string) || ''}</p>
                    )}
                    <p className="text-xs text-slate-500 ml-2 flex items-start gap-2">
                        <Scissors className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                            {lang === 'vi'
                                ? 'Để chia đoạn văn, sử dụng [doan1], [doan2], [doan3]... Ví dụ: "Nội dung đoạn 1 [doan2] Nội dung đoạn 2 [doan3] Nội dung đoạn 3"'
                                : 'To split paragraphs, use [doan1], [doan2], [doan3]... Example: "Paragraph 1 content [doan2] Paragraph 2 content [doan3] Paragraph 3 content"'
                            }
                        </span>
                    </p>
                </div>
            </div>
        );
    };

    const handleFormSubmit = async (values: ChapterFormValues) => {
        const cleanText = (value?: string) => {
            const trimmed = value?.trim();
            return trimmed ? trimmed : undefined;
        };

        const chapterNumber = Number(values.chapterNumber);
        if (!Number.isFinite(chapterNumber)) {
            setError('chapterNumber', { type: 'manual', message: 'Số chương không hợp lệ.' });
            return;
        }

        const titleVi = cleanText(values.titleVi);
        const titleEn = cleanText(values.titleEn);
        const descriptionVi = cleanText(values.descriptionVi);
        const descriptionEn = cleanText(values.descriptionEn);
        const contentViRaw = cleanText(values.contentVi);
        const contentEnRaw = cleanText(values.contentEn);
        const contentVi = contentViRaw ? DOMPurify.sanitize(contentViRaw) : undefined;
        const contentEn = contentEnRaw ? DOMPurify.sanitize(contentEnRaw) : undefined;
        const audioVi = cleanText(values.audioUrlVi);
        const audioEn = cleanText(values.audioUrlEn);

        const title = selectedLanguage === 'en' ? (titleEn || titleVi) : (titleVi || titleEn);
        const titleField = selectedLanguage === 'en' ? 'titleEn' : 'titleVi';
        if (title && title.length > 300) {
            setError(titleField as any, { type: 'manual', message: 'Chapter title is too long (max 300 characters).' });
            return;
        }

        const description = selectedLanguage === 'en' ? (descriptionEn || descriptionVi) : (descriptionVi || descriptionEn);
        const content = selectedLanguage === 'en' ? (contentEn || contentVi) : (contentVi || contentEn);
        const r2AudioUrl = selectedLanguage === 'en' ? (audioEn || audioVi) : (audioVi || audioEn);
        const thumbnailUrl = cleanText(values.thumbnailUrl);
        const youtubeInput = cleanText(values.youtubeVideoId);
        const youtubeVideoId = youtubeInput ? cleanText(extractYoutubeId(youtubeInput)) : undefined;

        if (description && description.length > 2000) {
            setError((selectedLanguage === 'en' ? 'descriptionEn' : 'descriptionVi') as any, { type: 'manual', message: 'Chapter description is too long (max 2000 characters).' });
            return;
        }
        if (content && content.length > 5000000) {
            setError((selectedLanguage === 'en' ? 'contentEn' : 'contentVi') as any, { type: 'manual', message: 'Chapter content is too long.' });
            return;
        }
        if (r2AudioUrl && r2AudioUrl.length > 500) {
            setError((selectedLanguage === 'en' ? 'audioUrlEn' : 'audioUrlVi') as any, { type: 'manual', message: 'Audio URL is too long (max 500 characters).' });
            return;
        }
        if (thumbnailUrl && thumbnailUrl.length > 500) {
            setError('thumbnailUrl' as any, { type: 'manual', message: 'Thumbnail URL is too long (max 500 characters).' });
            return;
        }
        if (youtubeVideoId && youtubeVideoId.length > 20) {
            setError('youtubeVideoId' as any, { type: 'manual', message: 'YouTube value is invalid. Please use a valid YouTube URL or video ID.' });
            return;
        }

        const payload: ChapterSubmitPayload = {
            chapterNumber,
            title: title || null,
            description: description || null,
            content: content || null,
            r2AudioUrl: r2AudioUrl || null,
            thumbnailUrl: thumbnailUrl || null,
            youtubeVideoId: youtubeVideoId || null,
            audioDuration:
                typeof values.audioDuration === 'number' && !Number.isNaN(values.audioDuration)
                    ? values.audioDuration
                    : undefined,
            accessType: values.accessType,
            unlockPrice: values.accessType === 'free' || values.accessType === 'ads'
                ? 0
                : (typeof values.unlockPrice === 'number' && Number.isFinite(values.unlockPrice)
                    ? Math.max(0, Math.floor(values.unlockPrice))
                    : 0),
            discountPercent: values.accessType === 'free' || values.accessType === 'ads'
                ? 0
                : (typeof values.discountPercent === 'number' && Number.isFinite(values.discountPercent)
                    ? Math.max(0, Math.min(100, Math.floor(values.discountPercent)))
                    : 0),
            storyId: cleanText(values.storyId),
            language: selectedLanguage,
            unlocksAt: values.accessType === 'timed' ? cleanText(values.unlocksAt) : undefined,
            unlockAdId: values.accessType === 'ads' ? cleanText(values.unlockAdId) : undefined,
        };

        try {
            await onSubmit(payload);
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
            console.error('Failed to submit chapter:', err);
            throw err;
        }
    };

    const handleFormError = (formErrors: FieldErrors<ChapterFormValues>) => {
        // Focus first invalid field if possible (no alert/toast for validation)
        const firstKey = Object.keys(formErrors)[0] as keyof ChapterFormValues | undefined;
        if (firstKey) {
            const el = document.querySelector(`[name="${String(firstKey)}"]`) as HTMLElement | null;
            if (el && typeof el.focus === 'function') el.focus();
        }
    };

    const lang = selectedLanguage as Locale;
    const titleField = lang === 'vi' ? 'titleVi' : 'titleEn';
    const descriptionField = lang === 'vi' ? 'descriptionVi' : 'descriptionEn';
    const contentField = lang === 'vi' ? 'contentVi' : 'contentEn';
    const audioField = lang === 'vi' ? 'audioUrlVi' : 'audioUrlEn';
    const audioValue = watch(audioField) || '';

    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'color', 'clean']
        ]
    };

    const formatBrackets = () => {
        const content = watch(contentField) || '';
        if (!content) return;

        let formatted = content;
        if (content.includes('<')) {
            // HTML mode (Quill)
            // Replace any "[" not following a block tag or line break with "<br>["
            formatted = content.replace(/([^>\s])\s*\[/g, '$1<br>[');
        } else {
            // Text mode
            formatted = content.replace(/([^\n])\s*\[/g, '$1\n[');
        }

        handleI18nChange('content', lang, formatted);
    };


    return (
        <form
            onSubmit={handleSubmit(handleFormSubmit, handleFormError)}
            className="flex flex-col gap-8 w-full"
        >
            {/* Top 30% Area: 2 Columns */}
            <div className="flex flex-row gap-6 p-6 overflow-y-auto max-h-[80vh]">
                {/* Column 1: Core Information */}
                <div className="w-1/2 flex flex-col space-y-4">
                    <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        Thông tin cơ bản
                    </h3>

                    {/* Story Select */}
                    <div className="flex flex-col space-y-1.5">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Chọn Truyện (Tùy chọn)</label>
                        <div className="relative" ref={storyRef}>
                            <button
                                type="button"
                                onClick={() => setIsStoryOpen(!isStoryOpen)}
                                className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 flex items-center justify-between hover:ring-2 hover:ring-indigo-500/20 transition-all shadow-sm"
                            >
                                {selectedStory ? (
                                    <span className="text-indigo-600 truncate">{getLocalizedText(selectedStory.title, selectedLanguage)}</span>
                                ) : (
                                    <span className="text-slate-400 font-medium">-- Chọn truyện --</span>
                                )}
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isStoryOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isStoryOpen && (
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
                                            type="button"
                                            onClick={() => {
                                                setValue('storyId', '');
                                                setIsStoryOpen(false);
                                                setStorySearch('');
                                            }}
                                            className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between group transition-all text-red-600 hover:bg-red-50 mb-1"
                                        >
                                            <span>-- Bỏ gán truyện --</span>
                                            {!selectedStoryId && <Check className="w-4 h-4 shrink-0" />}
                                        </button>
                                        {filteredStories.map((story) => (
                                            <button
                                                key={story.id}
                                                type="button"
                                                onClick={() => {
                                                    setValue('storyId', story.id);
                                                    setIsStoryOpen(false);
                                                    setStorySearch('');
                                                }}
                                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between group transition-all ${selectedStoryId === story.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                <span className="truncate">{getLocalizedText(story.title, selectedLanguage)}</span>
                                                {selectedStoryId === story.id && <Check className="w-4 h-4 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <input type="hidden" {...register('storyId')} />
                        </div>
                    </div>

                    {/* Chapter Number */}
                    <div className="flex flex-col space-y-1.5">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Số chương</label>
                        <input
                            type="number"
                            step="0.1"
                            {...register('chapterNumber', { valueAsNumber: true })}
                            onInput={() => { userChangedChapterNumber.current = true; }}
                            className={`admin-input ${errors.chapterNumber ? 'admin-input-error' : ''}`}
                        />
                        {errors.chapterNumber && <p className="text-red-500 text-xs mt-1">{errors.chapterNumber.message}</p>}
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ngôn ngữ</label>
                        <div className="relative">
                            <select
                                {...register('language')}
                                className={`admin-input ${errors.language ? 'admin-input-error' : ''} appearance-none`}
                            >
                                {languages.map((language) => (
                                    <option key={language.id} value={language.key}>
                                        {language.name} ({language.key})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        {errors.language && <p className="text-red-500 text-xs mt-1">{errors.language.message}</p>}
                    </div>

                    {/* Title */}
                    <div className="flex flex-col space-y-1.5">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tiêu đề chương
                            <span className="ml-2 text-indigo-500 lowercase text-xs">({lang})</span>
                        </label>
                        <input
                            name={titleField}
                            value={watch(titleField) || ''}
                            onChange={(e) => handleI18nChange('title', lang, e.target.value)}
                            placeholder="Nhập tiêu đề chương..."
                            className={`admin-input ${errors[titleField as keyof ChapterFormValues] ? 'admin-input-error' : ''}`}
                        />
                        {errors[titleField as keyof ChapterFormValues] && (
                            <p className="text-red-500 text-xs mt-1">{(errors[titleField as keyof ChapterFormValues]?.message as string) || ''}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="flex flex-col space-y-1.5">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giới thiệu ngắn</label>
                        <textarea
                            name={descriptionField}
                            value={watch(descriptionField) || ''}
                            onChange={(e) => handleI18nChange('description', lang, e.target.value)}
                            rows={4}
                            placeholder="Mô tả tóm tắt..."
                            className={`admin-input ${errors[descriptionField as keyof ChapterFormValues] ? 'admin-input-error' : ''} resize-none`}
                        />
                        {errors[descriptionField as keyof ChapterFormValues] && (
                            <p className="text-red-500 text-xs mt-1">{(errors[descriptionField as keyof ChapterFormValues]?.message as string) || ''}</p>
                        )}
                    </div>
                </div>

                {/* Column 2: Media & Configuration */}
                <div className="w-1/2 flex flex-col space-y-4">
                    <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
                        <Music className="w-5 h-5 text-amber-500" />
                        Media & Cài đặt
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Audio Upload */}
                        <div className="flex flex-col space-y-1.5 md:col-span-2">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                <span>File Audio <span className="text-indigo-500 lowercase text-xs">({lang})</span></span>
                            </label>
                            <div className="relative group">
                                <UploadButton
                                    endpoint="audioUploader"
                                    onBeforeUploadBegin={(files) => {
                                        // Read duration from local file BEFORE upload (most reliable)
                                        const file = files[0];
                                        if (file && file.type.startsWith('audio/')) {
                                            const localUrl = URL.createObjectURL(file);
                                            const audioObj = new Audio();
                                            audioObj.preload = 'metadata';
                                            audioObj.onloadedmetadata = () => {
                                                const durationInSeconds = Math.round(audioObj.duration);
                                                if (isFinite(durationInSeconds) && durationInSeconds > 0) {
                                                    setValue('audioDuration', durationInSeconds, {
                                                        shouldValidate: true,
                                                        shouldDirty: true,
                                                    });
                                                }
                                                URL.revokeObjectURL(localUrl);
                                            };
                                            audioObj.src = localUrl;
                                            audioObj.load();
                                        }
                                        return files;
                                    }}
                                    onUploadBegin={() => {
                                        if (lang === 'vi') setIsUploadingAudioVi(true);
                                        if (lang === 'en') setIsUploadingAudioEn(true);
                                        if (audioValue) void deleteOldAudio(audioValue);
                                    }}
                                    onClientUploadComplete={async (res) => {
                                        if (lang === 'vi') setIsUploadingAudioVi(false);
                                        if (lang === 'en') setIsUploadingAudioEn(false);
                                        if (res && res[0]) {
                                            const uploadedUrl = (res[0] as any).ufsUrl || (res[0] as any).url;
                                            if (uploadedUrl) {
                                                handleI18nChange('audioUrl', lang, uploadedUrl);
                                                // Fallback: try to extract duration from remote URL if local read failed
                                                if (!watch('audioDuration')) {
                                                    try {
                                                        const audio = new Audio();
                                                        audio.preload = 'metadata';
                                                        audio.addEventListener('loadedmetadata', () => {
                                                            if (isFinite(audio.duration) && audio.duration > 0) {
                                                                setValue('audioDuration', Math.round(audio.duration), { shouldDirty: true, shouldValidate: true });
                                                            }
                                                        });
                                                        audio.src = uploadedUrl;
                                                        audio.load();
                                                    } catch (e) {
                                                        console.warn('Could not extract audio duration from remote URL:', e);
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                    onUploadError={(error: Error) => {
                                        if (lang === 'vi') setIsUploadingAudioVi(false);
                                        if (lang === 'en') setIsUploadingAudioEn(false);
                                        setError(audioField as any, { type: 'upload', message: `Lỗi tải audio: ${error.message}` });
                                    }}
                                    appearance={{
                                        container: { width: '100%' },
                                        button({ isUploading }) {
                                            return {
                                                width: '100%',
                                                minHeight: '100px',
                                                backgroundColor: '#ffffff',
                                                border: '2px dashed #cbd5e1',
                                                borderRadius: '20px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px',
                                                color: '#334155',
                                                cursor: 'pointer',
                                                fontSize: '0px',
                                                ...(isUploading ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                                            };
                                        },
                                        allowedContent: { display: 'none' },
                                    }}
                                    content={{
                                        button({ isUploading }) {
                                            if (isUploading) return <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />;
                                            return <span className="text-xs font-bold text-slate-500 uppercase">Tải lên Audio</span>;
                                        },
                                    }}
                                />
                            </div>
                            {audioValue && (
                                <div className="p-3 bg-white border border-indigo-100 rounded-xl flex items-center gap-3 shadow-sm">
                                    <audio controls src={audioValue} className="w-full h-10" />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await deleteOldAudio(audioValue);
                                            handleI18nChange('audioUrl', lang, '');
                                        }}
                                        className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Thumbnail Upload */}
                        <div className="flex flex-col space-y-1.5 text-center">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider text-left block">Ảnh Thumbnail</label>
                            <div className="relative group flex flex-col items-center">
                                {watch('thumbnailUrl') ? (
                                    <div className="relative inline-block">
                                        <NextImage
                                            src={watch('thumbnailUrl') || ''}
                                            alt="Thumbnail"
                                            width={128}
                                            height={128}
                                            className="w-32 h-32 object-cover rounded-[24px] shadow-sm border border-slate-200"
                                            unoptimized
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const currentThumbnail = watch('thumbnailUrl');
                                                if (currentThumbnail) await deleteOldThumbnail(currentThumbnail);
                                                setValue('thumbnailUrl', '');
                                            }}
                                            className="absolute -top-2 -right-2 p-1.5 bg-white text-red-500 rounded-full shadow-md border border-slate-100 hover:bg-red-50"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <UploadButton
                                        endpoint="imageUploader"
                                        onUploadBegin={() => setIsUploadingThumbnail(true)}
                                        onClientUploadComplete={async (res) => {
                                            setIsUploadingThumbnail(false);
                                            if (res && res[0]) {
                                                const uploadedUrl = (res[0] as any).ufsUrl || (res[0] as any).url;
                                                if (uploadedUrl) setValue('thumbnailUrl', uploadedUrl, { shouldDirty: true, shouldValidate: true });
                                            }
                                        }}
                                        onUploadError={(error: Error) => {
                                            setIsUploadingThumbnail(false);
                                            setError('thumbnailUrl' as any, { type: 'upload', message: `Lỗi tải ảnh: ${error.message}` });
                                        }}
                                        appearance={{
                                            container: { width: '100px', margin: '0 auto' },
                                            button({ isUploading }) {
                                                return {
                                                    width: '100px',
                                                    height: '100px',
                                                    backgroundColor: '#ffffff',
                                                    border: '2px dashed #cbd5e1',
                                                    borderRadius: '24px',
                                                    cursor: 'pointer',
                                                    fontSize: '0px',
                                                    ...(isUploading ? { opacity: 0.7 } : {}),
                                                };
                                            },
                                            allowedContent: { display: 'none' },
                                        }}
                                        content={{
                                            button({ isUploading }) {
                                                if (isUploading) return <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />;
                                                return <Image className="w-8 h-8 text-slate-400" />;
                                            },
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Audio Duration */}
                        <div className="flex flex-col space-y-1.5">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" /> Thời lượng (s)

                            </label>
                            <input
                                type="number"
                                {...register('audioDuration')}
                                readOnly
                                tabIndex={-1}
                                className={`admin-input ${errors.audioDuration ? 'admin-input-error' : ''}`}
                            />
                            {errors.audioDuration && <p className="text-red-500 text-xs mt-1">{errors.audioDuration.message}</p>}
                        </div>

                        {/* Access Type & Unlock Time */}
                        <div className="flex flex-col space-y-4 md:col-span-2 mt-2">
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-amber-500" /> Phân quyền
                                </label>
                                <div className="relative">
                                    <select
                                        {...register('accessType')}
                                        className={`admin-input appearance-none`}
                                    >
                                        <option value="free">{tChapter('adminAccessFree')}</option>
                                        <option value="timed">{tChapter('adminAccessTimed')}</option>
                                        <option value="vip">{tChapter('adminAccessVip')}</option>
                                        <option value="ads">{tChapter('adminAccessAds')}</option>
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {watch('accessType') === 'timed' && (
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Thời gian mở khóa</label>
                                    <input
                                        type="datetime-local"
                                        {...register('unlocksAt')}
                                        className={`admin-input ${errors.unlocksAt ? 'admin-input-error' : ''}`}
                                    />
                                </div>
                            )}

                            {watch('accessType') !== 'free' && watch('accessType') !== 'ads' && (
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Credits mở khóa</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        {...register('unlockPrice', { valueAsNumber: true })}
                                        className={`admin-input ${errors.unlockPrice ? 'admin-input-error' : ''}`}
                                        placeholder="Ví dụ: 20"
                                    />
                                    <p className="text-xs text-slate-500">Giá credits cần để mở khóa chương này.</p>
                                    {errors.unlockPrice && <p className="text-red-500 text-xs mt-1">{errors.unlockPrice.message}</p>}
                                </div>
                            )}

                            {watch('accessType') !== 'free' && watch('accessType') !== 'ads' && (
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giảm giá (%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={1}
                                        {...register('discountPercent', { valueAsNumber: true })}
                                        className={`admin-input ${errors.discountPercent ? 'admin-input-error' : ''}`}
                                        placeholder="Ví dụ: 15"
                                    />
                                    {errors.discountPercent && <p className="text-red-500 text-xs mt-1">{errors.discountPercent.message as string}</p>}
                                </div>
                            )}

                            {watch('accessType') === 'ads' && (
                                <div className="flex flex-col space-y-1.5">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Quảng cáo mở khóa</label>
                                    <div className="relative">
                                        <select
                                            {...register('unlockAdId')}
                                            className={`admin-input ${errors.unlockAdId ? 'admin-input-error' : ''} appearance-none`}
                                        >
                                            <option value="">-- Chọn quảng cáo mở khóa --</option>
                                            {unlockAds.map((ad) => (
                                                <option key={ad.id} value={ad.id}>
                                                    {ad.title}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <p className="text-xs text-slate-500">Danh sách quảng cáo được lọc theo ngôn ngữ hiện tại và route quảng cáo mở khóa.</p>
                                    {errors.unlockAdId && <p className="text-red-500 text-xs mt-1">{errors.unlockAdId.message as string}</p>}
                                </div>
                            )}

                            <div className="flex flex-col space-y-1.5">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <Youtube className="w-4 h-4 text-red-500" /> YouTube ID
                                </label>
                                <input
                                    {...register('youtubeVideoId')}
                                    placeholder="Ví dụ: dQw4w9WgXcQ"
                                    className={`admin-input ${errors.youtubeVideoId ? 'admin-input-error' : ''}`}
                                    onChange={(e) => setValue('youtubeVideoId', extractYoutubeId(e.target.value))}
                                />
                                {errors.youtubeVideoId && <p className="text-red-500 text-xs mt-1">{errors.youtubeVideoId.message}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Full Editor */}
            <div className="flex flex-col gap-4 bg-white p-2 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="px-6 pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-0.5">
                            <h3 className="text-lg font-black text-slate-900 leading-none">Nội dung chữ</h3>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">xuống dòng để cách đoạn</span>
                        </div>
                        <button
                            type="button"
                            onClick={formatBrackets}
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-wider border border-indigo-100/50"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                            Định dạng []
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${lang === 'vi' ? 'bg-pink-100 text-pink-700' : 'bg-red-100 text-red-700'}`}>
                            {lang === 'vi' ? 'Tiếng Việt' : 'English'}
                        </span>
                    </div>
                </div>

                <div className="rounded-b-[24px] overflow-hidden">
                    {/* @ts-ignore */}
                    <ReactQuill
                        theme="snow"
                        value={watch(contentField) || ''}
                        onChange={(content: string) => handleI18nChange('content', lang, content)}
                        modules={quillModules}
                        className="w-full bg-white [&_.ql-toolbar]:border-none [&_.ql-toolbar]:bg-slate-50 [&_.ql-toolbar]:rounded-t-[20px] [&_.ql-toolbar]:p-4 [&_.ql-container]:border-none [&_.ql-container]:text-base [&_.ql-editor]:min-h-[400px] [&_.ql-editor]:p-8 [&_.ql-editor]:text-slate-700 [&_.ql-editor]:font-medium"
                        placeholder={lang === 'vi' ? 'Soạn thảo nội dung chương ở đây...' : 'Write your chapter content here...'}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 mt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all uppercase tracking-widest flex items-center gap-2"
                >
                    <X className="w-4 h-4" /> Hủy
                </button>
                <button
                    type="submit"
                    disabled={isLoading || isUploadingAudio || isUploadingThumbnail}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-[20px] text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-3 active:scale-95 disabled:opacity-50"
                >
                    {isLoading || isUploadingAudio || isUploadingThumbnail ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    {isUploadingAudio ? 'Đang tải audio...' : isUploadingThumbnail ? 'Đang tải ảnh...' : 'Lưu chương mới'}
                </button>
            </div>
        </form>
    );
};
