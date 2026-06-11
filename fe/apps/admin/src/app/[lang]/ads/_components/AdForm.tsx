"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Save, X } from 'lucide-react';

import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import { HybridImageUploader } from '@/components/upload/HybridImageUploader';

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const extractYoutubeIdFromValue = (input?: string | null): string | null => {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  const iframeSrcMatch = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const candidate = iframeSrcMatch?.[1] ?? raw;

  if (YOUTUBE_ID_REGEX.test(candidate)) return candidate;

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
    }

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery && YOUTUBE_ID_REGEX.test(fromQuery)) return fromQuery;

      const parts = url.pathname.split('/').filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live');
      const fromPath = embedIndex >= 0 ? parts[embedIndex + 1] : null;
      if (fromPath && YOUTUBE_ID_REGEX.test(fromPath)) return fromPath;
    }
  } catch {
    // fall through to regex parsing
  }

  const matched = candidate.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i);
  return matched?.[1] ?? null;
};

const adSchema = z.object({
  partnerName: z.string().trim().min(1, 'Vui lòng nhập tên đối tác'),
  title: z.string().trim().min(1, 'Vui lòng nhập tên sản phẩm / tiêu đề quảng cáo'),
  contentType: z.enum(['image', 'iframe', 'youtube']),
  imageUrl: z.string().trim().optional(),
  targetUrl: z.string().trim().optional(),
  iframeCode: z.string().trim().optional(),
  youtubeId: z.string().trim().max(20, 'YouTube ID tối đa 20 ký tự').optional(),
  youtubePlayTime: z.number().min(1, 'Thời gian xem tối thiểu 1 giây').max(3600, 'Thời gian xem tối đa 3600 giây').optional(),
  isForcedRedirect: z.boolean().optional(),
  languageId: z.string().min(1, 'Vui lòng chọn ngôn ngữ'),
  isActive: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.contentType === 'image') {
    if (!data.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imageUrl'],
        message: 'Vui lòng nhập link ảnh',
      });
    }
    if (!data.targetUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetUrl'],
        message: 'Vui lòng nhập link affiliate đích',
      });
    }
  }

  if (data.contentType === 'iframe' && !data.iframeCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['iframeCode'],
      message: 'Vui lòng nhập mã iframe',
    });
  }

  if (data.contentType === 'youtube') {
    const resolvedYoutubeId = extractYoutubeIdFromValue(data.youtubeId) || extractYoutubeIdFromValue(data.iframeCode);
    if (!resolvedYoutubeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['youtubeId'],
        message: 'Vui lòng nhập YouTube ID hoặc dán mã iframe YouTube',
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['iframeCode'],
        message: 'Vui lòng nhập YouTube ID hoặc dán mã iframe YouTube',
      });
    }
  }
});

export type AdFormValues = z.infer<typeof adSchema>;

type AdFormProps = {
  initialData?: Partial<AdFormValues>;
  isLoading?: boolean;
  showUnlockAdvanced?: boolean;
  onSubmit: (payload: AdFormValues) => Promise<void>;
  onCancel: () => void;
};

