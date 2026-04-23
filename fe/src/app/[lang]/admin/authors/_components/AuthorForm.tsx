"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Loader2,
    Save,
    X,
} from 'lucide-react';

import { useAdminLanguages } from '@/hooks/useAdminLanguages';

const authorSchema = z.object({
    name: z.string().min(3, 'Tên tác giả bắt buộc và phải dài hơn 3 ký tự'),
    slug: z.string().min(3, 'Slug bắt buộc và phải dài hơn 3 ký tự'),
    bio: z.string().max(2000, 'Tiểu sử quá dài').optional(),
    avatarUrl: z
        .string()
        .optional()
        .refine((v) => !v || /^https?:\/\//.test(v), { message: 'Avatar URL không hợp lệ' }),
    language: z.string().min(1, 'Vui lòng chọn ngôn ngữ'),
});

type AuthorFormValues = z.infer<typeof authorSchema>;

interface AuthorFormProps {
    initialData?: Partial<AuthorFormValues>;
    defaultLanguage?: string;
    onSubmit: (data: AuthorFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const AuthorForm = ({ initialData, defaultLanguage = 'vi', onSubmit, onCancel, isLoading }: AuthorFormProps) => {
    const { languages } = useAdminLanguages();
    const {
        register,
        handleSubmit,
        setValue,
        setError,
        watch,
        formState: { errors },
    } = useForm<AuthorFormValues>({
        resolver: zodResolver(authorSchema),
        defaultValues: {
            name: '',
            slug: '',
            bio: '',
            avatarUrl: '',
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

    const internalOnSubmit = async (data: AuthorFormValues) => {
        // Clean up empty optional fields
        const cleanedData = {
            ...data,
            bio: data.bio || undefined,
            avatarUrl: data.avatarUrl || undefined,
        };
        try {
            await onSubmit(cleanedData);
        } catch (err: any) {
            console.error('Author form submission error:', err);
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
                if (res?.message) {
                    alert(res.message);
                    return;
                }
            }
            throw err;
        }
    };

    return (
        <form onSubmit={handleSubmit(internalOnSubmit)} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tên tác giả</label>
                <input
                    {...register('name')}
                    placeholder="Nhập tên tác giả..."
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.name ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Slug (URL)</label>
                <input
                    {...register('slug')}
                    placeholder="ten-tac-gia-slug..."
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
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tiểu sử</label>
                <textarea
                    {...register('bio')}
                    rows={4}
                    placeholder="Nhập tiểu sử tác giả..."
                    className={`admin-input w-full bg-white rounded-[24px] py-4 px-6 text-sm font-medium transition-all resize-none ${errors.bio ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.bio && <p className="text-red-500 text-xs mt-1">{errors.bio.message as string}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Avatar URL (tùy chọn)</label>
                <input
                    {...register('avatarUrl')}
                    placeholder="https://example.com/avatar.png"
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.avatarUrl ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.avatarUrl && <p className="text-red-500 text-xs mt-1">{errors.avatarUrl.message as string}</p>}
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
                    Lưu tác giả
                </button>
            </div>
        </form>
    );
};
