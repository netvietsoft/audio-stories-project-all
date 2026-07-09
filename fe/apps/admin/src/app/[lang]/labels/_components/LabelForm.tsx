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

const labelSchema = z.object({
    name: z.string().min(1, 'Bắt buộc'),
    text: z.string().min(1, 'Bắt buộc'),
    color: z.string().min(1, 'Bắt buộc'),
    textColor: z.string().optional(),
    icon: z.string().optional(),
    defaultDurationDays: z.coerce.number().int().min(0).optional(),
});

type LabelFormValues = z.infer<typeof labelSchema>;

interface LabelFormProps {
    initialData?: Partial<LabelFormValues>;
    onSubmit: (data: LabelFormValues) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const LabelForm = ({ initialData, onSubmit, onCancel, isLoading }: LabelFormProps) => {
    const {
        register,
        handleSubmit,
        setValue,
        setError,
        watch,
        formState: { errors },
    } = useForm<LabelFormValues>({
        resolver: zodResolver(labelSchema) as any,
        defaultValues: {
            name: '',
            text: '',
            color: '#6366f1',
            textColor: '',
            icon: '',
            defaultDurationDays: undefined,
            ...initialData,
        },
    });

    const previewText = watch('text');
    const previewColor = watch('color');
    const previewTextColor = watch('textColor');

    const internalOnSubmit = async (data: LabelFormValues) => {
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
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Xem trước</label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-6 py-4">
                    <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
                        style={{
                            backgroundColor: previewColor || '#6366f1',
                            color: previewTextColor || '#ffffff',
                        }}
                    >
                        {previewText || 'Preview'}
                    </span>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tên label</label>
                <input
                    {...register('name')}
                    placeholder="Nhập tên label..."
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.name ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Chữ hiển thị (badge)</label>
                <input
                    {...register('text')}
                    placeholder="VD: HOT, MỚI, VIP..."
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.text ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.text && <p className="text-red-500 text-xs mt-1">{errors.text.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Màu nền</label>
                <div className="flex items-center gap-3">
                    <input
                        type="color"
                        value={watch('color') || '#6366f1'}
                        onChange={(e) => setValue('color', e.target.value)}
                        className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                    />
                    <input
                        {...register('color')}
                        placeholder="#6366f1"
                        className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.color ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                    />
                </div>
                {errors.color && <p className="text-red-500 text-xs mt-1">{errors.color.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Màu chữ (tùy chọn)</label>
                <input
                    {...register('textColor')}
                    placeholder="#ffffff"
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.textColor ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.textColor && <p className="text-red-500 text-xs mt-1">{errors.textColor.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Icon (tùy chọn)</label>
                <input
                    {...register('icon')}
                    placeholder="Tên icon..."
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.icon ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                {errors.icon && <p className="text-red-500 text-xs mt-1">{errors.icon.message}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Số ngày hiệu lực mặc định</label>
                <input
                    type="number"
                    min={0}
                    {...register('defaultDurationDays')}
                    placeholder="0"
                    className={`admin-input w-full bg-white rounded-2xl py-4 px-6 text-sm font-medium transition-all ${errors.defaultDurationDays ? 'admin-input-error' : 'focus:ring-2 focus:ring-indigo-500/20'}`}
                />
                <p className="text-xs text-slate-400 font-medium">0 hoặc trống = không hết hạn</p>
                {errors.defaultDurationDays && <p className="text-red-500 text-xs mt-1">{errors.defaultDurationDays.message}</p>}
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
                    Lưu label
                </button>
            </div>
        </form>
    );
};
