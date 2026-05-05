"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Megaphone } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import AdForm, { type AdFormValues } from '../_components/AdForm';

type EditAdFormValues = AdFormValues & { routeType?: number };

type AdApiDetail = {
  id: string;
  partnerName: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  languageId?: number | null;
  isGlobal?: boolean;
  isActive: boolean;
  routeType?: number;
};

export default function EditAdPage() {
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
        const endpoints = [`/ads/${safeId}`, `/ads/admin/${safeId}`];

        let data: AdApiDetail | null = null;
        for (const endpoint of endpoints) {
          try {
            const response = await apiClient.get(endpoint);
            data = (response.data?.data ?? response.data) as AdApiDetail;
            break;
          } catch (error) {
            if (!axios.isAxiosError(error) || error.response?.status !== 404) {
              throw error;
            }
          }
        }

        if (!data) {
          throw new Error('Advertisement not found.');
        }

        setInitialData({
          ...data,
          languageId: data.isGlobal || !data.languageId ? 'all' : String(data.languageId),
        });
      } catch (error) {
        console.error('Failed to fetch ad detail:', error);
        alert('Không thể tải thông tin quảng cáo.');
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
      const requestBody = {
        ...payload,
        languageId: isGlobal ? null : Number(payload.languageId),
        isGlobal,
        isActive: payload.isActive ?? true,
        routeType: initialData?.routeType ?? 1,
      };
      const endpoints = [`/ads/${safeId}`, `/ads/admin/${safeId}`];

      let updated = false;
      for (const endpoint of endpoints) {
        try {
          await apiClient.patch(endpoint, requestBody);
          updated = true;
          break;
        } catch (error) {
          if (!axios.isAxiosError(error) || error.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (!updated) {
        throw new Error('Advertisement update endpoint not found.');
      }

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
