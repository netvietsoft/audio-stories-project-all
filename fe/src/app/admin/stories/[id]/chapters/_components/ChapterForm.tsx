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
import { UploadButton } from '@/lib/uploadthing';
import { apiClient } from '@/lib/api/api-client';

const chapterSchema = z.object({
    chapterNumber: z.number().min(0, 'Số chương không được âm'),
    title: z.string().min(1, 'Tiêu đề không được để trống'),
    content: z.string().optional(),
    r2AudioUrl: z.string().optional(),
    youtubeVideoId: z.string().optional(),
    audioDuration: z.number().optional(),
    accessType: z.enum(['free', 'timed', 'vip']),
    unlocksAt: z.string().optional(),
    storyId: z.string().uuid('Vui lòng chọn truyện').optional(),
});

type ChapterFormValues = {
    chapterNumber: number;
    title: string;
    content?: string;
    r2AudioUrl?: string;
    youtubeVideoId?: string;
    audioDuration?: number;
    accessType: 'free' | 'timed' | 'vip';
    unlocksAt?: string;
    storyId?: string;
};


interface ChapterFormProps {
    initialData?: Partial<ChapterFormValues>;
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
            content: '',
            r2AudioUrl: '',
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
                    <div className="relative group">
                        <UploadButton
                            endpoint="audioUploader"
                            onUploadProgress={() => setIsUploadingAudio(true)}
                            onClientUploadComplete={async (res) => {
                                setIsUploadingAudio(false);
                                if (res && res[0]) {
                                    setValue('r2AudioUrl', res[0].url);
                                }
                            }}
                            onUploadError={(error: Error) => {
                                setIsUploadingAudio(false);
                                alert(`Lỗi tải audio: ${error.message}`);
                            }}
                            appearance={{
                                container: { width: "100%" },
                                button({ isUploading }) {
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
                                        fontSize: "0px", // Hide default text
                                        ...(isUploading ? { opacity: 0.7, cursor: "not-allowed" } : {}),
                                    };
                                },
                                allowedContent: { display: "none" },
                            }}
                            content={{
                                button({ isUploading }) {
                                    if (isUploading) return (
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                            <span className="text-sm font-bold">Đang tải audio...</span>
                                        </div>
                                    );
                                    return (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                                <Music className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Click để chọn file âm thanh</p>
                                                <p className="text-xs font-medium text-slate-400 mt-1">Hỗ trợ file MP3, WAV (Tối đa 64MB)</p>
                                            </div>
                                        </div>
                                    );
                                }
                            }}
                        />
                        <input {...register('r2AudioUrl')} type="hidden" />
                    </div>

                    {watch('r2AudioUrl') && (
                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                            <audio controls src={watch('r2AudioUrl')} className="w-full max-w-md h-10" />
                            <button
                                type="button"
                                onClick={() => setValue('r2AudioUrl', '')}
                                className="p-2 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-all shadow-sm shrink-0"
                                title="Xóa audio"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
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
