"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import { ChapterForm, type ChapterSubmitPayload } from "../../stories/[id]/chapters/_components/ChapterForm";
import { ChevronLeft, Loader2, Music } from "lucide-react";

export default function EditChapterPage() {
  const router = useRouter();
  const params = useParams<{ lang: string; id: string }>();
  const currentLang = params?.lang || "vi";
  const chapterId = params?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chapter, setChapter] = useState<any>(null);

  useEffect(() => {
    if (!chapterId) return;
    const fetchChapter = async () => {
      try {
        const res = await apiClient.get(`/chapters/${chapterId}`);
        setChapter(res.data);
      } catch (error) {
        console.error("Failed to fetch chapter:", error);
        alert("Không thể tải thông tin chương. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchChapter();
  }, [chapterId]);

  const handleSubmit = async (data: ChapterSubmitPayload) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        thumbnailUrl: data.thumbnailUrl || undefined,
        youtubeVideoId: data.youtubeVideoId || undefined,
        r2AudioUrl: data.r2AudioUrl || undefined,
        storyId: data.storyId || undefined,
      };
      await apiClient.patch(`/chapters/${chapterId}`, payload);
      router.back();
    } catch (error: any) {
      console.error("Failed to update chapter:", error);
      const apiMessage = error?.response?.data?.message;
      const detail = Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage;
      alert(detail ? `Không thể lưu chương: ${detail}` : "Không thể lưu chương.");
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

  if (!chapter) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">Không tìm thấy chương.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-7xl mx-auto">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-all hover:bg-slate-50 hover:text-indigo-600 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <Music className="h-6 w-6 text-white" />
              </div>
              Chỉnh sửa chương {chapter.chapterNumber}
            </h1>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8">
          <ChapterForm
            initialData={{
              chapterNumber: chapter.chapterNumber,
              titleVi: chapter.titleVi || chapter.title,
              titleEn: chapter.titleEn || "",
              descriptionVi: chapter.descriptionVi || chapter.description || "",
              descriptionEn: chapter.descriptionEn || "",
              contentVi: chapter.contentVi || chapter.content || "",
              contentEn: chapter.contentEn || "",
              audioUrlVi: chapter.audioUrlVi || chapter.r2AudioUrl || "",
              audioUrlEn: chapter.audioUrlEn || "",
              r2AudioUrl: chapter.r2AudioUrl ?? undefined,
              thumbnailUrl: chapter.thumbnailUrl ?? undefined,
              youtubeVideoId: chapter.youtubeVideoId ?? undefined,
              audioDuration: chapter.audioDuration ?? 0,
              accessType: chapter.accessType,
              storyId: chapter.storyId,
            }}
            selectedLocale={currentLang}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
