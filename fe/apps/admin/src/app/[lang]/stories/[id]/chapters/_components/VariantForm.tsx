"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Loader2,
    Save,
    X,
    Music,
    Clock,
    Lock,
    ChevronDown,
    Check,
    BookOpen,
    Layers,
    Star,
    Plus
} from 'lucide-react';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill: any = dynamic(() => import('react-quill-new'), { 
    ssr: false, 
    loading: () => <div className="h-[400px] bg-slate-50 animate-pulse rounded-2xl w-full border border-slate-200"></div> 
});

const variantSchema = z.object({
    title: z.string().max(300).optional(),
    description: z.string().max(2000).optional(),
    content: z.string().optional(),
    audioUrl: z.string().max(500).optional(),
    r2AudioUrl: z.string().max(500).optional(),
    audioDuration: z.preprocess((val) => (val === '' || val === null ? 0 : Number(val)), z.number().min(0)).optional(),
    unlockPrice: z.preprocess((val) => (val === '' || val === null ? 0 : Number(val)), z.number().min(0, 'Giá mở khóa không được âm')),
    orderIndex: z.preprocess((val) => (val === '' || val === null ? 0 : Number(val)), z.number().min(0, 'Thứ tự hiển thị không được âm')),
    isDefault: z.boolean().default(false),
    nextChapterId: z.string().uuid().nullable().optional(),
    nextVariantId: z.string().uuid().nullable().optional(),
});

export type VariantFormValues = z.infer<typeof variantSchema>;

