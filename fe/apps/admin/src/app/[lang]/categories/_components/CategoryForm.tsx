"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Loader2,
    Save,
    X,
    ChevronDown,
} from 'lucide-react';

import { useAdminLanguages } from '@/hooks/useAdminLanguages';

const categorySchema = z.object({
    name: z.string().min(3, 'Tên danh mục bắt buộc và phải dài hơn 3 ký tự'),
    slug: z.string().min(3, 'Slug bắt buộc và phải dài hơn 3 ký tự'),
    description: z.string().max(1000, 'Mô tả quá dài').optional(),
    iconUrl: z
        .string()
        .optional()
        .refine((v) => !v || /^https?:\/\//.test(v), { message: 'Icon URL không hợp lệ' }),
    language: z.string().min(1, 'Vui lòng chọn ngôn ngữ'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
    initialData?: Partial<CategoryFormValues>;
    defaultLanguage?: string;
    onSubmit: (data: CategoryFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const CategoryForm = ({ initialData, defaultLanguage = 'vi', onSubmit, onCancel, isLoading }: CategoryFormProps) => {
    const { languages } = useAdminLanguages();
    const {
        register,
        handleSubmit,
        setValue,
        setError,
        watch,
        formState: { errors },
    } = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: '',
            slug: '',
            description: '',
            iconUrl: '',
            language: initialData?.language || defaultLanguage,
            ...initialData,
        },
    });

    const name = watch('name');

    // Auto-generate slug
    React.useEffect(() => {
        if (!initialData?.slug && name) {
            const generatedSlug = name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[đĐ]/g, 'd')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
            setValue('slug', generatedSlug);
        }
    }, [name, setValue, initialData]);

    const internalOnSubmit = async (data: CategoryFormValues) => {
        try {
            await onSubmit(data);
        } catch (err: any) {
            const res = err?.response?.data;
            const status = err?.response?.status;
            // Map common backend validation shapes to field errors
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
            // Unknown or critical error: rethrow so parent can handle (toast for 500s, etc.)
            throw err;
        }
    };

    return (
        <form onSubmit={handleSubmit(internalOnSubmit)} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tên danh mục</label>
                <input
                    {...register('name')}
                    placeholder="Nhập tên danh mục..."
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.name ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Slug (URL)</label>
                <input
                    {...register('slug')}
                    placeholder="ten-danh-muc-slug..."
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.slug ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
            </div>


            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ngôn ngữ</label>
                <select
                    {...register('language')}
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.language ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                >
                    {languages.map((language) => (
                        <option key={language.id} value={language.key}>
                            {language.name} ({language.key})
                        </option>
                    ))}
                </select>
                {errors.language && <p className="text-red-500 text-xs mt-1">{errors.language.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Mô tả</label>
                <textarea
                    {...register('description')}
                    rows={3}
                    placeholder="Nhập mô tả danh mục..."
                    className={`admin-input w-full bg-white rounded-[24px] py-4 px-6 text-sm font-medium transition-all resize-none ${errors.description ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Icon URL (tùy chọn)</label>
                <input
                    {...register('iconUrl')}
                    placeholder="https://example.com/icon.png"
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.iconUrl ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.iconUrl && <p className="text-red-500 text-xs mt-1">{errors.iconUrl.message}</p>}
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest flex items-center gap-2"
                >
                    <X className="w-4 h-4" />
                    Hủy
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 flex items-center gap-3 disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Lưu danh mục
                </button>
            </div>
        </form>
    );
};
