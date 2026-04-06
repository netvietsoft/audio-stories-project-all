"use client";

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export type SocialLinkFormValues = {
  platform: string;
  label: string;
  url: string;
  iconUrl?: string;
  orderIndex?: number;
  isActive?: boolean;
};

type Props = {
  initialData?: SocialLinkFormValues;
  isLoading?: boolean;
  onSubmit: (values: SocialLinkFormValues) => void | Promise<void>;
  onCancel: () => void;
};

const platforms = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'discord', label: 'Discord' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Khác' },
];

export default function SocialLinkForm({ initialData, isLoading, onSubmit, onCancel }: Props) {
  const [platform, setPlatform] = useState(initialData?.platform || 'facebook');
  const [label, setLabel] = useState(initialData?.label || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [iconUrl, setIconUrl] = useState(initialData?.iconUrl || '');
  const [orderIndex, setOrderIndex] = useState(initialData?.orderIndex?.toString() || '0');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    const payload: SocialLinkFormValues = {
      platform,
      label: label.trim(),
      url: url.trim(),
      iconUrl: iconUrl.trim() || undefined,
      orderIndex: parseInt(orderIndex) || 0,
      isActive,
    };

    void onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Nền tảng <span className="text-red-500">*</span>
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            required
            disabled={isLoading}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            {platforms.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Nhãn hiển thị
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={isLoading}
            placeholder="Ví dụ: Cộng đồng Facebook"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={isLoading}
          placeholder="https://facebook.com/..."
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          Icon URL (tùy chọn)
        </label>
        <input
          type="url"
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          disabled={isLoading}
          placeholder="https://example.com/icon.png"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Thứ tự hiển thị
          </label>
          <input
            type="number"
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
            min="0"
            disabled={isLoading}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Trạng thái
          </label>
          <div className="flex h-12 items-center">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isLoading}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <span className="text-sm font-semibold text-slate-700">Hiển thị</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-6">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {initialData ? 'Cập nhật' : 'Tạo mới'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
