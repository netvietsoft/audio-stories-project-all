"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Megaphone } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import AdForm, { type AdFormValues } from '../_components/AdForm';

export default function NewAdPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (payload: AdFormValues) => {
    setIsSubmitting(true);
    try {
      const isGlobal = payload.languageId === 'all';
      await apiClient.post('/ads', {
        ...payload,
        languageId: isGlobal ? null : Number(payload.languageId),
        isGlobal,
        isActive: payload.isActive ?? true,
        routeType: 1,
        contentType: payload.contentType,
        imageUrl: payload.contentType === 'image' ? payload.imageUrl : null,
        targetUrl: payload.contentType !== 'iframe' ? payload.targetUrl : null,
        iframeCode: payload.contentType === 'iframe' ? payload.iframeCode : null,
        youtubeId: payload.contentType === 'youtube' ? payload.youtubeId?.trim() || null : null,
        youtubePlayTime: payload.contentType === 'youtube' ? (typeof payload.youtubePlayTime === 'number' ? payload.youtubePlayTime : 31) : null,
        isForcedRedirect: payload.isForcedRedirect ?? false,
      });
      router.push('/admin/ads');
    } catch (error) {
      console.error('Failed to create ad:', error);
      alert('Không thể tạo quảng cáo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Link href="/admin/ads" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-orange-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-200">
              <Megaphone className="h-6 w-6 text-white" />
            </span>
            Thêm Quảng cáo mới
          </h1>
        </div>
      </div>

      <AdForm isLoading={isSubmitting} showUnlockAdvanced={false} onSubmit={handleSubmit} onCancel={() => router.push('/admin/ads')} />
    </div>
  );
}
