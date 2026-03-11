"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
} from 'lucide-react';

import { apiClient } from '@/lib/api/api-client';
import { AudioUploader } from '@/components/upload/AudioUploader';

const chapterSchema = z.object({
    chapterNumber: z.coerce.number().min(0, 'Số chương không được âm'),
    title: z.string().min(1, 'Tiêu đề không được để trống'),
    description: z.string().max(2000, 'Giới thiệu chương tối đa 2000 ký tự').optional(),
    content: z.string().optional(),
    audioUrl: z.string().optional(),
    youtubeVideoId: z.string().optional(),
    audioDuration: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? undefined : Number(value)),
        z.number().min(0, 'Thời lượng không hợp lệ').optional(),
    ),
    accessType: z.enum(['free', 'timed', 'vip']),
    storyId: z.preprocess(
        (value) => (value === '' || value === null || typeof value === 'undefined' ? undefined : value),
        z.string().uuid('Vui lòng chọn truyện').optional(),
    ),
});

type ChapterFormValues = {
    chapterNumber: number;
    title: string;
    description?: string;
    content?: string;
    audioUrl?: string;
    youtubeVideoId?: string;
    audioDuration?: number;
    accessType: 'free' | 'timed' | 'vip';
    unlocksAt?: string;
    storyId?: string;
};


interface ChapterFormProps {
    initialData?: Partial<ChapterFormValues> & { r2AudioUrl?: string };
    onSubmit: (data: ChapterFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const ChapterForm = ({ initialData, onSubmit, onCancel, isLoading }: ChapterFormProps) => {
    const [stories, setStories] = useState<any[]>([]);
    const [isStoryOpen, setIsStoryOpen] = useState(false);
    const [storySearch, setStorySearch] = useState('');
    const storyRef = useRef<HTMLDivElement>(null);
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<ChapterFormValues>({
        resolver: zodResolver(chapterSchema) as any,
        defaultValues: {
            chapterNumber: 1,
            title: '',
            description: '',
            content: '',
            audioUrl: initialData?.audioUrl || initialData?.r2AudioUrl || '',
            youtubeVideoId: '',
            audioDuration: 0,
            accessType: 'free' as any,
            ...initialData as any,
        },
    });

    useEffect(() => {
        const fetchStories = async () => {
            try {
                const res = await apiClient.get('/stories?all=true');
                setStories(Array.isArray(res.data) ? res.data : res.data.data || []);
            } catch (error) {
                console.error('Failed to fetch stories:', error);
            }
        };
        fetchStories();
    }, []);

    // Handle click outside for searchable select
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
    const selectedStory = stories.find(s => s.id === selectedStoryId);
    const filteredStories = stories.filter(s =>
        (s.title || '').toLowerCase().includes(storySearch.toLowerCase())
    );

    const extractYoutubeId = (url: string) => {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7] && match[7].length === 11) ? match[7] : url;
    };

