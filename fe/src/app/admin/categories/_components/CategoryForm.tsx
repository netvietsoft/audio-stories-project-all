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

const categorySchema = z.object({
    name: z.string().min(1, 'Tên danh mục không được để trống'),
    nameVi: z.string().optional(),
    nameEn: z.string().optional(),
    slug: z.string().min(1, 'Slug không được để trống'),
    description: z.string().optional(),
    iconUrl: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
    initialData?: Partial<CategoryFormValues>;
    onSubmit: (data: CategoryFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const CategoryForm = ({ initialData, onSubmit, onCancel, isLoading }: CategoryFormProps) => {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: '',
            nameVi: '',
            nameEn: '',
            slug: '',
            description: '',
            iconUrl: '',
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

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tên danh mục</label>
                <input
                    {...register('name')}
                    placeholder="Nhập tên danh mục..."
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                {errors.name && <p className="text-xs font-bold text-red-500 ml-2">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Slug (URL)</label>
                <input
                    {...register('slug')}
                    placeholder="ten-danh-muc-slug..."
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                {errors.slug && <p className="text-xs font-bold text-red-500 ml-2">{errors.slug.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tên tiếng Việt (nameVi)</label>
                    <input
                        {...register('nameVi')}
                        placeholder="Nhập tên tiếng Việt..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tên tiếng Anh (nameEn)</label>
                    <input
                        {...register('nameEn')}
                        placeholder="Input English name..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Mô tả</label>
                <textarea
                    {...register('description')}
                    rows={3}
                    placeholder="Nhập mô tả danh mục..."
                    className="w-full bg-slate-50 border-none rounded-[24px] py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Icon URL (tùy chọn)</label>
                <input
                    {...register('iconUrl')}
                    placeholder="https://example.com/icon.png"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
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
