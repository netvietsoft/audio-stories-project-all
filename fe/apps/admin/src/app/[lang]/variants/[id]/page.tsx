"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatChapterTitle, cleanChapterTitle } from "@/lib/formatChapterTitle";
import { useRouter, useParams } from "next/navigation";
import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import { unwrapData } from "@/lib/api/unwrap";
import { VariantForm, type VariantFormValues } from "../../stories/[id]/chapters/_components/VariantForm";
import { ChevronLeft, Loader2, Layers } from "lucide-react";

export default function EditVariantPage() {
  const router = useRouter();
  const params = useParams<{ lang: string; id: string }>();
  const currentLang = params?.lang || "vi";
    const t = useTranslations("StoryChapterClient");

  const variantId = params?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variant, setVariant] = useState<any>(null);
  const [chapter, setChapter] = useState<any>(null);

  useEffect(() => {
    if (!variantId) return;
    const fetchData = async () => {
      try {
        const variantRes = await apiClient.get(`/chapter-variants/${variantId}`);
        const variantData = unwrapData(variantRes.data);
        setVariant(variantData);

        if (variantData?.chapterId) {
          const chapterRes = await apiClient.get(`/chapters/${variantData.chapterId}`);
          setChapter(unwrapData(chapterRes.data));
        }
      } catch (error) {
        console.error("Failed to fetch variant data:", error);
        alert("Không thể tải thông tin biến thể. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [variantId]);

  const handleSubmit = async (data: VariantFormValues) => {
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/chapter-variants/${variantId}`, data);
      router.back();
    } catch (error: any) {
      console.error("Failed to update variant:", error);
      const apiMessage = error?.response?.data?.message;
      const detail = Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage;
      alert(detail ? `Không thể lưu biến thể: ${detail}` : "Không thể lưu biến thể.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!variant) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">Không tìm thấy biến thể.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-7xl mx-auto p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-all hover:bg-slate-50 hover:text-indigo-600 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col">
                <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
                    <Layers className="h-6 w-6 text-white" />
                </div>
                Chỉnh sửa Biến thể
                </h1>
                {chapter && (
                  <p className="text-sm font-bold text-slate-400 mt-2 ml-1">
                    {formatChapterTitle(t("chapterKeyword"), chapter.chapterNumber, cleanChapterTitle(chapter.titleVi || chapter.title))}
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-1 md:p-8">
          <VariantForm
            initialData={{
              title: variant.title,
              description: variant.description || "",
              content: variant.content || "",
              audioUrl: variant.audioUrl || "",
              r2AudioUrl: variant.r2AudioUrl || "",
              audioDuration: variant.audioDuration || 0,
              unlockPrice: variant.unlockPrice || 0,
              orderIndex: variant.orderIndex || 0,
              isDefault: variant.isDefault || false,
              nextChapterId: variant.nextChapterId || null,
              nextVariantId: variant.nextVariantId || null,
            }}
            chapterId={variant.chapterId}
            storyId={chapter?.storyId}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
