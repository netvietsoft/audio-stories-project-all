"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Share2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient, ADMIN_ACCESS_TOKEN_KEY } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import { useAdminStore } from '@/stores/admin-store';

type SocialLinkItem = {
  id: string;
  platform: string;
  label: string;
  url: string;
  iconUrl?: string;
  orderIndex: number;
  isActive: boolean;
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

const platformLabels: Record<string, string> = {
  facebook: 'Facebook',
  telegram: 'Telegram',
  zalo: 'Zalo',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  reddit: 'Reddit',
  discord: 'Discord',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  other: 'Khác',
};

export default function SocialLinksPage() {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const [items, setItems] = useState<SocialLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (next: NonNullable<ToastState>) => {
    setToast(next);
    window.setTimeout(() => {
      setToast((current) => (current?.message === next.message ? null : current));
    }, 2400);
  };

  const handleUnauthorized = () => {
    useAdminStore.getState().clearAuth();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminLoggedIn');
      localStorage.removeItem('userEmail');
      localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    }
    const lang = params?.lang === 'en' ? 'en' : 'vi';
    router.push(`/${lang}/login`);
  };

  const fetchSocialLinks = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/social-links/admin/all');
      setItems(unwrapList<SocialLinkItem>(response.data));
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        handleUnauthorized();
      } else {
        console.error('Failed to fetch social links:', error);
      }
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSocialLinks();
  }, []);

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Bạn có chắc muốn xoá link \"${label}\"?`)) return;

    setDeletingId(id);
    try {
      await apiClient.delete(`/social-links/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      showToast({
        type: 'success',
        message: 'Đã xoá link thành công.',
      });
    } catch (error) {
      console.error('Failed to delete social link:', error);
      showToast({
        type: 'error',
        message: 'Xoá link thất bại.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {toast ? (
        <div className="fixed right-6 top-5 z-[100]">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-200">
              <Share2 className="h-6 w-6 text-white" />
            </span>
            Quản lý Link Cộng đồng
          </h1>
          <p className="mt-2 font-medium text-slate-500">Danh sách các link mạng xã hội và cộng đồng hiển thị trên website.</p>
        </div>

        <Link href="/social-links/new" className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-blue-100 transition hover:bg-blue-600">
          <Plus className="h-4 w-4" />
          Thêm link
        </Link>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Thứ tự</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Nền tảng</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Nhãn</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">URL</th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm font-medium text-slate-500">Chưa có link nào.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.orderIndex}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                        {platformLabels[item.platform] || item.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.label}</td>
                    <td className="px-6 py-4">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="line-clamp-1 text-xs text-blue-600 hover:underline">
                        {item.url}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/social-links/${item.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </Link>
                        <button
                          onClick={() => void handleDelete(item.id, item.label)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
