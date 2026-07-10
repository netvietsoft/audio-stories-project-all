"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Image as ImageIcon, Loader2, Save, Trash2, X } from 'lucide-react';
import NextImage from 'next/image';

import { UploadButton } from '@/lib/uploadthing';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';

const bannerSchema = z
  .object({
    titleVi: z.string().optional(),
    titleEn: z.string().optional(),
    subtitleVi: z.string().optional(),
    subtitleEn: z.string().optional(),
    imageUrl: z.string().min(1, 'Vui lòng tải ảnh banner'),
    targetUrl: z.string().min(1, 'Vui lòng nhập link đích'),
    storyId: z.string().optional(),
    order: z.number().int().min(0),
    isActive: z.boolean().optional(),
  })
  .refine((data) => (data.titleVi || '').trim() || (data.titleEn || '').trim(), {
    message: 'Phải có ít nhất một tiêu đề (Tiếng Việt hoặc English)',
    path: ['titleVi'],
  });

export type BannerFormValues = z.infer<typeof bannerSchema>;

type StoryOption = {
  id: string;
  slug: string;
  title: string;
};

export type BannerSubmitPayload = {
  titleVi?: string;
  titleEn?: string;
  subtitleVi?: string;
  subtitleEn?: string;
  imageUrl: string;
  targetUrl: string;
  storyId?: string;
  order: number;
  isActive: boolean;
};

type BannerFormProps = {
  initialData?: Partial<BannerFormValues>;
  selectedLocale: string;
  isLoading?: boolean;
  onSubmit: (payload: BannerSubmitPayload) => Promise<void>;
  onCancel: () => void;
};

