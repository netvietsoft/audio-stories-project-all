"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Image as ImageIcon, Loader2, Music2, Save, UploadCloud, X } from "lucide-react";

const schema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tiêu đề"),
  artist: z.string().trim().min(1, "Vui lòng nhập tác giả / nghệ sĩ"),
  isPublic: z.enum(["true", "false"]),
  audioDuration: z.number().min(0, "Thời lượng không hợp lệ").optional(),
});

type MusicFormValues = z.infer<typeof schema>;

export type MusicFormInitialData = {
  id?: string;
  title?: string;
  artist?: string;
  thumbnailUrl?: string | null;
  audioUrl?: string;
  audioDuration?: number | null;
  isPublic?: boolean;
};

export type MusicFormSubmitPayload = {
  title: string;
  artist: string;
  isPublic: boolean;
  audioDuration: number | null;
  audioFile?: File;
  thumbnailFile?: File;
  clearThumbnail?: boolean;
};

type MusicFormProps = {
  initialData?: MusicFormInitialData;
  onSubmit: (payload: MusicFormSubmitPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
};

const formatSeconds = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const revokeObjectUrl = (url?: string | null) => {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

export default function MusicForm({ initialData, onSubmit, onCancel, isLoading }: MusicFormProps) {
  const [thumbnailFile, setThumbnailFile] = useState<File | undefined>(undefined);
  const [audioFile, setAudioFile] = useState<File | undefined>(undefined);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(initialData?.thumbnailUrl || "");
  const [audioPreview, setAudioPreview] = useState<string>(initialData?.audioUrl || "");
  const [clearThumbnail, setClearThumbnail] = useState(false);
  const [isReadingDuration, setIsReadingDuration] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MusicFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialData?.title || "",
      artist: initialData?.artist || "",
      isPublic: initialData?.isPublic === false ? "false" : "true",
      audioDuration: typeof initialData?.audioDuration === "number" ? initialData.audioDuration : 0,
    },
  });

  useEffect(() => {
    return () => {
      revokeObjectUrl(thumbnailPreview);
      revokeObjectUrl(audioPreview);
    };
  }, [audioPreview, thumbnailPreview]);

  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    revokeObjectUrl(thumbnailPreview);
    const nextPreview = URL.createObjectURL(file);

    setThumbnailFile(file);
    setThumbnailPreview(nextPreview);
    setClearThumbnail(false);
  };

  const handleAudioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAudioError(null);
    revokeObjectUrl(audioPreview);

    const nextPreview = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioPreview(nextPreview);
    setIsReadingDuration(true);

    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
      setValue("audioDuration", seconds, { shouldValidate: true, shouldDirty: true });
      setIsReadingDuration(false);
    };
    probe.onerror = () => {
      setIsReadingDuration(false);
      setAudioError("Không đọc được thời lượng file audio. Vui lòng chọn file khác.");
    };
    probe.src = nextPreview;
    probe.load();
  };

  const handleRemoveThumbnail = () => {
    if (thumbnailFile) {
      revokeObjectUrl(thumbnailPreview);
      setThumbnailFile(undefined);
      setThumbnailPreview(initialData?.thumbnailUrl || "");
      return;
    }

    if (initialData?.thumbnailUrl) {
      setThumbnailPreview("");
      setClearThumbnail(true);
    }
  };

  const durationLabel = useMemo(() => {
    const value = typeof initialData?.audioDuration === "number" ? initialData.audioDuration : undefined;
    return value;
  }, [initialData?.audioDuration]);

  const submitForm = async (values: MusicFormValues) => {
    if (!audioFile && !initialData?.audioUrl) {
      setAudioError("Vui lòng chọn file audio.");
      return;
    }

    await onSubmit({
      title: values.title.trim(),
      artist: values.artist.trim(),
      isPublic: values.isPublic === "true",
      audioDuration: typeof values.audioDuration === "number" ? values.audioDuration : null,
      audioFile,
      thumbnailFile,
      clearThumbnail,
    });
  };

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="space-y-4 lg:w-1/2">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Music2 className="h-5 w-5 text-indigo-600" />
            Thông tin cơ bản
          </h3>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tiêu đề</label>
            <input
              {...register("title")}
              className={`admin-input w-full bg-white ${errors.title ? "admin-input-error" : ""}`}
            />
            {errors.title ? <p className="text-xs text-red-500">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tác giả / Nghệ sĩ</label>
            <input
              {...register("artist")}
              className={`admin-input w-full bg-white ${errors.artist ? "admin-input-error" : ""}`}
            />
            {errors.artist ? <p className="text-xs text-red-500">{errors.artist.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Trạng thái</label>
            <select {...register("isPublic")} className="admin-input w-full appearance-none bg-white">
              <option value="true">Công khai</option>
              <option value="false">Ẩn</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Thời lượng (giây)</label>
            <input
                {...register("audioDuration", { valueAsNumber: true })}
              type="number"
              readOnly
              tabIndex={-1}
              className={`admin-input w-full bg-white ${errors.audioDuration ? "admin-input-error" : ""}`}
            />
            <p className="text-xs font-medium text-slate-500">
              {isReadingDuration
                ? "Đang đọc thời lượng từ file audio..."
                : `Định dạng mm:ss: ${formatSeconds(durationLabel)}`}
            </p>
            {errors.audioDuration ? <p className="text-xs text-red-500">{errors.audioDuration.message}</p> : null}
          </div>
        </div>

        <div className="space-y-4 lg:w-1/2">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <UploadCloud className="h-5 w-5 text-amber-500" />
            Upload media
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Thumbnail</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              className="admin-input w-full bg-white file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-700"
            />
            {thumbnailPreview ? (
              <div className="relative mt-2 overflow-hidden rounded-2xl border border-slate-200">
                <Image
                  src={thumbnailPreview}
                  alt="thumbnail preview"
                  width={800}
                  height={450}
                  unoptimized
                  className="h-40 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveThumbnail}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-rose-500 shadow"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Audio</label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              className="admin-input w-full bg-white file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-700"
            />
            {audioPreview ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <audio controls src={audioPreview} className="w-full" />
              </div>
            ) : null}
            {audioError ? <p className="text-xs text-red-500">{audioError}</p> : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" /> Hủy
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu nhạc
        </button>
      </div>
    </form>
  );
}
