"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Image as ImageIcon, Loader2, Music2, Save, UploadCloud, X } from "lucide-react";

const schema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tiêu đề"),
  slug: z.string().trim().min(1, "Vui lòng nhập slug"),
  artist: z.string().trim().min(1, "Vui lòng nhập tác giả / nghệ sĩ"),
  description: z.string().max(5000, "Mô tả tối đa 5000 ký tự").optional(),
  tagsInput: z.string().optional(),
  isPublic: z.enum(["true", "false"]),
  contentType: z.enum(["single", "podcast", "playlist"]),
  accessType: z.enum(["free", "vip"]),
  unlockPrice: z.number().min(0, "Giá mở khóa không hợp lệ").optional(),
  introEnabled: z.enum(["true", "false"]),
  audioDuration: z.number().min(0, "Thời lượng không hợp lệ").optional(),
}).superRefine((values, context) => {
  if (values.accessType === "vip" && (!values.unlockPrice || values.unlockPrice <= 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unlockPrice"],
      message: "Vui lòng nhập giá mở khóa lớn hơn 0 cho nội dung VIP.",
    });
  }
});

type MusicFormValues = z.infer<typeof schema>;

type MusicTrackOption = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl?: string | null;
  audioDuration?: number | null;
};

export type MusicFormInitialData = {
  id?: string;
  title?: string;
  slug?: string;
  artist?: string;
  description?: string | null;
  tags?: string[];
  thumbnailUrl?: string | null;
  audioUrl?: string;
  audioDuration?: number | null;
  isPublic?: boolean;
  contentType?: "single" | "podcast" | "playlist";
  accessType?: "free" | "vip";
  unlockPrice?: number;
  introEnabled?: boolean;
  playlistTrackIds?: string[];
};

export type MusicFormSubmitPayload = {
  title: string;
  slug: string;
  artist: string;
  description: string;
  tags: string[];
  isPublic: boolean;
  contentType: "single" | "podcast" | "playlist";
  accessType: "free" | "vip";
  unlockPrice: number;
  introEnabled: boolean;
  playlistTrackIds: string[];
  audioDuration: number | null;
  audioFile?: File;
  thumbnailFile?: File;
  clearThumbnail?: boolean;
};

