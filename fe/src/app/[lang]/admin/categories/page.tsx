"use client";

import React, { useState, useEffect } from 'react';
import {
    LayoutGrid,
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    X,
    BookOpen,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { CategoryForm } from './_components/CategoryForm';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';

interface Category {
    id: number;
    name: string;
    nameVi: string | null;
    nameEn: string | null;
    slug: string;
    description: string | null;
    iconUrl: string | null;
    _count?: {
        stories: number;
    };
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedLocale, setSelectedLocale] = useState('vi');
    const { languages } = useAdminLanguages();
    
    // Pagination & Bulk Selection
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const limit = 12;

    const getLocalizedName = (cat: Category) => {
        if (selectedLocale === 'en') return cat.nameEn || cat.name;
        return cat.nameVi || cat.name;
    };

    useEffect(() => {
        if (!languages.some((language) => language.key === selectedLocale)) {
            setSelectedLocale(languages[0]?.key || 'vi');
        }
    }, [languages, selectedLocale]);

    useEffect(() => {
        fetchCategories();
    }, [page, searchTerm]);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(searchTerm ? { search: searchTerm } : {}),
            });
            const res = await apiClient.get(`/categories?${params.toString()}`);
            setCategories(res.data.data);
            setTotal(res.data.meta.total);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingCategory(null);
        setIsModalOpen(true);
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;

        try {
            await apiClient.delete(`/categories/${id}`);
            fetchCategories(); // Refetch to maintain page count
        } catch (error) {
            console.error('Failed to delete category:', error);
            alert('Không thể xóa danh mục này. Có thể nó đang chứa truyện.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.size} danh mục đã chọn?`)) return;

        setIsDeletingBulk(true);
        try {
            await apiClient.delete('/categories/bulk/delete', {
                data: { ids: Array.from(selectedIds) }
            });
            setCategories(prev => prev.filter(c => !selectedIds.has(c.id)));
            setTotal(prev => prev - selectedIds.size);
            setSelectedIds(new Set());
            // If the current page is now empty, go back a page
            if (categories.length === selectedIds.size && page > 1) {
                setPage(page - 1);
            } else {
                fetchCategories();
            }
        } catch (error) {
            console.error('Failed to delete bulk:', error);
            alert('Đã xảy ra lỗi khi xóa hàng loạt.');
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === categories.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(categories.map(c => c.id)));
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

    const handleSubmit = async (data: any) => {
        setIsSubmitting(true);
        try {
            if (editingCategory) {
                await apiClient.patch(`/categories/${editingCategory.id}`, data);
                fetchCategories(); // Refetch to get updated list
            } else {
                await apiClient.post('/categories', data);
                setPage(1); // Go to first page to see new category
                fetchCategories();
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save category:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Removed client-side filteredCategories as searching is now backend-driven
    // const filteredCategories = categories.filter(c => ...)

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <LayoutGrid className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Danh mục
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Tổ chức và phân loại các tác phẩm trên hệ thống.</p>
                </div>
                <div className="flex items-center gap-3">
                    <AdminLanguageDropdown
                        languages={languages}
                        value={selectedLocale}
                        onChange={setSelectedLocale}
                    />
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm danh mục
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm danh mục..."
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

            {/* Categories Grid/Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 w-10">
                                    <button 
                                        onClick={toggleSelectAll}
                                        className={`w-5 h-5 rounded border transition-all flex items-center justify-center
                                            ${selectedIds.size === categories.length && categories.length > 0
                                                ? 'bg-indigo-600 border-indigo-600' 
                                                : 'bg-white border-slate-300 hover:border-indigo-400'}
                                        `}
                                    >
                                        {selectedIds.size === categories.length && categories.length > 0 && (
                                            <Check className="w-3 h-3 text-white" strokeWidth={4} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Danh mục</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Slug</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Số truyện</th>
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
                            ) : categories.length > 0 ? (
                                categories.map((cat) => (
                                    <tr key={cat.id} className={`group hover:bg-slate-50/50 transition-all duration-300 ${selectedIds.has(cat.id) ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-8 py-5">
                                            <button 
                                                onClick={() => toggleSelect(cat.id)}
                                                className={`w-5 h-5 rounded border transition-all flex items-center justify-center
                                                    ${selectedIds.has(cat.id)
                                                        ? 'bg-indigo-600 border-indigo-600' 
                                                        : 'bg-white border-slate-300 hover:border-indigo-400'}
                                                `}
                                            >
                                                {selectedIds.has(cat.id) && (
                                                    <Check className="w-3 h-3 text-white" strokeWidth={4} />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                                    {cat.iconUrl ? (
                                                        <img src={cat.iconUrl} alt="" className="w-6 h-6 object-contain" />
                                                    ) : (
                                                        <LayoutGrid className="w-5 h-5 opacity-40" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{getLocalizedName(cat)}</p>
                                                    <p className="text-xs text-slate-400 font-medium">{cat.name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <code className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                {cat.slug}
                                            </code>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="inline-flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                                                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-xs font-black text-indigo-700">{cat._count?.stories || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(cat)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cat.id)}
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
                                            <LayoutGrid className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Không tìm thấy danh mục</h3>
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
                    ) : categories.length > 0 ? (
                        categories.map((cat) => (
                            <div key={cat.id} className={`p-4 ${selectedIds.has(cat.id) ? 'bg-indigo-50/30' : ''}`}>
                                <div className="flex items-start gap-3">
                                    <button
                                        onClick={() => toggleSelect(cat.id)}
                                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all
                                            ${selectedIds.has(cat.id)
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'bg-white border-slate-300 hover:border-indigo-400'}
                                        `}
                                    >
                                        {selectedIds.has(cat.id) && (
                                            <Check className="w-3 h-3 text-white" strokeWidth={4} />
                                        )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-black leading-5 text-slate-900 break-words">{getLocalizedName(cat)}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-400 break-all">{cat.slug}</p>
                                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1">
                                                    <BookOpen className="w-3 h-3 text-indigo-500" />
                                                    <span className="text-[11px] font-black text-indigo-700">{cat._count?.stories || 0} truyện</span>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(cat)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cat.id)}
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
                                <LayoutGrid className="w-6 h-6 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Không tìm thấy danh mục</h3>
                            <p className="text-slate-500 mt-1">Vui lòng thử điều chỉnh lại bộ lọc tìm kiến.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-bold text-slate-500">
                        Hiển thị <span className="text-slate-900">{categories.length}</span> / <span className="text-slate-900">{total}</span> danh mục
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
                                {editingCategory ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục Mới'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8">
                            <CategoryForm
                                initialData={editingCategory ? {
                                    name: editingCategory.name,
                                    nameVi: editingCategory.nameVi ?? undefined,
                                    nameEn: editingCategory.nameEn ?? undefined,
                                    slug: editingCategory.slug,
                                    description: editingCategory.description ?? undefined,
                                    iconUrl: editingCategory.iconUrl ?? undefined,
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


