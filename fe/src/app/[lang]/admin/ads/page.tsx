"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/shared/LocalizedLink';

import { adminApiClient as apiClient, ADMIN_ACCESS_TOKEN_KEY } from '@/lib/api/admin-api-client';
import { useAdminStore } from '@/stores/admin-store';

type AdItem = {
  id: string;
  partnerName: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  language?: 'vi' | 'en' | 'all' | string;
  languageId?: number | null;
  isGlobal?: boolean;
  routeType?: number;
  isActive: boolean;
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function AdsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ lang?: string }>();
  const selectedLanguage = searchParams.get('language') || 'all';
  const [items, setItems] = useState<AdItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [frequencyValue, setFrequencyValue] = useState('1000');
  const [isSavingFrequency, setIsSavingFrequency] = useState(false);
  const [isLoadingFrequency, setIsLoadingFrequency] = useState(true);
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
    router.push(`/${lang}/admin/login`);
  };

  const fetchAds = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/ads', {
        params:
          selectedLanguage === 'all'
            ? { routeType: 1 }
            : { lang: selectedLanguage, routeType: 1 },
      });
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        handleUnauthorized();
      } else {
        console.error('Failed to fetch ads:', error);
      }
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAds();
  }, [selectedLanguage]);

  // If this admin ads page should show only inline ads, it's fine — routeType defaults to 1 on backend

  const handleLanguageFilterChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') {
      next.delete('language');
    } else {
      next.set('language', value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  useEffect(() => {
    const fetchFrequencyConfig = async () => {
      setIsLoadingFrequency(true);
      try {
        const response = await apiClient.get('/settings/ad_insertion_frequency');
        const rawValue = response?.data?.value;
        const parsed = Number(rawValue);
        setFrequencyValue(Number.isFinite(parsed) && parsed > 0 ? String(Math.floor(parsed)) : '1000');
      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          handleUnauthorized();
        } else {
          console.error('Failed to fetch ad insertion frequency config:', error);
        }
        setFrequencyValue('1000');
      } finally {
        setIsLoadingFrequency(false);
      }
    };

    void fetchFrequencyConfig();
  }, []);

  const handleSaveFrequency = async () => {
    const parsed = Number(frequencyValue);
    if (!Number.isFinite(parsed) || parsed < 1) {
      showToast({
        type: 'error',
        message: 'Giá trị tần suất phải là số nguyên dương.',
      });
      return;
    }

    setIsSavingFrequency(true);
    try {
      await apiClient.patch('/settings/ad_insertion_frequency', {
        value: Math.floor(parsed),
      });
      setFrequencyValue(String(Math.floor(parsed)));
      showToast({
        type: 'success',
        message: 'Đã lưu cấu hình tần suất chèn quảng cáo.',
      });
    } catch (error) {
      console.error('Failed to update ad insertion frequency config:', error);
      showToast({
        type: 'error',
        message: 'Lưu cấu hình thất bại. Vui lòng thử lại.',
      });
    } finally {
      setIsSavingFrequency(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc muốn xoá quảng cáo \"${title}\"?`)) return;

    setDeletingId(id);
    try {
      await apiClient.delete(`/ads/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Failed to delete ad:', error);
      alert('Xoá quảng cáo thất bại.');
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
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-200">
              <Megaphone className="h-6 w-6 text-white" />
            </span>
            Quảng cáo Inline
          </h1>
          <p className="mt-2 font-medium text-slate-500">Danh sách campaign quảng cáo inline dùng để nhúng vào nội dung chương truyện.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="ads-language-filter" className="text-xs font-black uppercase tracking-wider text-slate-500">
              Ngôn ngữ
            </label>
            <select
              id="ads-language-filter"
              value={selectedLanguage}
              onChange={(event) => handleLanguageFilterChange(event.target.value)}
              className="admin-input h-10 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700"
            >
              <option value="all">Tất cả</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>

          <Link href="/admin/ads/new" className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-orange-100 transition hover:bg-orange-600">
            <Plus className="h-4 w-4" />
            Thêm quảng cáo
          </Link>
        </div>
      </div>

      <section className="rounded-2xl bg-pink-50 p-6 shadow-sm dark:bg-pink-950/30">
        <div className="space-y-3">
          <h2 className="text-lg font-black tracking-tight text-pink-900 dark:text-pink-100">Cấu hình tần suất chèn quảng cáo</h2>
          <p className="text-sm text-pink-800/90 dark:text-pink-200/90">
            Nhập số chữ (ký tự) ước tính để chia đoạn và chèn quảng cáo xen kẽ vào truyện (Ví dụ: 1000).
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="number"
            min={1}
            step={1}
            value={frequencyValue}
            onChange={(event) => setFrequencyValue(event.target.value)}
            disabled={isLoadingFrequency || isSavingFrequency}
            className="h-11 w-full max-w-[220px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 outline-none ring-pink-400/20 transition focus:ring-2 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => void handleSaveFrequency()}
            disabled={isLoadingFrequency || isSavingFrequency}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingFrequency ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Lưu cấu hình
          </button>
        </div>
      </section>

      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Ảnh</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Tiêu đề</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Đối tác</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Ngôn ngữ</th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Link đích</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm font-medium text-slate-500">Chưa có quảng cáo nào.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.title}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{item.partnerName}</td>
                    <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                      {item.isGlobal ? 'ALL' : (item.language === 'vi' ? 'VI' : item.language === 'en' ? 'EN' : 'ALL')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="line-clamp-1 text-xs text-slate-600">{item.targetUrl}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/ads/${item.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </Link>
                        <button
                          onClick={() => void handleDelete(item.id, item.title)}
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
