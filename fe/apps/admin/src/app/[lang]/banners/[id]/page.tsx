"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import BannerForm, { type BannerFormValues, type BannerSubmitPayload } from '../_components/BannerForm';

type BannerDetail = BannerFormValues & {
  id: string;
};

export default function EditBannerPage() {
  const params = useParams<{ id: string; lang?: string }>();
  const router = useRouter();
  const id = params?.id;

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<BannerDetail | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchBanner = async () => {
      setIsPageLoading(true);
      try {
        const response = await apiClient.get(`/banners/admin/${id}`);
        setInitialData(response.data);
      } catch (error) {
        console.error('Failed to fetch banner detail:', error);
        alert('Không thể tải thông tin banner.');
      } finally {
        setIsPageLoading(false);
      }
    };

    void fetchBanner();
  }, [id]);

  const handleSubmit = async (payload: BannerSubmitPayload) => {
    if (!id) return;

    setIsSubmitting(true);
    try {
      await apiClient.patch(`/banners/${id}`, payload);
      router.push('/banners');
    } catch (error) {
      console.error('Failed to update banner:', error);
      alert('Không thể cập nhật banner. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPageLoading || !initialData) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Link href="/banners" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
              <ImageIcon className="h-6 w-6 text-white" />
            </span>
            Chỉnh sửa Banner Hero
          </h1>
        </div>
        <p className="ml-14 font-medium text-slate-500">Cập nhật nội dung quảng cáo theo từng ngôn ngữ.</p>
      </div>

      <BannerForm
        initialData={initialData}
        selectedLocale={params?.lang === 'en' ? 'en' : 'vi'}
        isLoading={isSubmitting}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/banners')}
      />
    </div>
  );
}
