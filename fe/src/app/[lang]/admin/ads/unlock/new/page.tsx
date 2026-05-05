"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AdForm, { type AdFormValues } from "../../_components/AdForm";
import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";

export default function AdminAdsUnlockNewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (payload: AdFormValues) => {
    setIsSubmitting(true);
    try {
      const isGlobal = payload.languageId === 'all';
      await apiClient.post('/ads', {
        ...payload,
        languageId: isGlobal ? null : Number(payload.languageId),
        isGlobal,
        isActive: payload.isActive ?? true,
        routeType: 2,
      });
      router.push('/admin/ads/unlock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tạo quảng cáo mở khóa</h1>
      <AdForm isLoading={isSubmitting} onSubmit={handleSubmit} onCancel={() => router.push('/admin/ads/unlock')} />
    </div>
  );
}
