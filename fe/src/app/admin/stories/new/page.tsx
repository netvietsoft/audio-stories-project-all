"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Newspaper, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { StoryForm } from '../_components/StoryForm';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { revalidateStoriesCache } from '@/app/admin/_actions/revalidate';

export default function NewStoryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            await apiClient.post('/stories', data);
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
            </div>

            {/* Form */}
            <StoryForm
                onSubmit={handleSubmit}
                onCancel={() => router.push('/admin/stories')}
                isLoading={isLoading}
            />
        </div>
    );
}
