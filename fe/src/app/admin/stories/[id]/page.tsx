"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Newspaper } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { StoryForm } from "../_components/StoryForm";

type StoryDetailResponse = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  status: "ongoing" | "completed";
  audioUrl?: string | null;
  isRecommended?: boolean;
  author?: {
    id: string;
    name: string;
  };
  categories?: Array<{
    category: {
      id: number;
      name: string;
    };
  }>;
};

export default function EditStoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storyId = params?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<any | null>(null);

  useEffect(() => {
    if (!storyId) return;

    const fetchStory = async () => {
      try {
        const res = await apiClient.get<StoryDetailResponse>(`/stories/admin/${storyId}`);
        const story = res.data;

        setInitialData({
          id: story.id,
          title: story.title,
          slug: story.slug,
          description: story.description || "",
          thumbnailUrl: story.thumbnailUrl || "",
          status: story.status,
          audioUrl: story.audioUrl || "",
          isRecommended: !!story.isRecommended,
          authorId: story.author?.id,
          categoryIds: (story.categories || []).map((item) => item.category.id),
        });
      } catch (error) {
        console.error("Failed to fetch story detail:", error);
        setInitialData(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchStory();
  }, [storyId]);

  const handleSubmit = async (data: any) => {
    if (!storyId) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/stories/${storyId}`, data);
      router.push("/admin/stories");
    } catch (error) {
      console.error("Failed to update story:", error);
      alert("Không thể cập nhật truyện. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dữ liệu truyện...
      </div>
    );
  }

  if (!initialData) {
    return <p className="text-sm text-red-600">Không tìm thấy truyện để chỉnh sửa.</p>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <Link
              href="/admin/stories"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <Newspaper className="h-6 w-6 text-white" />
              </div>
              Chỉnh sửa Truyện
            </h1>
          </div>
          <p className="ml-16 font-medium text-slate-500">Cập nhật thông tin và phần giới thiệu truyện.</p>
        </div>
      </div>

      <StoryForm initialData={initialData} onSubmit={handleSubmit} onCancel={() => router.push("/admin/stories")} isLoading={isSubmitting} />
    </div>
  );
}
