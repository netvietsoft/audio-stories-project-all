"use client";

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from '@/components/shared/LocalizedLink';
import { useParams } from 'next/navigation';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';

type BannerItem = {
  id: string;
  titleVi: string;
  titleEn: string;
  imageUrl: string;
  targetUrl: string;
  order: number;
  isActive: boolean;
  story?: {
    id: string;
    slug: string;
    title: string;
  } | null;
};

export default function BannersPage() {
  const [items, setItems] = useState<BannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const params = useParams<{ lang?: string }>();
  const urlLang = params?.lang === 'en' ? 'en' : 'vi';
  const [selectedLocale, setSelectedLocale] = useState(urlLang);
  const { languages } = useAdminLanguages();

  const fetchBanners = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/banners/admin');
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBanners();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    const confirmed = confirm(`Bạn có chắc muốn xoá banner \"${title}\"?`);
    if (!confirmed) return;

    setIsDeletingId(id);
    try {
      await apiClient.delete(`/banners/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Failed to delete banner:', error);
      alert('Xoá banner thất bại. Vui lòng thử lại.');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
              <ImageIcon className="h-6 w-6 text-white" />
            </span>
            Quản lý Banner Hero
          </h1>
          <p className="mt-2 font-medium text-slate-500">Quản lý slideshow quảng cáo hiển thị tại Hero Section trang chủ.</p>
        </div>

        <div className="flex items-center gap-3">
          <AdminLanguageDropdown
            languages={languages}
            value={selectedLocale}
            onChange={setSelectedLocale}
            className="w-48"
          />
          <Link
            href={`/banners/new?lang=${selectedLocale}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Thêm banner
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Ảnh</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Tiêu đề</th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">Vị trí</th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Link đích</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm font-medium text-slate-500">
                    Chưa có banner nào. Hãy tạo banner đầu tiên.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="h-14 w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <img src={item.imageUrl} alt={item.titleVi || item.titleEn} className="h-full w-full object-cover" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900">{item.titleVi || item.titleEn}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">EN: {item.titleEn || item.titleVi}</p>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-black text-slate-700">{item.order}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                          item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="line-clamp-1 text-xs font-medium text-slate-600">{item.targetUrl}</p>
                      {item.story ? <p className="mt-1 text-[11px] text-slate-500">Story: {item.story.slug}</p> : null}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/banners/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </Link>
                        <button
                          onClick={() => void handleDelete(item.id, item.titleVi || item.titleEn)}
                          disabled={isDeletingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          {isDeletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
