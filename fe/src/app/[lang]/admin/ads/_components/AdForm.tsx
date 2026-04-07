"use client";

import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Save, X } from 'lucide-react';
import { useState } from 'react';

import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import { HybridImageUploader } from '@/components/upload/HybridImageUploader';

const adSchema = z.object({
  partnerName: z.string().trim().min(1, 'Vui lòng nhập tên đối tác'),
  title: z.string().trim().min(1, 'Vui lòng nhập tên sản phẩm / tiêu đề quảng cáo'),
  imageUrl: z.string().trim().min(1, 'Vui lòng nhập link ảnh'),
  targetUrl: z.string().trim().min(1, 'Vui lòng nhập link affiliate đích'),
  languageId: z.string().min(1, 'Vui lòng chọn ngôn ngữ'),
  isActive: z.boolean().optional(),
});

export type AdFormValues = z.infer<typeof adSchema>;

type AdFormProps = {
  initialData?: Partial<AdFormValues>;
  isLoading?: boolean;
  onSubmit: (payload: AdFormValues) => Promise<void>;
  onCancel: () => void;
};

export default function AdForm({ initialData, isLoading, onSubmit, onCancel }: AdFormProps) {
    const [isUploadingImage, setIsUploadingImage] = useState(false);
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
      imageUrl: initialData?.imageUrl || '',
      targetUrl: initialData?.targetUrl || '',
      languageId: initialData?.languageId || 'all',
      isActive: initialData?.isActive ?? true,
    },
  });

  const previewImage = watch('imageUrl');

  const internalOnSubmit = async (data: AdFormValues) => {
    try {
      await onSubmit(data);
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

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Link Affiliate đích</label>
            <input
              {...register('targetUrl')}
              placeholder="https://..."
              className={`admin-input w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium outline-none transition ${errors.targetUrl ? 'admin-input-error' : 'ring-indigo-500/20 focus:ring-2'}`}
            />
            {errors.targetUrl ? <p className="text-red-500 text-xs mt-1">{errors.targetUrl.message}</p> : null}
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
