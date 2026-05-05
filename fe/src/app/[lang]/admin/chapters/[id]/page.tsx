"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import { ChapterForm, type ChapterSubmitPayload } from "../../stories/[id]/chapters/_components/ChapterForm";
import { ChevronLeft, Loader2, Music } from "lucide-react";

type ChapterDetail = {
  chapterNumber: number;
  language?: string | null;
  title?: string | null;
  titleVi?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  content?: string | null;
  contentVi?: string | null;
  contentEn?: string | null;
  audioUrlVi?: string | null;
  audioUrlEn?: string | null;
  r2AudioUrl?: string | null;
  thumbnailUrl?: string | null;
  youtubeVideoId?: string | null;
  audioDuration?: number | null;
  accessType: "free" | "timed" | "vip" | "ads";
  unlockPrice?: number;
  unlockAdId?: string | null;
  storyId?: string | null;
};

const extractApiMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const maybeError = error as {
    response?: {
      data?: {
        message?: string | string[];
      };
    };
  };

  const apiMessage = maybeError.response?.data?.message;
  return Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage;
};

export default function ChapterEditorPage() {
  const router = useRouter();
  const params = useParams<{ lang: string; id: string }>();
  const currentLang = params?.lang || "vi";
  const chapterId = params?.id;
  const isCreateMode = chapterId === "new";

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);

  useEffect(() => {
    if (!chapterId) return;

    if (isCreateMode) {
      setChapter(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchChapter = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/chapters/${chapterId}`);
        if (cancelled) return;
        setChapter(res.data as ChapterDetail);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch chapter:", error);
        alert("Không thể tải thông tin chương. Vui lòng thử lại.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchChapter();

    return () => {
      cancelled = true;
    };
  }, [chapterId, isCreateMode]);

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

      if (isCreateMode) {
        await apiClient.post("/chapters", payload);
      } else {
        await apiClient.patch(`/chapters/${chapterId}`, payload);
        // Refetch chapter data after successful update
        const res = await apiClient.get(`/chapters/${chapterId}`);
        setChapter(res.data as ChapterDetail);
      }

      router.push(`/${currentLang}/admin/chapters`);
      router.refresh();
    } catch (error: unknown) {
      console.error("Failed to save chapter:", error);
      const detail = extractApiMessage(error);
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

  if (!isCreateMode && !chapter) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">Không tìm thấy chương.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <button
              onClick={() => router.push(`/${currentLang}/admin/chapters`)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-all hover:bg-slate-50 hover:text-indigo-600 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <Music className="h-6 w-6 text-white" />
              </div>
              {isCreateMode ? "Thêm chương mới" : `Chỉnh sửa chương ${chapter?.chapterNumber ?? ""}`}
            </h1>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="p-8">
          <ChapterForm
            initialData={
              isCreateMode
                ? {}
                : {
                    chapterNumber: chapter?.chapterNumber,
                    titleVi: chapter?.titleVi || chapter?.title || "",
                    titleEn: chapter?.titleEn || "",
                    descriptionVi: chapter?.descriptionVi || chapter?.description || "",
                    descriptionEn: chapter?.descriptionEn || "",
                    contentVi: chapter?.contentVi || chapter?.content || "",
                    contentEn: chapter?.contentEn || "",
                    audioUrlVi: chapter?.audioUrlVi || chapter?.r2AudioUrl || "",
                    audioUrlEn: chapter?.audioUrlEn || "",
                    r2AudioUrl: chapter?.r2AudioUrl ?? undefined,
                    thumbnailUrl: chapter?.thumbnailUrl ?? undefined,
                    youtubeVideoId: chapter?.youtubeVideoId ?? undefined,
                    audioDuration: chapter?.audioDuration ?? 0,
                    accessType: chapter?.accessType,
                    unlockPrice: chapter?.unlockPrice ?? 0,
                    unlockAdId: chapter?.unlockAdId ?? undefined,
                    language: chapter?.language ?? currentLang,
                    storyId: chapter?.storyId ?? undefined,
                  }
            }
            selectedLocale={currentLang}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/${currentLang}/admin/chapters`)}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
