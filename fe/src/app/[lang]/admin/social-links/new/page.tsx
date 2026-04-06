"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Share2 } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import SocialLinkForm, { type SocialLinkFormValues } from '../_components/SocialLinkForm';

export default function NewSocialLinkPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (payload: SocialLinkFormValues) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/social-links', payload);
      router.push('/admin/social-links');
    } catch (error) {
      console.error('Failed to create social link:', error);
      alert('Không thể tạo link. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Link href="/admin/social-links" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-blue-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-200">
              <Share2 className="h-6 w-6 text-white" />
            </span>
            Thêm Link Cộng đồng
          </h1>
        </div>
      </div>

      <SocialLinkForm isLoading={isSubmitting} onSubmit={handleSubmit} onCancel={() => router.push('/admin/social-links')} />
    </div>
  );
}
