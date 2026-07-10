"use client";

import React, { useState, useEffect } from 'react';
import {
    Tag,
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    X,
    Check,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import { LabelForm } from './_components/LabelForm';

interface Label {
    id: number;
    name: string;
    text: string;
    color: string;
    textColor?: string | null;
    icon?: string | null;
    defaultDurationDays?: number | null;
    createdAt?: string;
}

type LabelFormInput = {
    name: string;
    text: string;
    color: string;
    textColor?: string;
    icon?: string;
    defaultDurationDays?: number;
};

export default function LabelsPage() {
    const [labels, setLabels] = useState<Label[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLabel, setEditingLabel] = useState<Label | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pagination & Bulk Selection
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const limit = 12;

    useEffect(() => {
        fetchLabels();
    }, [page, searchTerm]);

    const fetchLabels = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(searchTerm ? { search: searchTerm } : {}),
            });
            const res = await apiClient.get(`/labels?${params.toString()}`);
            setLabels(unwrapList<Label>(res.data));
            setTotal((res.data?.data?.meta ?? res.data?.meta)?.total ?? 0);
        } catch (error) {
            console.error('Failed to fetch labels:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingLabel(null);
        setIsModalOpen(true);
    };

    const handleEdit = (label: Label) => {
        setEditingLabel(label);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa label này?')) return;

        try {
            await apiClient.delete(`/labels/${id}`);
            fetchLabels(); // Refetch to maintain page count
        } catch (error) {
            console.error('Failed to delete label:', error);
            alert('Không thể xóa label này. Có thể nó đang được gán cho truyện.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.size} label đã chọn?`)) return;

        setIsDeletingBulk(true);
        try {
            await apiClient.delete('/labels/bulk/delete', {
                data: { ids: Array.from(selectedIds) }
            });
            setLabels(prev => prev.filter(l => !selectedIds.has(l.id)));
            setTotal(prev => prev - selectedIds.size);
            setSelectedIds(new Set());
            // If the current page is now empty, go back a page
            if (labels.length === selectedIds.size && page > 1) {
                setPage(page - 1);
            } else {
                fetchLabels();
            }
        } catch (error) {
            console.error('Failed to delete bulk:', error);
            alert('Đã xảy ra lỗi khi xóa hàng loạt.');
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === labels.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(labels.map(l => l.id)));
        }
    };

    const toggleSelect = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleSubmit = async (data: LabelFormInput) => {
        setIsSubmitting(true);
        try {
            const cleanText = (value?: string) => {
                const trimmed = value?.trim();
                return trimmed ? trimmed : undefined;
            };

            const name = cleanText(data.name);
            const text = cleanText(data.text);
            const color = cleanText(data.color);

            if (!name) {
                alert('Vui lòng nhập tên label.');
                return;
            }
            if (!text) {
                alert('Vui lòng nhập chữ hiển thị trên badge.');
                return;
            }
            if (!color) {
                alert('Vui lòng chọn màu.');
                return;
            }

            const basePayload = {
                name,
                text,
                color,
                textColor: cleanText(data.textColor),
                icon: cleanText(data.icon),
                defaultDurationDays: data.defaultDurationDays,
            };

            if (editingLabel) {
                await apiClient.patch(`/labels/${editingLabel.id}`, basePayload);
                fetchLabels(); // Refetch to get updated list
            } else {
                await apiClient.post('/labels', basePayload);
                setPage(1); // Go to first page to see new label
                fetchLabels();
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save label:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDuration = (days?: number | null) => (days && days > 0 ? `${days} ngày` : '∞');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Tag className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Label
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Quản lý các nhãn (badge) gán cho truyện trên hệ thống.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm label
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm label..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                {selectedIds.size > 0 && (
                    <button
                        onClick={handleBulkDelete}
                        disabled={isDeletingBulk}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all active:scale-95 border border-red-100"
                    >
                        {isDeletingBulk ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        Xóa {selectedIds.size} mục đã chọn
                    </button>
                )}
            </div>

            {/* Labels Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 w-10">
                                    <button
                                        onClick={toggleSelectAll}
                                        className={`w-5 h-5 rounded border transition-all flex items-center justify-center
                                            ${selectedIds.size === labels.length && labels.length > 0
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'bg-white border-slate-300 hover:border-indigo-400'}
                                        `}
                                    >
                                        {selectedIds.size === labels.length && labels.length > 0 && (
                                            <Check className="w-3 h-3 text-white" strokeWidth={4} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Badge</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tên label</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Hiệu lực</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-8 py-6">
                                            <div className="h-10 bg-slate-50 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : labels.length > 0 ? (
                                labels.map((label) => (
                                    <tr key={label.id} onClick={() => handleEdit(label)} className={`group cursor-pointer hover:bg-slate-50/50 transition-all duration-300 ${selectedIds.has(label.id) ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-8 py-5" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => toggleSelect(label.id)}
                                                className={`w-5 h-5 rounded border transition-all flex items-center justify-center
                                                    ${selectedIds.has(label.id)
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : 'bg-white border-slate-300 hover:border-indigo-400'}
                                                `}
                                            >
                                                {selectedIds.has(label.id) && (
                                                    <Check className="w-3 h-3 text-white" strokeWidth={4} />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span
                                                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
                                                style={{
                                                    backgroundColor: label.color,
                                                    color: label.textColor || '#ffffff',
                                                }}
                                            >
                                                {label.text}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900">{label.name}</p>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className="text-xs font-black text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                {formatDuration(label.defaultDurationDays)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(label)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(label.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <Tag className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Không tìm thấy label</h3>
                                        <p className="text-slate-500 mt-1">Vui lòng thử điều chỉnh lại bộ lọc tìm kiến.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                    {isLoading ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse p-4">
                                <div className="h-20 rounded-2xl bg-slate-50" />
                            </div>
                        ))
                    ) : labels.length > 0 ? (
                        labels.map((label) => (
                            <div key={label.id} className={`p-4 ${selectedIds.has(label.id) ? 'bg-indigo-50/30' : ''}`}>
                                <div className="flex items-start gap-3">
                                    <button
                                        onClick={() => toggleSelect(label.id)}
                                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all
                                            ${selectedIds.has(label.id)
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'bg-white border-slate-300 hover:border-indigo-400'}
                                        `}
                                    >
                                        {selectedIds.has(label.id) && (
                                            <Check className="w-3 h-3 text-white" strokeWidth={4} />
                                        )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-black leading-5 text-slate-900 break-words">{label.name}</p>
                                                <span
                                                    className="mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                                                    style={{
                                                        backgroundColor: label.color,
                                                        color: label.textColor || '#ffffff',
                                                    }}
                                                >
                                                    {label.text}
                                                </span>
                                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1">
                                                    <span className="text-[11px] font-black text-slate-500">{formatDuration(label.defaultDurationDays)}</span>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(label)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(label.id)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Tag className="w-6 h-6 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Không tìm thấy label</h3>
                            <p className="text-slate-500 mt-1">Vui lòng thử điều chỉnh lại bộ lọc tìm kiến.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-bold text-slate-500">
                        Hiển thị <span className="text-slate-900">{labels.length}</span> / <span className="text-slate-900">{total}</span> label
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                        >
                            Trước
                        </button>
                        {[...Array(Math.ceil(total / limit))].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i + 1)}
                                className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95
                                    ${page === i + 1 ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}
                                `}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            disabled={page >= Math.ceil(total / limit)}
                            onClick={() => setPage(page + 1)}
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                        >
                            Tiếp
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal for Create/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingLabel ? 'Chỉnh sửa Label' : 'Thêm Label Mới'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8">
                            <LabelForm
                                initialData={editingLabel ? {
                                    name: editingLabel.name,
                                    text: editingLabel.text,
                                    color: editingLabel.color,
                                    textColor: editingLabel.textColor ?? undefined,
                                    icon: editingLabel.icon ?? undefined,
                                    defaultDurationDays: editingLabel.defaultDurationDays ?? undefined,
                                } : {}}
                                onSubmit={handleSubmit}
                                onCancel={() => setIsModalOpen(false)}
                                isLoading={isSubmitting}
                            />
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
