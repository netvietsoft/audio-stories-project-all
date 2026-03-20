"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Image as ImageIcon } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import BannerForm, { type BannerSubmitPayload } from '../_components/BannerForm';

export default function NewBannerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState('vi');
  const { languages } = useAdminLanguages();

  const handleSubmit = async (payload: BannerSubmitPayload) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/banners', payload);
      router.push('/admin/banners');
    } catch (error) {
      console.error('Failed to create banner:', error);
      alert('Không thể tạo banner. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link href="/admin/banners" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <ImageIcon className="h-6 w-6 text-white" />
              </span>
              Thêm Banner Hero
            </h1>
          </div>
          <p className="ml-14 font-medium text-slate-500">Tạo banner quảng cáo mới cho Hero Section.</p>
        </div>

        <AdminLanguageDropdown
          languages={languages}
          value={selectedLocale}
          onChange={setSelectedLocale}
          className="w-full md:w-64"
        />
      </div>

      <BannerForm
        selectedLocale={selectedLocale}
        isLoading={isSubmitting}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/banners')}
      />
    </div>
  );
}
