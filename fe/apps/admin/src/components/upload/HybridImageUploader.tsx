"use client";

import { useState } from 'react';
import { Link2, Loader2, Trash2, Upload, X } from 'lucide-react';
import { UploadButton } from '@/lib/uploadthing';

type HybridImageUploaderProps = {
  value?: string;
  disabled?: boolean;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  previewAspectRatio?: string; // e.g., "aspect-[3/4]" or "aspect-[16/6]"
};

type Mode = 'upload' | 'url';

export const HybridImageUploader = ({
  value,
  disabled,
  onChange,
  onUploadingChange,
  previewAspectRatio = "aspect-[3/4]",
}: HybridImageUploaderProps) => {
  const [mode, setMode] = useState<Mode>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

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
      <div className={`group relative w-full ${previewAspectRatio} overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100`}>
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

      {/* Upload Mode */}
      {mode === 'upload' && (
        <UploadButton
          endpoint="imageUploader"
          onUploadBegin={() => {
            setIsUploading(true);
            onUploadingChange?.(true);
          }}
          onClientUploadComplete={(res) => {
            setIsUploading(false);
            onUploadingChange?.(false);
            if (res?.[0]) {
              const uploadedUrl = (res[0] as any).ufsUrl || (res[0] as any).url;
              if (uploadedUrl) onChange(uploadedUrl);
            }
          }}
          onUploadError={(error: Error) => {
            setIsUploading(false);
            onUploadingChange?.(false);
            alert(`Lỗi tải ảnh: ${error.message}`);
          }}
          appearance={{
            container: { width: '100%' },
            button: {
              width: '100%',
              minHeight: '160px',
              borderRadius: '16px',
              border: '2px dashed #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#334155',
              fontSize: '0px',
            },
            allowedContent: { display: 'none' },
          }}
          content={{
            button({ isUploading }) {
              if (isUploading) {
                return (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Đang tải ảnh...</span>
                  </div>
                );
              }
              return (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                    <Upload className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Click hoặc kéo ảnh vào</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Hỗ trợ JPG, PNG, WEBP (Tối đa 4MB)</p>
                  </div>
                </div>
              );
            },
          }}
        />
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
