"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Megaphone } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import AdForm, { type AdFormValues } from '../../_components/AdForm';

type EditAdFormValues = AdFormValues & { routeType?: number };

type AdApiDetail = {
  id: string;
  partnerName: string;
  title: string;
  contentType?: 'image' | 'iframe' | 'youtube';
  imageUrl?: string | null;
  targetUrl?: string | null;
  iframeCode?: string | null;
  youtubeId?: string | null;
  youtubePlayTime?: number | null;
  isForcedRedirect?: boolean;
  languageId?: number | null;
  isGlobal?: boolean;
  isActive: boolean;
  routeType?: number;
};

export default function EditUnlockAdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const normalizedId = id ? decodeURIComponent(id).trim() : '';

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<EditAdFormValues | null>(null);

  useEffect(() => {
    if (!normalizedId) return;

    const fetchAd = async () => {
      setIsPageLoading(true);
      try {
        const safeId = encodeURIComponent(normalizedId);
        const response = await apiClient.get(`/ads/${safeId}`);
        const data = (response.data?.data ?? response.data) as AdApiDetail;

        setInitialData({
          ...data,
          contentType: data.contentType || 'image',
          imageUrl: data.imageUrl || '',
          targetUrl: data.targetUrl || '',
          iframeCode: data.iframeCode || '',
          youtubeId: data.youtubeId || '',
          youtubePlayTime: typeof data.youtubePlayTime === 'number' ? data.youtubePlayTime : 31,
          isForcedRedirect: data.isForcedRedirect ?? false,
          languageId: data.isGlobal || !data.languageId ? 'all' : String(data.languageId),
        });
      } catch (error) {
        console.error('Failed to fetch unlock ad detail:', error);
        alert('Không thể tải thông tin quảng cáo mở khóa.');
      } finally {
        setIsPageLoading(false);
      }
    };

    void fetchAd();
  }, [normalizedId]);

  const handleSubmit = async (payload: AdFormValues) => {
    if (!normalizedId) return;

    setIsSubmitting(true);
    try {
      const isGlobal = payload.languageId === 'all';
      const safeId = encodeURIComponent(normalizedId);
      await apiClient.patch(`/ads/${safeId}`, {
        ...payload,
        languageId: isGlobal ? null : Number(payload.languageId),
        isGlobal,
        isActive: payload.isActive ?? true,
        routeType: 2,
        contentType: payload.contentType,
        imageUrl: payload.contentType === 'image' ? payload.imageUrl : null,
        targetUrl: payload.contentType !== 'iframe' ? payload.targetUrl : null,
        iframeCode: payload.contentType === 'iframe' ? payload.iframeCode : null,
        youtubeId: payload.contentType === 'youtube' ? payload.youtubeId?.trim() || null : null,
        youtubePlayTime: payload.contentType === 'youtube' ? (typeof payload.youtubePlayTime === 'number' ? payload.youtubePlayTime : 31) : null,
        isForcedRedirect: payload.isForcedRedirect ?? false,
      });

      router.push('/ads/unlock');
    } catch (error) {
      console.error('Failed to update unlock ad:', error);
      alert('Không thể cập nhật quảng cáo mở khóa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPageLoading || !initialData) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Link href="/ads/unlock" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-orange-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-200">
              <Megaphone className="h-6 w-6 text-white" />
            </span>
            Chỉnh sửa quảng cáo mở khóa
          </h1>
        </div>
      </div>

      <AdForm initialData={initialData} isLoading={isSubmitting} showUnlockAdvanced onSubmit={handleSubmit} onCancel={() => router.push('/ads/unlock')} />
    </div>
  );
}