    const formatContentIntoParagraphs = (text: string) => {
        // Remove extra whitespace and split into sentences
        const cleanText = text.trim().replace(/\s+/g, ' ');
        
        // Split by existing paragraph markers or double line breaks
        const existingParagraphs = cleanText.split(/\n\n+/);
        
        const formattedParagraphs: string[] = [];
        let paragraphNumber = 1;
        
        existingParagraphs.forEach(para => {
            const words = para.trim().split(/\s+/);
            
            // If paragraph is already within range, keep it
            if (words.length >= 200 && words.length <= 300) {
                formattedParagraphs.push(`[Paragraph ${paragraphNumber}] ${para.trim()}`);
                paragraphNumber++;
            } else if (words.length < 200) {
                // If too short, just add it as is
                formattedParagraphs.push(`[Paragraph ${paragraphNumber}] ${para.trim()}`);
                paragraphNumber++;
            } else {
                // If too long, split into chunks of 200-300 words
                let currentChunk: string[] = [];
                
                words.forEach((word, index) => {
                    currentChunk.push(word);
                    
                    // Create new paragraph when reaching 250 words (middle of range)
                    // or at the end of the array
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

    const handleContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const formatted = formatContentIntoParagraphs(pastedText);
        setValue('content', formatted);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Story Selection */}
            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    Chọn Truyện
                </label>
                <div className="relative" ref={storyRef}>
                    <button
                        type="button"
                        onClick={() => setIsStoryOpen(!isStoryOpen)}
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 flex items-center justify-between hover:ring-2 hover:ring-indigo-500/10 transition-all shadow-sm"
                    >
                        {selectedStory ? (
                            <span className="text-indigo-600 truncate">{selectedStory.title}</span>
                        ) : (
                            <span className="text-slate-400 font-medium">-- Chọn truyện cho chương này --</span>
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
                                {filteredStories.length > 0 ? (
                                    filteredStories.map((story) => (
                                        <button
                                            key={story.id}
                                            type="button"
                                            onClick={() => {
                                                setValue('storyId', story.id);
                                                setIsStoryOpen(false);
                                                setStorySearch('');
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between group transition-all ${selectedStoryId === story.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                                        >
                                            <span className="truncate">{story.title}</span>
                                            {selectedStoryId === story.id && <Check className="w-4 h-4 shrink-0" />}
                                        </button>
                                    ))
                                ) : (
                                    <p className="p-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Không tìm thấy truyện</p>
                                )}
                            </div>
                        </div>
                    )}
                    <input type="hidden" {...register('storyId')} />
                </div>
                {errors.storyId && <p className="text-xs font-bold text-red-500 ml-2">{errors.storyId.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Số chương</label>
                    <input
                        type="number"
                        step="0.1"
                        {...register('chapterNumber', { valueAsNumber: true })}
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-slate-700"
                    />
                    {errors.chapterNumber && <p className="text-xs font-bold text-red-500 ml-2">{errors.chapterNumber.message}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tiêu đề chương</label>
                    <input
                        {...register('title')}
                        placeholder="Chương 1: Khởi đầu..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-slate-700"
                    />
                    {errors.title && <p className="text-xs font-bold text-red-500 ml-2">{errors.title.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giới thiệu chương (tùy chọn)</label>
                <textarea
                    {...register('description')}
                    rows={3}
                    placeholder="Nhập phần giới thiệu ngắn cho chương..."
                    className="w-full bg-slate-50 border-none rounded-[24px] py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none font-bold text-slate-700"
                />
                {errors.description && <p className="text-xs font-bold text-red-500 ml-2">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Nội dung chữ (tùy chọn)</label>
                <textarea
                    {...register('content')}
                    rows={6}
                    placeholder="Dán nội dung chương vào đây..."
                    onPaste={handleContentPaste}
                    className="w-full bg-slate-50 border-none rounded-[24px] py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none font-bold text-slate-700"
                />
                <p className="text-xs font-medium text-slate-500 ml-2">
                    Paste nội dung vào đây, hệ thống sẽ tự động chia thành các đoạn 200-300 từ với format [Paragraph N]
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 md:col-span-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Music className="w-5 h-5 text-indigo-500" />
                        File Âm Thanh (MP3/WAV)
                    </label>
                    <AudioUploader
                        value={watch('audioUrl')}
                        disabled={isLoading}
                        onUploadingChange={setIsUploadingAudio}
                        onChange={(url) => setValue('audioUrl', url, { shouldDirty: true, shouldValidate: true })}
                    />
                    <input {...register('audioUrl')} type="hidden" />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Youtube className="w-4 h-4 text-red-500" />
                        YouTube ID (Dự phòng)
                    </label>
                    <input
                        {...register('youtubeVideoId')}
                        placeholder="dQw4w9WgXcQ"
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-slate-700"
                        onChange={(e) => {
                            const val = e.target.value;
                            setValue('youtubeVideoId', extractYoutubeId(val));
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Thời lượng (giây)
                    </label>
                    <input
                        type="number"
                        {...register('audioDuration')}
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    {errors.audioDuration && <p className="text-xs font-bold text-red-500 ml-2">{errors.audioDuration.message}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-500" />
                        Loại truy cập
                    </label>
                    <div className="relative">
                        <select
                            {...register('accessType')}
                            className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                        >
                            <option value="free">Miễn phí (Free)</option>
                            <option value="timed">Mở khóa theo thời gian</option>
                            <option value="vip">Dành cho VIP</option>
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Unlock Time Picker - Only show when accessType is 'timed' */}
                {watch('accessType') === 'timed' && (
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            Thời gian mở khóa
                        </label>
                        <input
                            type="datetime-local"
                            {...register('unlocksAt')}
                            className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                        <p className="text-xs font-medium text-slate-500 ml-2">
                            Chương sẽ tự động mở khóa khi đến thời điểm này
                        </p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
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
                    {isUploadingAudio ? 'Đang tải audio...' : 'Lưu chương'}
                </button>
            </div>
        </form>
    );
};
