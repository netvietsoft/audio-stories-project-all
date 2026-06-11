"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Share2 } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import SocialLinkForm, { type SocialLinkFormValues } from '../_components/SocialLinkForm';

type SocialLinkDetail = SocialLinkFormValues & { id: string };

export default function EditSocialLinkPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const normalizedId = id ? decodeURIComponent(id).trim() : '';

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<SocialLinkDetail | null>(null);

  useEffect(() => {
    if (!normalizedId) return;

    const fetchSocialLink = async () => {
      setIsPageLoading(true);
      try {
        const safeId = encodeURIComponent(normalizedId);
        const response = await apiClient.get(`/social-links/${safeId}`);
        const data = (response.data?.data ?? response.data) as SocialLinkDetail;

        if (!data) {
          throw new Error('Social link not found.');
        }

        setInitialData(data);
      } catch (error) {
        console.error('Failed to fetch social link detail:', error);
        alert('Không thể tải thông tin link.');
        router.push('/social-links');
      } finally {
        setIsPageLoading(false);
      }
    };

    void fetchSocialLink();
  }, [normalizedId, router]);

  const handleSubmit = async (payload: SocialLinkFormValues) => {
    if (!normalizedId) return;

    setIsSubmitting(true);
    try {
      const safeId = encodeURIComponent(normalizedId);
      await apiClient.patch(`/social-links/${safeId}`, payload);
      router.push('/social-links');
    } catch (error) {
      console.error('Failed to update social link:', error);
      alert('Không thể cập nhật link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPageLoading || !initialData) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Link href="/social-links" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-blue-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-200">
              <Share2 className="h-6 w-6 text-white" />
            </span>
            Chỉnh sửa Link Cộng đồng
          </h1>
        </div>
      </div>

      <SocialLinkForm initialData={initialData} isLoading={isSubmitting} onSubmit={handleSubmit} onCancel={() => router.push('/social-links')} />
    </div>
  );
}
