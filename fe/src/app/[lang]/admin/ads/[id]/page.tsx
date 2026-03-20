"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Megaphone } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import AdForm, { type AdFormValues } from '../_components/AdForm';

type AdDetail = AdFormValues & { id: string };

export default function EditAdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<AdDetail | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchAd = async () => {
      setIsPageLoading(true);
      try {
        const response = await apiClient.get(`/ads/${id}`);
        setInitialData(response.data);
      } catch (error) {
        console.error('Failed to fetch ad detail:', error);
        alert('Không thể tải thông tin quảng cáo.');
      } finally {
        setIsPageLoading(false);
      }
    };

    void fetchAd();
  }, [id]);

  const handleSubmit = async (payload: AdFormValues) => {
    if (!id) return;

    setIsSubmitting(true);
    try {
      await apiClient.patch(`/ads/${id}`, {
        ...payload,
        isActive: payload.isActive ?? true,
      });
      router.push('/admin/ads');
    } catch (error) {
      console.error('Failed to update ad:', error);
      alert('Không thể cập nhật quảng cáo.');
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
          <Link href="/admin/ads" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-orange-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-200">
              <Megaphone className="h-6 w-6 text-white" />
            </span>
            Chỉnh sửa Quảng cáo
          </h1>
        </div>
      </div>

      <AdForm initialData={initialData} isLoading={isSubmitting} onSubmit={handleSubmit} onCancel={() => router.push('/admin/ads')} />
    </div>
  );
}