export default function AdForm({ initialData, isLoading, showUnlockAdvanced = false, onSubmit, onCancel }: AdFormProps) {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const lastAutoFilledRef = useRef<{ youtubeId: string; title: string; partnerName: string } | null>(null);
  const lastFetchedYoutubeIdRef = useRef<string>('');
  const { languages } = useAdminLanguages();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<AdFormValues>({
    resolver: zodResolver(adSchema),
    defaultValues: {
      partnerName: initialData?.partnerName || '',
      title: initialData?.title || '',
      contentType: initialData?.contentType || 'image',
      imageUrl: initialData?.imageUrl || '',
      targetUrl: initialData?.targetUrl || '',
      iframeCode: initialData?.iframeCode || '',
      youtubeId: initialData?.youtubeId || '',
      youtubePlayTime: typeof initialData?.youtubePlayTime === 'number' ? initialData.youtubePlayTime : 31,
      isForcedRedirect: initialData?.isForcedRedirect ?? false,
      languageId: initialData?.languageId || 'all',
      isActive: initialData?.isActive ?? true,
    },
  });

  const contentType = watch('contentType');
  const previewImage = watch('imageUrl');
  const youtubeIdValue = watch('youtubeId');
  const iframeCodeValue = watch('iframeCode');
  const titleValue = watch('title');
  const partnerNameValue = watch('partnerName');
  const derivedYoutubeId = useMemo(
    () => extractYoutubeIdFromValue(youtubeIdValue) || extractYoutubeIdFromValue(iframeCodeValue) || '',
    [youtubeIdValue, iframeCodeValue],
  );

  const youtubeIdDisabled = contentType === 'youtube' && Boolean((iframeCodeValue || '').trim());
  const iframeCodeDisabled = contentType === 'youtube' && Boolean((youtubeIdValue || '').trim());

  useEffect(() => {
    if (contentType !== 'youtube') return;
    const normalized = derivedYoutubeId.trim();
    if (!normalized) return;
    if (youtubeIdValue !== normalized) {
      setValue('youtubeId', normalized, { shouldValidate: true, shouldDirty: true });
    }
  }, [contentType, derivedYoutubeId, setValue, youtubeIdValue]);

  useEffect(() => {
    if (contentType !== 'youtube') return;
    if (!YOUTUBE_ID_REGEX.test(derivedYoutubeId)) return;
    if (lastFetchedYoutubeIdRef.current === derivedYoutubeId) return;

    let active = true;
    lastFetchedYoutubeIdRef.current = derivedYoutubeId;

    const run = async () => {
      try {
        const target = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${derivedYoutubeId}`)}&format=json`;
        const response = await fetch(target);
        if (!response.ok) return;
        if (!active) return;
        const payload = (await response.json()) as { title?: string; author_name?: string };
        const nextTitle = (payload.title || '').trim();
        const nextPartner = (payload.author_name || '').trim();
        const previousAuto = lastAutoFilledRef.current;

        if (nextTitle && (!titleValue.trim() || titleValue === previousAuto?.title)) {
          setValue('title', nextTitle, { shouldDirty: true, shouldValidate: true });
        }
        if (nextPartner && (!partnerNameValue.trim() || partnerNameValue === previousAuto?.partnerName)) {
          setValue('partnerName', nextPartner, { shouldDirty: true, shouldValidate: true });
        }

        lastAutoFilledRef.current = {
          youtubeId: derivedYoutubeId,
          title: nextTitle || previousAuto?.title || '',
          partnerName: nextPartner || previousAuto?.partnerName || '',
        };
      } catch {
        // ignore public oEmbed failures
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [contentType, derivedYoutubeId, partnerNameValue, setValue, titleValue]);

  const internalOnSubmit = async (data: AdFormValues) => {
    try {
      const normalizedYoutubeId =
        data.contentType === 'youtube'
          ? extractYoutubeIdFromValue(data.youtubeId) || extractYoutubeIdFromValue(data.iframeCode) || undefined
          : undefined;
      await onSubmit({
        ...data,
        youtubeId: normalizedYoutubeId,
      });
    } catch (err: any) {
      const res = err?.response?.data;
      const status = err?.response?.status;
      if (status === 400 || status === 422) {
        if (res?.errors && typeof res.errors === 'object') {
          for (const key in res.errors) {
            const message = Array.isArray(res.errors[key]) ? res.errors[key][0] : res.errors[key];
            setError(key as any, { type: 'server', message: String(message) });
          }
          return;
        }
        if (Array.isArray(res?.fieldErrors)) {
          res.fieldErrors.forEach((fe: any) => {
            setError(fe.field as any, { type: 'server', message: fe.message });
          });
          return;
        }
      }
      throw err;
    }
  };

  const handleFormError = (formErrors: FieldErrors<AdFormValues>) => {
    const firstKey = Object.keys(formErrors)[0] as keyof AdFormValues | undefined;
    if (firstKey) {
      const el = document.querySelector(`[name="${String(firstKey)}"]`) as HTMLElement | null;
      if (el && typeof el.focus === 'function') el.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit(internalOnSubmit, handleFormError)} className="mx-auto max-w-4xl space-y-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="space-y-6 p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tên đối tác</label>
              <input
                {...register('partnerName')}
                placeholder="Shopee, Lazada..."
                className={`admin-input w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium outline-none transition ${errors.partnerName ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
              />
              {errors.partnerName ? <p className="text-red-500 text-xs mt-1">{errors.partnerName.message}</p> : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Ngôn ngữ hiển thị</label>
              <select
                {...register('languageId')}
                className={`admin-input h-[50px] w-full rounded-2xl bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition ${errors.languageId ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
              >
                <option value="all">Global (mọi ngôn ngữ)</option>
                {languages.map((language) => (
                  <option key={language.id} value={String(language.id)}>
                    {language.name} ({language.key})
                  </option>
                ))}
              </select>
              {errors.languageId ? <p className="text-red-500 text-xs mt-1">{errors.languageId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Trạng thái</label>
              <label className="flex h-[50px] cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4">
                <span className="text-sm font-semibold text-slate-700">Active / Inactive</span>
                <input type="checkbox" {...register('isActive')} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tên sản phẩm / Tiêu đề quảng cáo</label>
            <input
              {...register('title')}
              placeholder="Tai nghe Bluetooth chống ồn..."
              className={`admin-input w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium outline-none transition ${errors.title ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
            />
            {errors.title ? <p className="text-red-500 text-xs mt-1">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Loại nội dung quảng cáo</label>
            <select
              {...register('contentType')}
              className="admin-input h-[50px] w-full rounded-2xl bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition ring-indigo-500/20 focus:ring-2"
            >
              <option value="image">Ảnh + Link</option>
              <option value="iframe">Iframe (Google Ads...)</option>
              <option value="youtube">YouTube Video</option>
            </select>
          </div>

          {contentType === 'image' ? (
          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Link ảnh sản phẩm</label>
            <HybridImageUploader
              value={previewImage}
              disabled={isLoading || isUploadingImage}
              onChange={(url) => setValue('imageUrl', url)}
              onUploadingChange={setIsUploadingImage}
              previewAspectRatio="aspect-[4/3]"
            />
            {errors.imageUrl ? <p className="text-red-500 text-xs mt-1">{errors.imageUrl.message}</p> : null}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Mã iframe</label>
              <textarea
                {...register('iframeCode')}
                rows={6}
                placeholder={contentType === 'youtube' ? '<iframe src="https://www.youtube.com/embed/..."></iframe>' : '<iframe ...></iframe>'}
                disabled={iframeCodeDisabled}
                className={`admin-input w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium outline-none transition ${errors.iframeCode ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
              />
              {contentType === 'youtube' ? <p className="text-xs text-slate-500">Khi nhập iframe YouTube, hệ thống sẽ tự bóc tách và lưu `youtubeId`.</p> : null}
              {errors.iframeCode ? <p className="text-red-500 text-xs mt-1">{errors.iframeCode.message}</p> : null}
            </div>
          )}

          {contentType !== 'iframe' ? (
          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Link Affiliate đích</label>
            <input
              {...register('targetUrl')}
              placeholder="https://..."
              className={`admin-input w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium outline-none transition ${errors.targetUrl ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
            />
            {errors.targetUrl ? <p className="text-red-500 text-xs mt-1">{errors.targetUrl.message}</p> : null}
          </div>
          ) : null}

          {contentType === 'youtube' ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">YouTube ID</label>
                <input
                  {...register('youtubeId')}
                  placeholder="dQw4w9WgXcQ"
                  disabled={youtubeIdDisabled}
                  className={`admin-input w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium outline-none transition ${errors.youtubeId ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
                />
                {errors.youtubeId ? <p className="text-red-500 text-xs mt-1">{errors.youtubeId.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">Thời gian xem video YouTube (giây)</label>
                <input
                  type="number"
                  min={1}
                  max={3600}
                  {...register('youtubePlayTime', { valueAsNumber: true })}
                  className={`admin-input w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium outline-none transition ${errors.youtubePlayTime ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
                />
                {errors.youtubePlayTime ? <p className="text-red-500 text-xs mt-1">{errors.youtubePlayTime.message}</p> : null}
              </div>

              {showUnlockAdvanced ? (
                <div className="space-y-2 md:col-span-2">
                  <label className="flex h-[50px] cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4">
                    <span className="text-sm font-semibold text-slate-700">Vô hiệu nút đóng quảng cáo &amp; Tự động chuyển hướng</span>
                    <input type="checkbox" {...register('isForcedRedirect')} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {showUnlockAdvanced && contentType !== 'youtube' ? (
            <div className="space-y-2">
              <label className="flex h-[50px] cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4">
                <span className="text-sm font-semibold text-slate-700">Vô hiệu nút đóng quảng cáo &amp; Tự động chuyển hướng</span>
                <input type="checkbox" {...register('isForcedRedirect')} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              </label>
            </div>
          ) : null}
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
            disabled={isLoading || isUploadingImage}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu quảng cáo
          </button>
        </div>
      </div>
    </form>
  );
}