interface VariantFormProps {
    initialData?: Partial<VariantFormValues>;
    onSubmit: (data: VariantFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
    chapterId: string;
    storyId?: string;
}

interface ChapterOption {
    id: string;
    chapterNumber: number;
    title: string;
}

interface VariantOption {
    id: string;
    title: string;
    unlockPrice: number;
}

export const VariantForm = ({ 
    initialData, 
    onSubmit, 
    onCancel, 
    isLoading,
    chapterId,
    storyId
}: VariantFormProps) => {
    const [chapters, setChapters] = useState<ChapterOption[]>([]);
    const [nextChapterVariants, setNextChapterVariants] = useState<VariantOption[]>([]);
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);
    const [isFetchingChapters, setIsFetchingChapters] = useState(false);
    const [isFetchingNextVariants, setIsFetchingNextVariants] = useState(false);
    const variantAudioInputRef = useRef<HTMLInputElement | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isDirty },
    } = useForm<VariantFormValues>({
        resolver: zodResolver(variantSchema) as any,
        defaultValues: {
            title: initialData?.title || '',
            description: initialData?.description || '',
            content: initialData?.content || '',
            audioUrl: initialData?.audioUrl || '',
            r2AudioUrl: initialData?.r2AudioUrl || '',
            audioDuration: initialData?.audioDuration || 0,
            unlockPrice: initialData?.unlockPrice || 0,
            orderIndex: initialData?.orderIndex || 0,
            isDefault: initialData?.isDefault || false,
            nextChapterId: initialData?.nextChapterId || null,
            nextVariantId: initialData?.nextVariantId || null,
        },
    });

    const selectedNextChapterId = watch('nextChapterId');

    // Fetch chapters for the branching logic (excluding the current chapter's parent)
    useEffect(() => {
        if (!storyId) return;
        const fetchChapters = async () => {
            setIsFetchingChapters(true);
            try {
                const res = await apiClient.get(`/stories/${storyId}/chapters`);
                setChapters(unwrapList<ChapterOption>(res.data).filter((c: any) => c.id !== chapterId));
            } catch (error) {
                console.error('Failed to fetch chapters:', error);
            } finally {
                setIsFetchingChapters(false);
            }
        };
        fetchChapters();
    }, [storyId, chapterId]);

    // Fetch variants for the selected next chapter
    useEffect(() => {
        if (!selectedNextChapterId) {
            setNextChapterVariants([]);
            setValue('nextVariantId', null);
            return;
        }
        const fetchNextVariants = async () => {
            setIsFetchingNextVariants(true);
            try {
                const res = await apiClient.get(`/chapters/${selectedNextChapterId}/variants`);
                setNextChapterVariants(unwrapList<VariantOption>(res.data));
            } catch (error) {
                console.error('Failed to fetch next variants:', error);
            } finally {
                setIsFetchingNextVariants(false);
            }
        };
        fetchNextVariants();
    }, [selectedNextChapterId, setValue]);

    const handleFormSubmit = async (values: VariantFormValues) => {
        const sanitizedData = {
            ...values,
            content: values.content ? DOMPurify.sanitize(values.content) : '',
        };
        await onSubmit(sanitizedData);
    };

    const addParagraph = () => {
        const content = watch('content') || '';
        
        // Find all existing [doanX] markers
        const doanMatches = content.match(/\[doan(\d+)\]/gi) || [];
        
        // Get the highest number
        let maxNumber = 0;
        doanMatches.forEach(match => {
            const num = parseInt(match.match(/\d+/)?.[0] || '0');
            if (num > maxNumber) maxNumber = num;
        });
        
        // Next number
        const nextNumber = maxNumber + 1;
        const newMarker = `[doan${nextNumber}]`;
        
        // Add marker at the end
        const updatedContent = content ? `${content}\n${newMarker} ` : `${newMarker} `;
        setValue('content', updatedContent, { shouldDirty: true });
    };

    const addDienBien = () => {
        const content = watch('content') || '';
        const marker = ` [DIEN_BIEN] `;
        const updatedContent = content ? `${content}${marker}` : marker;
        setValue('content', updatedContent, { shouldDirty: true });
    };

    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'color', 'clean']
        ]
    };

    // Upload file audio variant lên R2 qua BE POST /upload/audio (folder=chapters), thay UploadThing.
    const handleVariantAudioSelect = async (file: File | null | undefined) => {
        if (!file) return;
        setIsUploadingAudio(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'chapters');
            const res = await apiClient.post('/upload/audio', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const data = res.data as { data?: { url?: string }; url?: string } | undefined;
            const uploadedUrl = data?.data?.url ?? data?.url ?? '';
            if (uploadedUrl) setValue('r2AudioUrl', uploadedUrl, { shouldDirty: true });
            else alert('Lỗi tải audio: không nhận được URL từ máy chủ.');
        } catch (err: any) {
            alert(`Lỗi tải audio: ${err?.response?.data?.error?.message || err?.message || 'Vui lòng thử lại.'}`);
        } finally {
            setIsUploadingAudio(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-8 w-full">
            {/* Row 1: Audio & Duration */}
            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 space-y-4">
                <div className="flex items-center gap-3 mb-2 ml-1">
                    <Music className="w-6 h-6 text-amber-500" />
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Audio & Đa phương tiện</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Audio Upload */}
                    <div className="flex-1 w-full space-y-3">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider ml-1 text-[11px]">File Audio</label>
                        <div className="relative">
                            <input
                                ref={variantAudioInputRef}
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    void handleVariantAudioSelect(file);
                                    e.target.value = '';
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => variantAudioInputRef.current?.click()}
                                disabled={isUploadingAudio}
                                className="flex h-24 w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-500 transition-all hover:border-indigo-400 hover:bg-slate-50 disabled:opacity-50"
                            >
                                {isUploadingAudio ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Music className="w-5 h-5" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Chọn file audio</span>
                                    </div>
                                )}
                            </button>
                        </div>

                        {(watch('r2AudioUrl') || watch('audioUrl')) && (
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                    <Music className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-slate-900 truncate">{watch('r2AudioUrl') || watch('audioUrl')}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setValue('r2AudioUrl', '', { shouldDirty: true });
                                        setValue('audioUrl', '', { shouldDirty: true });
                                    }}
                                    className="p-1.5 hover:bg-white text-red-500 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Duration */}
                    <div className="w-full md:w-64 space-y-3">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider ml-1 text-[11px]">Thời lượng (giây)</label>
                        <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                {...register('audioDuration')}
                                className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 2: Metadata & Branching */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Column 2.1: Title & Description */}
                <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-5">
                    <div className="flex items-center gap-3 mb-1 ml-1">
                        <BookOpen className="w-6 h-6 text-indigo-500" />
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thông tin cơ bản</h3>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider ml-1">Tiêu đề</label>
                        <input
                            {...register('title')}
                            placeholder="Ví dụ: Diễn biến bất ngờ..."
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all"
                        />
                        {errors.title && <p className="text-[11px] font-bold text-red-500 ml-2">{errors.title.message}</p>}
                    </div>

                    <div className="space-y-2 flex-1">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider ml-1">Mô tả ngắn</label>
                        <textarea
                            {...register('description')}
                            rows={3}
                            placeholder="Tóm tắt diễn biến này..."
                            className="w-full h-[calc(100%-28px)] bg-white border border-slate-200 rounded-[24px] py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Column 2.2: Settings & Branching */}
                <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-5">
                    <div className="flex items-center gap-3 mb-1 ml-1">
                        <Layers className="w-6 h-6 text-emerald-500" />
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cài đặt & Nhánh truyện</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-1">Giá mở khóa</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="number"
                                    {...register('unlockPrice')}
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-1">Thứ tự</label>
                            <input
                                type="number"
                                {...register('orderIndex')}
                                className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <input
                            type="checkbox"
                            id="isDefault"
                            {...register('isDefault')}
                            className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="isDefault" className="flex items-center gap-2 cursor-pointer">
                            <Star className={`w-3.5 h-3.5 ${watch('isDefault') ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Biến thể mặc định</span>
                        </label>
                    </div>
                    <div className="space-y-3 pt-1">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-1">Dẫn đến chương</label>
                            <div className="relative">
                                <select
                                    {...register('nextChapterId')}
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 shadow-sm outline-none appearance-none"
                                >
                                    <option value="">Tiếp theo (Mặc định)</option>
                                    {chapters.map((c) => (
                                        <option key={c.id} value={c.id}>Chương {c.chapterNumber}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {selectedNextChapterId && nextChapterVariants.length > 0 && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-1 text-indigo-600">Dẫn đến Biến thể cụ thể</label>
                                <div className="relative">
                                    <select
                                        {...register('nextVariantId')}
                                        className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl py-3 px-6 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500/20 shadow-sm outline-none appearance-none"
                                    >
                                        <option value="">Nhánh mặc định của chương</option>
                                        {nextChapterVariants.map((v) => (
                                            <option key={v.id} value={v.id}>{v.title}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3: Full Width Content Editor */}
            <div className="flex-1 min-h-[500px] bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-6 h-6 text-indigo-500" />
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Kịch bản chi tiết</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={addParagraph}
                            className="text-[10px] font-black text-emerald-600 hover:text-white hover:bg-emerald-600 bg-emerald-50 px-4 py-2 rounded-full transition-all flex items-center gap-2 uppercase tracking-widest border border-emerald-100"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Thêm đoạn
                        </button>
                        <button
                            type="button"
                            onClick={addDienBien}
                            className="text-[10px] font-black text-indigo-600 hover:text-white hover:bg-indigo-600 bg-indigo-50 px-4 py-2 rounded-full transition-all flex items-center gap-2 uppercase tracking-widest border border-indigo-100"
                            title="Thêm điểm ngắt để hiển thị các biến thể con"
                        >
                            <Layers className="w-3.5 h-3.5" />
                            Thêm Diễn biến con
                        </button>
                    </div>
                </div>
                <div className="flex-1 flex flex-col min-h-[400px]">
                    <ReactQuill
                        theme="snow"
                        value={watch('content')}
                        onChange={(val: string) => setValue('content', val, { shouldDirty: true })}
                        modules={quillModules}
                        className="flex-1 flex flex-col quill-editor-full"
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-4 p-6 bg-slate-50/50 rounded-[32px] border border-slate-100 mt-8">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-8 py-3 text-sm font-black text-slate-500 hover:text-slate-900 hover:bg-white rounded-2xl transition-all uppercase tracking-widest"
                >
                    Hủy bỏ
                </button>
                <button
                    type="submit"
                    disabled={isLoading || isUploadingAudio}
                    className={`flex items-center gap-3 px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[20px] text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Lưu Biến thể
                        </>
                    )}
                </button>
            </div>

            <style jsx global>{`
                .quill-editor-full .ql-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 400px;
                }
                .quill-editor-full .ql-editor {
                    flex: 1;
                    font-size: 16px;
                    line-height: 1.6;
                }
            `}</style>
        </form>
    );
};