type MusicFormProps = {
  initialData?: MusicFormInitialData;
  availableTracks?: MusicTrackOption[];
  onSubmit: (payload: MusicFormSubmitPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitError?: string | null;
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

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export default function MusicForm({
  initialData,
  availableTracks = [],
  onSubmit,
  onCancel,
  isLoading,
  submitError,
}: MusicFormProps) {
  const [thumbnailFile, setThumbnailFile] = useState<File | undefined>(undefined);
  const [audioFile, setAudioFile] = useState<File | undefined>(undefined);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(initialData?.thumbnailUrl || "");
  const [audioPreview, setAudioPreview] = useState<string>(initialData?.audioUrl || "");
  const [clearThumbnail, setClearThumbnail] = useState(false);
  const [isReadingDuration, setIsReadingDuration] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [lastAutoSlug, setLastAutoSlug] = useState(() => toSlug(initialData?.title || ""));
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>(
    Array.isArray(initialData?.playlistTrackIds) ? initialData.playlistTrackIds : [],
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<MusicFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialData?.title || "",
      slug: initialData?.slug || toSlug(initialData?.title || ""),
      artist: initialData?.artist || "",
      description: initialData?.description || "",
      tagsInput: Array.isArray(initialData?.tags) ? initialData.tags.join(", ") : "",
      isPublic: initialData?.isPublic === false ? "false" : "true",
      contentType: initialData?.contentType || "single",
      accessType: initialData?.accessType || "free",
      unlockPrice: typeof initialData?.unlockPrice === "number" ? initialData.unlockPrice : 0,
      introEnabled: initialData?.introEnabled === false ? "false" : "true",
      audioDuration: typeof initialData?.audioDuration === "number" ? initialData.audioDuration : 0,
    },
  });

  const contentType = useWatch({
    control,
    name: "contentType",
    defaultValue: initialData?.contentType || "single",
  });
  const accessType = useWatch({
    control,
    name: "accessType",
    defaultValue: initialData?.accessType || "free",
  });
  const title = useWatch({ control, name: "title" });
  const slug = useWatch({ control, name: "slug" });
  const watchedDuration = useWatch({ control, name: "audioDuration" });

  useEffect(() => {
    const nextAutoSlug = toSlug(title || "");
    if (!nextAutoSlug) return;

    if (!slug || slug === lastAutoSlug) {
      setValue("slug", nextAutoSlug, { shouldDirty: true, shouldValidate: true });
      setLastAutoSlug(nextAutoSlug);
    }
  }, [lastAutoSlug, setValue, slug, title]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(thumbnailPreview);
      revokeObjectUrl(audioPreview);
    };
  }, [audioPreview, thumbnailPreview]);

  const selectableTracks = useMemo(
    () => availableTracks.filter((item) => item.id !== initialData?.id),
    [availableTracks, initialData?.id],
  );

  const selectedTracks = useMemo(
    () =>
      selectedTrackIds
        .map((trackId) => selectableTracks.find((item) => item.id === trackId))
        .filter((item): item is MusicTrackOption => Boolean(item)),
    [selectableTracks, selectedTrackIds],
  );

  const filteredTracks = useMemo(() => {
    const keyword = playlistQuery.trim().toLowerCase();

    return selectableTracks.filter((item) => {
      if (!keyword) return true;
      return item.title.toLowerCase().includes(keyword) || item.artist.toLowerCase().includes(keyword);
    });
  }, [playlistQuery, selectableTracks]);

  useEffect(() => {
    if (contentType !== "playlist") return;

    const totalDuration = selectedTracks.reduce((sum, item) => sum + (item.audioDuration || 0), 0);
    setValue("audioDuration", totalDuration, { shouldDirty: true, shouldValidate: true });
  }, [contentType, selectedTracks, setValue]);

  useEffect(() => {
    if (accessType === "vip") return;
    setValue("unlockPrice", 0, { shouldDirty: true, shouldValidate: true });
    clearErrors("unlockPrice");
  }, [accessType, clearErrors, setValue]);

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

  const toggleTrackSelection = (trackId: string) => {
    setPlaylistError(null);
    setSelectedTrackIds((prev) => {
      if (prev.includes(trackId)) {
        return prev.filter((id) => id !== trackId);
      }
      return [...prev, trackId];
    });
  };

  const submitForm = async (values: MusicFormValues) => {
    const isPlaylist = values.contentType === "playlist";

    if (!isPlaylist && !audioFile && !initialData?.audioUrl) {
      setAudioError("Vui lòng chọn file audio.");
      return;
    }

    if (isPlaylist && selectedTrackIds.length === 0) {
      setPlaylistError("Vui lòng chọn ít nhất 1 track để tạo playlist.");
      return;
    }

    if (values.accessType === "vip" && (!values.unlockPrice || values.unlockPrice <= 0)) {
      setError("unlockPrice", {
        type: "manual",
        message: "Vui lòng nhập giá mở khóa lớn hơn 0 cho nội dung VIP.",
      });
      return;
    }

    const tags = Array.from(
      new Set(
        (values.tagsInput || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    await onSubmit({
      title: values.title.trim(),
      slug: toSlug(values.slug.trim()),
      artist: values.artist.trim(),
      description: (values.description || "").trim(),
      tags,
      isPublic: values.isPublic === "true",
      contentType: values.contentType,
      accessType: values.accessType,
      unlockPrice: values.accessType === "vip" ? Math.max(0, Math.floor(values.unlockPrice || 0)) : 0,
      introEnabled: values.introEnabled === "true",
      playlistTrackIds: values.contentType === "playlist" ? selectedTrackIds : [],
      audioDuration: typeof values.audioDuration === "number" ? values.audioDuration : null,
      audioFile: values.contentType !== "playlist" ? audioFile : undefined,
      thumbnailFile,
      clearThumbnail,
    });
  };

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
      {submitError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="mb-1 font-black uppercase tracking-wider text-rose-800">Lỗi từ máy chủ</p>
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-rose-700">{submitError}</pre>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="space-y-4 lg:w-1/2">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Music2 className="h-5 w-5 text-indigo-600" />
            Thông tin cơ bản
          </h3>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Loại nội dung</label>
            <select {...register("contentType")} className="admin-input w-full appearance-none bg-white">
              <option value="single">Bài lẻ</option>
              <option value="podcast">Podcast</option>
              <option value="playlist">Playlist hệ thống</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Quyền truy cập</label>
              <select {...register("accessType")} className="admin-input w-full appearance-none bg-white">
                <option value="free">Miễn phí</option>
                <option value="vip">Khóa VIP</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Giá mở khóa (credits)</label>
              <input
                {...register("unlockPrice", { valueAsNumber: true })}
                type="number"
                min={0}
                step={1}
                disabled={accessType !== "vip"}
                className={`admin-input w-full bg-white ${errors.unlockPrice ? "admin-input-error" : ""}`}
              />
              <p className="text-xs font-medium text-slate-500">
                {accessType === "vip"
                  ? "Áp dụng cho bài lẻ/podcast, hoặc mở khóa toàn bộ playlist nếu là playlist."
                  : "Miễn phí: giá tự động về 0."}
              </p>
              {errors.unlockPrice ? <p className="text-xs text-red-500">{errors.unlockPrice.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Hiển thị phần giới thiệu</label>
            <select {...register("introEnabled")} className="admin-input w-full appearance-none bg-white">
              <option value="true">Bật</option>
              <option value="false">Tắt</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tiêu đề</label>
            <input
              {...register("title")}
              className={`admin-input w-full bg-white ${errors.title ? "admin-input-error" : ""}`}
            />
            {errors.title ? <p className="text-xs text-red-500">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Slug</label>
            <input
              {...register("slug")}
              className={`admin-input w-full bg-white ${errors.slug ? "admin-input-error" : ""}`}
            />
            <p className="text-xs font-medium text-slate-500">Tự động sinh từ tiêu đề, có thể chỉnh tay.</p>
            {errors.slug ? <p className="text-xs text-red-500">{errors.slug.message}</p> : null}
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
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Mô tả</label>
            <textarea
              {...register("description")}
              rows={4}
              className={`admin-input w-full bg-white ${errors.description ? "admin-input-error" : ""}`}
            />
            {errors.description ? <p className="text-xs text-red-500">{errors.description.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tags (phân tách bằng dấu phẩy)</label>
            <input
              {...register("tagsInput")}
              placeholder="lofi, piano, focus"
              className={`admin-input w-full bg-white ${errors.tagsInput ? "admin-input-error" : ""}`}
            />
            <p className="text-xs font-medium text-slate-500">Ví dụ: lo-fi, deep focus, sleep</p>
            {errors.tagsInput ? <p className="text-xs text-red-500">{errors.tagsInput.message}</p> : null}
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
                : `Định dạng mm:ss: ${formatSeconds(typeof watchedDuration === "number" ? watchedDuration : 0)}`}
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

          {contentType !== "playlist" ? (
            <div key="audio-upload" className="space-y-2">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Audio</label>
              <input
                key="audio-file-input"
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
          ) : (
            <div key="playlist-builder" className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Track trong playlist</label>
              <input
                key="playlist-query-input"
                value={playlistQuery}
                onChange={(event) => setPlaylistQuery(event.target.value)}
                placeholder="Tìm track theo tiêu đề hoặc nghệ sĩ..."
                className="admin-input w-full bg-white"
              />

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {filteredTracks.length ? (
                  filteredTracks.map((track) => {
                    const isSelected = selectedTrackIds.includes(track.id);
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => toggleTrackSelection(track.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-pink-400 bg-pink-50 text-pink-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-pink-300"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{track.title}</span>
                          <span className="block truncate text-xs opacity-75">{track.artist}</span>
                        </span>
                        <span className="ml-3 shrink-0 text-[11px] font-black">{formatSeconds(track.audioDuration)}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500">Không có track phù hợp.</p>
                )}
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
                Đã chọn <span className="font-black text-slate-800">{selectedTracks.length}</span> track
                {selectedTracks.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {selectedTracks.slice(0, 10).map((item, index) => (
                      <li key={item.id} className="truncate">
                        {index + 1}. {item.title}
                      </li>
                    ))}
                    {selectedTracks.length > 10 ? <li>... và {selectedTracks.length - 10} track khác</li> : null}
                  </ul>
                ) : null}
              </div>

              {playlistError ? <p className="text-xs text-red-500">{playlistError}</p> : null}
            </div>
          )}
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