export default function BannerForm({ initialData, selectedLocale, isLoading, onSubmit, onCancel }: BannerFormProps) {
  const [stories, setStories] = useState<StoryOption[]>([]);
  const [isFetchingStories, setIsFetchingStories] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      titleVi: initialData?.titleVi || '',
      titleEn: initialData?.titleEn || '',
      subtitleVi: initialData?.subtitleVi || '',
      subtitleEn: initialData?.subtitleEn || '',
      imageUrl: initialData?.imageUrl || '',
      targetUrl: initialData?.targetUrl || '',
      storyId: initialData?.storyId || '',
      order: initialData?.order ?? 0,
      isActive: initialData?.isActive ?? true,
    },
  });

  useEffect(() => {
    const fetchStories = async () => {
      setIsFetchingStories(true);
      try {
        const response = await apiClient.get('/stories/admin', {
          params: {
            page: 1,
            limit: 200,
            lang: selectedLocale,
          },
        });

        const rows = unwrapList(response.data);
        setStories(
          rows.map((item: any) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
          })),
        );
      } catch (error) {
        console.error('Failed to fetch stories for banner form:', error);
        setStories([]);
      } finally {
        setIsFetchingStories(false);
      }
    };

    void fetchStories();
  }, [selectedLocale]);

  const previewUrl = watch('imageUrl');
  const selectedStoryId = watch('storyId');

  const currentStory = useMemo(() => {
    return stories.find((item) => item.id === selectedStoryId);
  }, [selectedStoryId, stories]);

  const submitForm = async (values: BannerFormValues) => {
    const clean = (value?: string) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    await onSubmit({
      titleVi: clean(values.titleVi),
      titleEn: clean(values.titleEn),
      subtitleVi: clean(values.subtitleVi),
      subtitleEn: clean(values.subtitleEn),
      imageUrl: values.imageUrl,
      targetUrl: values.targetUrl.trim(),
      storyId: values.storyId?.trim() || undefined,
      order: values.order,
      isActive: values.isActive ?? true,
    });
  };

  return (
    <form onSubmit={handleSubmit(submitForm)} className="mx-auto max-w-6xl space-y-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="space-y-8 p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Ảnh banner</label>
              {previewUrl ? (
                <div className="group relative aspect-[16/6] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  <NextImage src={previewUrl} alt="Banner preview" fill className="h-full w-full object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setValue('imageUrl', '')}
                    className="absolute right-3 top-3 rounded-lg bg-white/90 p-2 text-red-500 shadow transition hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <UploadButton
                  endpoint="imageUploader"
                  onUploadProgress={() => setIsUploadingImage(true)}
                  onUploadError={(error: Error) => {
                    setIsUploadingImage(false);
                    alert(`Lỗi tải ảnh: ${error.message}`);
                  }}
                  onClientUploadComplete={(res) => {
                    setIsUploadingImage(false);
                    const uploadedUrl = (res?.[0] as any)?.ufsUrl || (res?.[0] as any)?.url;
                    if (uploadedUrl) setValue('imageUrl', uploadedUrl);
                  }}
                  appearance={{
                    container: { width: '100%' },
                    button: {
                      width: '100%',
                      minHeight: '170px',
                      borderRadius: '16px',
                      border: '2px dashed #e2e8f0',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      fontSize: '0px',
                    },
                    allowedContent: { display: 'none' },
                  }}
                  content={{
                    button({ isUploading }) {
                      if (isUploading) {
                        return (
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                            <span className="text-sm font-bold text-slate-700">Đang tải ảnh banner...</span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col items-center gap-3">
                          <div className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-wide text-slate-700">Tải ảnh banner</p>
                            <p className="mt-1 text-xs font-medium text-slate-500">Khuyến nghị tỷ lệ 16:6 để hiển thị đẹp ở Hero</p>
                          </div>
                        </div>
                      );
                    },
                  }}
                />
              )}
              <input type="hidden" {...register('imageUrl')} />
              {errors.imageUrl ? <p className="ml-1 text-xs font-bold text-red-500">{errors.imageUrl.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Link đích</label>
              <input
                {...register('targetUrl')}
                placeholder="/story/ten-truyen hoặc https://..."
                className="w-full rounded-2xl bg-slate-50 px-5 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
              />
              {errors.targetUrl ? <p className="ml-1 text-xs font-bold text-red-500">{errors.targetUrl.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Liên kết Story (tuỳ chọn)</label>
              <select
                {...register('storyId')}
                className="w-full rounded-2xl bg-slate-50 px-5 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
              >
                <option value="">Không liên kết trực tiếp</option>
                {stories.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title}
                  </option>
                ))}
              </select>
              {isFetchingStories ? <p className="text-xs text-slate-500">Đang tải danh sách truyện...</p> : null}
              {currentStory ? <p className="text-xs font-medium text-slate-500">Slug liên kết: /story/{currentStory.slug}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Thứ tự hiển thị</label>
              <input
                type="number"
                min={0}
                {...register('order', { valueAsNumber: true })}
                className="w-full rounded-2xl bg-slate-50 px-5 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
              />
              {errors.order ? <p className="ml-1 text-xs font-bold text-red-500">{errors.order.message}</p> : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-slate-700">Active banner</p>
                  <p className="mt-1 text-xs text-slate-500">Bật để banner xuất hiện ở Hero Section ngoài trang chủ.</p>
                </div>
                <input type="checkbox" {...register('isActive')} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-5 rounded-2xl border border-pink-100 bg-pink-50/40 p-6">
              <h3 className="text-lg font-black text-pink-900">Tiếng Việt</h3>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">title_vi</label>
                <input
                  {...register('titleVi')}
                  placeholder="Tiêu đề hero tiếng Việt"
                  className="w-full rounded-xl border border-pink-100 bg-white px-4 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
                />
                {errors.titleVi ? <p className="ml-1 text-xs font-bold text-red-500">{errors.titleVi.message}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">subtitle_vi</label>
                <textarea
                  rows={4}
                  {...register('subtitleVi')}
                  placeholder="Mô tả ngắn tiếng Việt"
                  className="w-full resize-none rounded-xl border border-pink-100 bg-white px-4 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
                />
              </div>
            </div>

            <div className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6">
              <h3 className="text-lg font-black text-emerald-900">English</h3>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">title_en</label>
                <input
                  {...register('titleEn')}
                  placeholder="Hero title in English"
                  className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">subtitle_en</label>
                <textarea
                  rows={4}
                  {...register('subtitleEn')}
                  placeholder="Short subtitle in English"
                  className="w-full resize-none rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-100 bg-slate-50 p-8">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
          >
            <X className="h-4 w-4" />
            Hủy
          </button>
          <button
            type="submit"
            disabled={isLoading || isUploadingImage || isFetchingStories}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading || isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu banner
          </button>
        </div>
      </div>
    </form>
  );
}
