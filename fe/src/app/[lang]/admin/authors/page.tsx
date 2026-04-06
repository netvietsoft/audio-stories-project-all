"use client";

import React, { useState, useEffect } from 'react';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    X,
    BookOpen,
    UserCircle,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { AuthorForm } from './_components/AuthorForm';
import { useParams } from 'next/navigation';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';

interface Author {
    id: string;
    name: string;
    slug: string;
    language?: string | null;
    bio: string | null;
    avatarUrl: string | null;
    _count?: {
        stories: number;
    };
}

export default function AuthorsPage() {
    const [authors, setAuthors] = useState<Author[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const params = useParams<{ lang?: string }>();
    const urlLang = params?.lang === 'en' ? 'en' : 'vi';
    const [selectedLocale, setSelectedLocale] = useState(urlLang);
    const { languages } = useAdminLanguages();

    useEffect(() => {
        fetchAuthors();
    }, []);

    const fetchAuthors = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/authors');
            setAuthors(res.data);
        } catch (error) {
            console.error('Failed to fetch authors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingAuthor(null);
        setIsModalOpen(true);
    };

    const handleEdit = (author: Author) => {
        setEditingAuthor(author);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa tác giả này?')) return;

        try {
            await apiClient.delete(`/authors/${id}`);
            setAuthors(authors.filter(a => a.id !== id));
        } catch (error) {
            console.error('Failed to delete author:', error);
            alert('Không thể xóa tác giả này. Có thể họ đang có truyện trên hệ thống.');
        }
    };

    const handleSubmit = async (data: any) => {
        setIsSubmitting(true);
        try {
            if (editingAuthor) {
                const res = await apiClient.patch(`/authors/${editingAuthor.id}`, data);
                setAuthors(authors.map(a => a.id === editingAuthor.id ? { ...a, ...res.data } : a));
            } else {
                const res = await apiClient.post('/authors', data);
                setAuthors([...authors, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save author:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredAuthors = authors.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Tác giả
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Quản lý thông tin và hồ sơ của các tác giả.</p>
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
                        Thêm tác giả
                    </button>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm tác giả..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Authors Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tác giả</th>
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
                            ) : filteredAuthors.length > 0 ? (
                                filteredAuthors.map((author) => (
                                    <tr key={author.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 overflow-hidden ring-4 ring-white group-hover:ring-slate-50 transition-all">
                                                    {author.avatarUrl ? (
                                                        <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <UserCircle className="w-6 h-6 opacity-40" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{author.name}</p>
                                                    {author.bio && (
                                                        <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{author.bio}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <code className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                {author.slug}
                                            </code>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="inline-flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                                                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-xs font-black text-indigo-700">{author._count?.stories || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(author)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(author.id)}
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
                                            <Users className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Không tìm thấy tác giả</h3>
                                        <p className="text-slate-500 mt-1">Cần thêm tác giả mới hoặc thay đổi bộ lọc.</p>
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
                    ) : filteredAuthors.length > 0 ? (
                        filteredAuthors.map((author) => (
                            <div key={author.id} className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-slate-400">
                                        {author.avatarUrl ? (
                                            <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <UserCircle className="w-5 h-5 opacity-40" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-black leading-5 text-slate-900 break-words">{author.name}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-400 break-all">{author.slug}</p>
                                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1">
                                                    <BookOpen className="w-3 h-3 text-indigo-500" />
                                                    <span className="text-[11px] font-black text-indigo-700">{author._count?.stories || 0} truyện</span>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(author)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(author.id)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {author.bio && (
                                            <p className="mt-2 text-xs leading-5 text-slate-500 line-clamp-2">{author.bio}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Users className="w-6 h-6 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Không tìm thấy tác giả</h3>
                            <p className="text-slate-500 mt-1">Cần thêm tác giả mới hoặc thay đổi bộ lọc.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Create/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-slate-900">
                                {editingAuthor ? 'Chỉnh sửa Tác giả' : 'Thêm Tác giả Mới'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8">
                            <AuthorForm
                                initialData={editingAuthor ? {
                                    name: editingAuthor.name,
                                    slug: editingAuthor.slug,
                                    language: editingAuthor.language || selectedLocale,
                                    bio: editingAuthor.bio ?? undefined,
                                    avatarUrl: editingAuthor.avatarUrl ?? undefined,
                                } : {}}
                                defaultLanguage={selectedLocale}
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

