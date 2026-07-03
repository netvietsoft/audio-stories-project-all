"use client";

import { useRef, useState } from 'react';
import { Link2, Loader2, Trash2, Upload, X } from 'lucide-react';
import { adminApiClient } from '@/lib/api/admin-api-client';
import { unwrapData } from '@/lib/api/unwrap';

type HybridImageUploaderProps = {
  value?: string;
  disabled?: boolean;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  previewAspectRatio?: string; // e.g., "aspect-[3/4]" or "aspect-[16/6]"
  previewWidthClass?: string; // >>> KÍCH THƯỚC ẢNH PREVIEW: bề rộng Tailwind (w-full mặc định; w-1/2 ≈ 1/4 diện tích)
};

type Mode = 'upload' | 'url';

export const HybridImageUploader = ({
  value,
  disabled,
  onChange,
  onUploadingChange,
  previewAspectRatio = "aspect-[3/4]",
  previewWidthClass = "w-full",
}: HybridImageUploaderProps) => {
  const [mode, setMode] = useState<Mode>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload ảnh lên R2 qua BE POST /upload/image (thay UploadThing — không cần UPLOADTHING_TOKEN).
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    onUploadingChange?.(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await adminApiClient.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = unwrapData<{ url?: string }>(res.data)?.url;
      if (url) onChange(url);
      else alert('Lỗi tải ảnh: không nhận được URL từ máy chủ.');
    } catch (err: any) {
      alert(`Lỗi tải ảnh: ${err?.response?.data?.error?.message || err?.message || 'Vui lòng thử lại.'}`);
    } finally {
      setIsUploading(false);
      onUploadingChange?.(false);
    }
  };

  const handleUrlPaste = () => {
    const url = urlInput.trim();
    if (!url) {
      alert('Vui lòng nhập URL ảnh');
      return;
    }
    
    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('URL phải bắt đầu với http:// hoặc https://');
      return;
    }

    onChange(url);
    setUrlInput('');
    setMode('upload');
  };

  const handleClearImage = () => {
    onChange('');
    setUrlInput('');
  };

  if (value) {
    return (
      <div className={`group relative ${previewWidthClass} ${previewAspectRatio} overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100`}>
        <img src={value} alt="Preview" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={handleClearImage}
          className="absolute right-3 top-3 rounded-lg bg-white/90 p-2 text-red-500 shadow transition hover:bg-red-500 hover:text-white"
          aria-label="Xóa ảnh"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle Tabs */}
      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
            mode === 'upload'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="h-4 w-4" />
          Tải lên
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
            mode === 'url'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Link2 className="h-4 w-4" />
          Dán link
        </button>
      </div>

      {/* Upload Mode (R2 qua BE /upload/image) */}
      {mode === 'upload' && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-60"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <span className="text-xs font-bold text-slate-700">Đang tải ảnh...</span>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <Upload className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold uppercase tracking-tight text-slate-700">Click hoặc chọn ảnh</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Hỗ trợ JPG, PNG, GIF, WEBP (tối đa 10MB)</p>
                </div>
              </>
            )}
          </button>
        </>
      )}

      {/* URL Paste Mode */}
      {mode === 'url' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-600">Link ảnh (URL)</label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://images.example.com/product.jpg"
              onKeyDown={(e) => e.key === 'Enter' && handleUrlPaste()}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none ring-indigo-500/20 transition focus:ring-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUrlPaste}
                disabled={disabled || !urlInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <Link2 className="h-4 w-4" />
                Dán link
              </button>
              <button
                type="button"
                onClick={() => setUrlInput('')}
                className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">
              💡 <span className="font-black">Mẹo:</span> Dán trực tiếp link Shopee, Lazada v.v. để tiết kiệm dung lượng storage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
