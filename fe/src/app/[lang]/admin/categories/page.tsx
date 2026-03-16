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
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { CategoryForm } from './_components/CategoryForm';

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
    const [selectedLocale, setSelectedLocale] = useState<'vi' | 'en'>('vi');

    const getLocalizedName = (cat: Category) => {
        if (selectedLocale === 'vi') return cat.nameVi || cat.name;
        return cat.nameEn || cat.name;
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/categories');
            setCategories(res.data);
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
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            console.error('Failed to delete category:', error);
            alert('Không thể xóa danh mục này. Có thể nó đang chứa truyện.');
        }
    };

    const handleSubmit = async (data: any) => {
        setIsSubmitting(true);
        try {
            if (editingCategory) {
                const res = await apiClient.patch(`/categories/${editingCategory.id}`, data);
                setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, ...res.data } : c));
            } else {
                const res = await apiClient.post('/categories', data);
                setCategories([...categories, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save category:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    {/* Locale Selector */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                        <button
                            onClick={() => setSelectedLocale('vi')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                selectedLocale === 'vi'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            VI
                        </button>
                        <button
                            onClick={() => setSelectedLocale('en')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                selectedLocale === 'en'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            EN
                        </button>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm danh mục
                    </button>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm danh mục..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Categories Grid/Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
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
                                        <td colSpan={4} className="px-8 py-6">
                                            <div className="h-10 bg-slate-50 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredCategories.length > 0 ? (
                                filteredCategories.map((cat) => (
                                    <tr key={cat.id} className="group hover:bg-slate-50/50 transition-all duration-300">
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
                                    <td colSpan={4} className="px-8 py-20 text-center">
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
