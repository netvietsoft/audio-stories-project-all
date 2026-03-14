"use client";

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Newspaper, ChevronLeft } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';
import { StoryForm } from '../_components/StoryForm';
import type { StoryFormValues } from '../_components/StoryForm';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { revalidateStoriesCache } from '@/app/[lang]/admin/_actions/revalidate';

export default function NewStoryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const initialLocale = (searchParams.get('lang') as 'vi' | 'en') || 'vi';
    const [selectedLocale, setSelectedLocale] = useState<'vi' | 'en'>(initialLocale);

    const handleSubmit = async (data: StoryFormValues) => {
        setIsLoading(true);
        try {
            // Add language field based on selected locale
            const submitData = {
                ...data,
                language: selectedLocale,
            };
            await apiClient.post('/stories', submitData);
            await revalidateStoriesCache();
            router.push('/admin/stories');
        } catch (error) {
            console.error('Failed to create story:', error);
            // In a real app, show a toast notification here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <Link
                            href="/admin/stories"
                            className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Newspaper className="w-6 h-6 text-white" />
                            </div>
                            Thêm Truyện Mới
                        </h1>
                    </div>
                    <p className="text-slate-500 font-medium ml-16">Nhập thông tin chi tiết để xuất bản tác phẩm mới lên hệ thống.</p>
                </div>
                {/* Locale Selector */}
                <div className="flex items-center gap-2 bg-white rounded-xl border-2 border-slate-200 p-1">
                    <button
                        type="button"
                        onClick={() => setSelectedLocale('vi')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            selectedLocale === 'vi'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        🇻🇳 Tiếng Việt
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedLocale('en')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            selectedLocale === 'en'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        🇬🇧 English
                    </button>
                </div>
            </div>

            {/* Form */}
            <StoryForm
                selectedLocale={selectedLocale}
                onSubmit={handleSubmit}
                onCancel={() => router.push('/admin/stories')}
                isLoading={isLoading}
            />
        </div>
    );
}
