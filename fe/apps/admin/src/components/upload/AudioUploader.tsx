"use client";

import { useRef, useState } from 'react';
import { Loader2, Music, Upload, X } from 'lucide-react';

import { uploadAudioToR2 } from '@/lib/api/upload-media';

type AudioUploaderProps = {
  value?: string;
  disabled?: boolean;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3'];
const MAX_SIZE_MB = 100;

export const AudioUploader = ({ value, disabled, onChange, onUploadingChange }: AudioUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      alert('Chỉ hỗ trợ file MP3 (audio/mpeg, audio/mp3).');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert('Kích thước file vượt quá 100MB.');
      event.target.value = '';
      return;
    }

    try {
      setIsUploading(true);
      onUploadingChange?.(true);
      setProgress(0);
      const uploadedUrl = await uploadAudioToR2(file, setProgress);
      onChange(uploadedUrl);
    } catch (error) {
      alert('Upload audio thất bại. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
      onUploadingChange?.(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="w-full min-h-[160px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center gap-3 px-4"
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/mp3"
          className="hidden"
          onChange={handleSelect}
          disabled={disabled || isUploading}
        />

        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-3 disabled:opacity-60"
        >
          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
            {isUploading ? <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /> : <Upload className="w-6 h-6 text-indigo-600" />}
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Click để chọn file MP3</p>
            <p className="text-xs font-medium text-slate-400 mt-1">Tối đa 100MB</p>
          </div>
        </button>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-semibold text-slate-500">Đang tải lên: {progress}%</p>
        </div>
      )}

      {value && (
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-indigo-700 font-semibold">
            <Music className="w-4 h-4" />
            <span>Audio đã upload</span>
          </div>
          <div className="w-full md:w-auto flex items-center gap-3">
            <audio controls src={value} className="w-full max-w-md h-10" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-all shadow-sm shrink-0"
              title="Xóa audio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
