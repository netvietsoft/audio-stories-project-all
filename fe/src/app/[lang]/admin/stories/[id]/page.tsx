"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "@/components/shared/LocalizedLink";
import { ChevronLeft, Loader2, Newspaper } from "lucide-react";

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import { revalidateStoriesCache } from "@/app/[lang]/admin/_actions/revalidate";
import { StoryForm, type StoryFormValues } from "../_components/StoryForm";

export default function EditStoryPage() {
  const router = useRouter();
  const params = useParams<{ lang?: string; id: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const storyId = params?.id;

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<(Partial<StoryFormValues> & { id?: string; language?: string }) | null>(null);
  const [selectedLocale, setSelectedLocale] = useState('vi');

  useEffect(() => {
    if (!storyId) return;

    const fetchStory = async () => {
      try {
        const storyRes = await apiClient.get(`/stories/admin/${storyId}`);
        const story = storyRes.data;

        // Set locale based on story's language
        if (story.language) {
          setSelectedLocale(story.language);
        }

        setInitialData({
          id: story.id,
          language: story.language,
          titleVi: story.titleVi || story.title || "",
          titleEn: story.titleEn || "",
          slug: story.slug || "",
          descriptionVi: story.descriptionVi || story.description || "",
          descriptionEn: story.descriptionEn || "",
          thumbnailUrl: story.thumbnailUrl || "",
          authorId: story.author?.id,
          status: story.status || "ongoing",
          categoryIds: (story.categories || []).map((item: { category: { id: number } }) => item.category.id),
          audioUrl: story.audioUrl || "",
          facebookGroupUrl: story.facebookGroupUrl || "",
          twitterUrl: story.twitterUrl || "",
          instagramUrl: story.instagramUrl || "",
          redditUrl: story.redditUrl || "",
          whatsappUrl: story.whatsappUrl || "",
          isRecommended: !!story.isRecommended,
        });
      } catch (error) {
        console.error("Failed to fetch story:", error);
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchStory();
  }, [storyId]);

  const handleSubmit = async (data: StoryFormValues) => {
    if (!storyId) return;

    setIsSubmitting(true);
    try {
      await apiClient.patch(`/stories/${storyId}`, data);
      await revalidateStoriesCache();
      router.push(`/${currentLang}/admin/stories`);
    } catch (error) {
      console.error("Failed to update story:", error);
      const apiMessage = (error as any)?.response?.data?.message;
      const detail = Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage;
      alert(detail ? `Không thể cập nhật truyện: ${detail}` : "Không thể cập nhật truyện. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPageLoading || !initialData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <Link
              href={`/${currentLang}/admin/stories`}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-all hover:bg-slate-50 hover:text-indigo-600 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <Newspaper className="h-6 w-6 text-white" />
              </div>
              Chỉnh Sửa Truyện
            </h1>
          </div>
          <p className="ml-16 font-medium text-slate-500">Cập nhật thông tin truyện với nội dung đa ngôn ngữ.</p>
        </div>
        {/* Locale Selector - Hidden on Edit Page per user request */}
        {/* <div className="flex items-center gap-2 bg-white rounded-xl border-2 border-slate-200 p-1">
          ...
        </div> */}
      </div>

      <StoryForm
        initialData={initialData}
        selectedLocale={selectedLocale}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/${currentLang}/admin/stories`)}
        isLoading={isSubmitting}
      />
    </div>
  );
}
