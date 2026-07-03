"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BadgeDollarSign, Image as ImageIcon, Loader2, Lock, Music2, Save, Settings2, UploadCloud, X } from "lucide-react";
import { formatThousand, parseThousand } from "@/lib/format-number";

const schema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tiêu đề"),
  slug: z.string().trim().min(1, "Vui lòng nhập slug"),
  artist: z.string().trim().min(1, "Vui lòng nhập tác giả / nghệ sĩ"),
  description: z.string().max(5000, "Mô tả tối đa 5000 ký tự").optional(),
  tagsInput: z.string().optional(),
  isPublic: z.enum(["true", "false"]),
  contentType: z.enum(["single", "podcast", "playlist"]),
  accessType: z.enum(["free", "vip"]),
  originalUnlockPrice: z.number().min(0, "Giá gốc không hợp lệ").optional(),
  discountPercent: z.number().min(0, "Mức giảm không hợp lệ").max(99, "Mức giảm tối đa là 99%").optional(),
  unlockPrice: z.number().min(0, "Giá mở khóa không hợp lệ").optional(),
  introEnabled: z.enum(["true", "false"]),
  audioDuration: z.number().min(0, "Thời lượng không hợp lệ").optional(),
}).superRefine((values, context) => {
  if (values.accessType === "vip" && (!values.originalUnlockPrice || values.originalUnlockPrice <= 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["originalUnlockPrice"],
      message: "Vui lòng nhập giá gốc lớn hơn 0 cho nội dung VIP.",
    });
  }

  if (values.accessType === "vip" && (values.discountPercent || 0) >= 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountPercent"],
      message: "Mức giảm giá phải nhỏ hơn 100%.",
    });
  }
});

type MusicFormValues = z.infer<typeof schema>;

type MusicTrackOption = {
  id: string;
  title: string;
  artist: string;
  accessType: "free" | "vip";
  unlockPrice: number;
  thumbnailUrl?: string | null;
  audioDuration?: number | null;
};

type PlaylistTrackAccessConfig = {
  trackId: string;
  accessType: "free" | "vip";
  unlockPrice: number;
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
  originalUnlockPrice?: number | null;
  discountPercent?: number;
  unlockPrice?: number;
  introEnabled?: boolean;
  playlistTrackIds?: string[];
  playlistTrackAccess?: PlaylistTrackAccessConfig[];
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
  originalUnlockPrice: number | null;
  discountPercent: number;
  unlockPrice: number;
  introEnabled: boolean;
  playlistTrackIds: string[];
  playlistTrackAccess: PlaylistTrackAccessConfig[];
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

// Định dạng thời lượng: < 1 giờ -> mm:ss ; >= 1 giờ -> dd:hh:mm:ss (ngày:giờ:phút:giây).
const formatSeconds = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const total = Math.floor(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (total < 3600) {
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  }
  const dd = Math.floor(total / 86400);
  const hh = Math.floor((total % 86400) / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${pad(dd)}:${pad(hh)}:${pad(mm)}:${pad(ss)}`;
};

const ACCEPTED_THUMBNAIL_TYPES = ["image/png", "image/jpeg", "image/webp"];

const revokeObjectUrl = (url?: string | null) => {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [isReadingDuration, setIsReadingDuration] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [lastAutoSlug, setLastAutoSlug] = useState(() => toSlug(initialData?.title || ""));
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>(
    Array.isArray(initialData?.playlistTrackIds) ? initialData.playlistTrackIds : [],
  );
  const [trackAccessConfig, setTrackAccessConfig] = useState<Record<string, { accessType: "free" | "vip"; unlockPrice: number }>>(() => {
    const source = Array.isArray(initialData?.playlistTrackAccess) ? initialData.playlistTrackAccess : [];
    const entries = source.map((item) => [
      item.trackId,
      {
        accessType: item.accessType === "vip" ? "vip" : "free",
        unlockPrice: Math.max(0, Math.floor(item.unlockPrice || 0)),
      },
    ] as const);

    return Object.fromEntries(entries);
  });

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
      originalUnlockPrice: typeof initialData?.originalUnlockPrice === "number"
        ? initialData.originalUnlockPrice
        : (typeof initialData?.unlockPrice === "number" ? initialData.unlockPrice : 0),
      discountPercent: typeof initialData?.discountPercent === "number" ? initialData.discountPercent : 0,
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
  const originalUnlockPrice = useWatch({
    control,
    name: "originalUnlockPrice",
    defaultValue: typeof initialData?.originalUnlockPrice === "number"
      ? initialData.originalUnlockPrice
      : (typeof initialData?.unlockPrice === "number" ? initialData.unlockPrice : 0),
  });
  const discountPercent = useWatch({
    control,
    name: "discountPercent",
    defaultValue: typeof initialData?.discountPercent === "number" ? initialData.discountPercent : 0,
  });
  const title = useWatch({ control, name: "title" });
  const slug = useWatch({ control, name: "slug" });
  const watchedDuration = useWatch({ control, name: "audioDuration" });
  const watchedUnlockPrice = useWatch({ control, name: "unlockPrice" });

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

  const selectedTracksWithAccess = useMemo(
    () =>
      selectedTracks.map((track) => {
        const currentConfig = trackAccessConfig[track.id];
        const defaultAccessType = track.accessType === "vip" ? "vip" : "free";
        const defaultUnlockPrice = defaultAccessType === "vip"
          ? Math.max(1, Math.floor(track.unlockPrice || 0) || 1)
          : 0;

        const accessType = currentConfig?.accessType || defaultAccessType;
        const unlockPrice = accessType === "vip"
          ? Math.max(1, Math.floor(currentConfig?.unlockPrice ?? defaultUnlockPrice))
          : 0;

        return {
          ...track,
          accessType,
          unlockPrice,
        };
      }),
    [selectedTracks, trackAccessConfig],
  );

  useEffect(() => {
    if (contentType !== "playlist") return;

    const totalDuration = selectedTracks.reduce((sum, item) => sum + (item.audioDuration || 0), 0);
    setValue("audioDuration", totalDuration, { shouldDirty: true, shouldValidate: true });
  }, [contentType, selectedTracks, setValue]);

  // >>> TỰ LẤY THỜI LƯỢNG KHI SỬA: audio đã có sẵn (URL R2) nhưng track có thể chưa lưu thời lượng
  // -> đọc metadata trực tiếp từ file audio đó để điền ô "Thời lượng (giây)".
  useEffect(() => {
    if (contentType === "playlist") return;
    if (!audioPreview) return;
    if (typeof watchedDuration === "number" && watchedDuration > 0) return;
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
      if (seconds > 0) setValue("audioDuration", seconds, { shouldDirty: true, shouldValidate: true });
    };
    probe.src = audioPreview;
    probe.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioPreview, contentType]);

  useEffect(() => {
    if (contentType !== "playlist") return;

    setTrackAccessConfig((prev) => {
      const next: Record<string, { accessType: "free" | "vip"; unlockPrice: number }> = { ...prev };
      let changed = false;

      selectedTrackIds.forEach((trackId) => {
        if (next[trackId]) return;

        const sourceTrack = selectableTracks.find((item) => item.id === trackId);
        const accessType = sourceTrack?.accessType === "vip" ? "vip" : "free";
        const unlockPrice = accessType === "vip"
          ? Math.max(1, Math.floor(sourceTrack?.unlockPrice || 0) || 1)
          : 0;

        next[trackId] = {
          accessType,
          unlockPrice,
        };
        changed = true;
      });

      Object.keys(next).forEach((trackId) => {
        if (selectedTrackIds.includes(trackId)) return;
        delete next[trackId];
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [contentType, selectableTracks, selectedTrackIds]);

  useEffect(() => {
    if (accessType === "vip") return;
    setValue("originalUnlockPrice", 0, { shouldDirty: true, shouldValidate: true });
    setValue("discountPercent", 0, { shouldDirty: true, shouldValidate: true });
    setValue("unlockPrice", 0, { shouldDirty: true, shouldValidate: true });
    clearErrors("originalUnlockPrice");
    clearErrors("discountPercent");
    clearErrors("unlockPrice");
  }, [accessType, clearErrors, setValue]);

  useEffect(() => {
    if (accessType !== "vip") return;

    const basePrice = Math.max(0, Math.floor(Number.isFinite(originalUnlockPrice) ? (originalUnlockPrice as number) : 0));
    const discount = Math.max(0, Math.min(99, Math.floor(Number.isFinite(discountPercent) ? (discountPercent as number) : 0)));
    const discounted = basePrice > 0 ? Math.max(1, Math.floor((basePrice * (100 - discount)) / 100)) : 0;

    setValue("unlockPrice", discounted, { shouldDirty: true, shouldValidate: true });
  }, [accessType, discountPercent, originalUnlockPrice, setValue]);

  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_THUMBNAIL_TYPES.includes(file.type)) {
      setThumbnailError("Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP.");
      event.target.value = "";
      return;
    }

    setThumbnailError(null);
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

    // >>> TỰ LẤY THỜI LƯỢNG: đọc metadata file audio vừa chọn -> set "audioDuration" (ô Thời lượng readonly).
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

  const updateTrackAccessType = (trackId: string, accessType: "free" | "vip") => {
    setTrackAccessConfig((prev) => {
      const current = prev[trackId];
      const sourceTrack = selectableTracks.find((item) => item.id === trackId);
      const fallbackUnlockPrice = Math.max(1, Math.floor(sourceTrack?.unlockPrice || 0) || 1);

      return {
        ...prev,
        [trackId]: {
          accessType,
          unlockPrice: accessType === "vip"
            ? Math.max(1, Math.floor(current?.unlockPrice || fallbackUnlockPrice))
            : 0,
        },
      };
    });
  };

  const updateTrackUnlockPrice = (trackId: string, value: number) => {
    setTrackAccessConfig((prev) => {
      const current = prev[trackId];
      if (!current) return prev;

      return {
        ...prev,
        [trackId]: {
          ...current,
          unlockPrice: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0,
        },
      };
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

    if (isPlaylist) {
      const invalidLockedTrack = selectedTrackIds.find((trackId) => {
        const config = trackAccessConfig[trackId];
        return config?.accessType === "vip" && config.unlockPrice <= 0;
      });

      if (invalidLockedTrack) {
        setPlaylistError("Track bị khóa phải có giá mở khóa lớn hơn 0.");
        return;
      }
    }

    if (values.accessType === "vip" && (!values.originalUnlockPrice || values.originalUnlockPrice <= 0)) {
      setError("originalUnlockPrice", {
        type: "manual",
        message: "Vui lòng nhập giá gốc lớn hơn 0 cho nội dung VIP.",
      });
      return;
    }

    const normalizedOriginalUnlockPrice = values.accessType === "vip"
      ? Math.max(0, Math.floor(values.originalUnlockPrice || 0))
      : 0;
    const normalizedDiscountPercent = values.accessType === "vip"
      ? Math.max(0, Math.min(99, Math.floor(values.discountPercent || 0)))
      : 0;
    const computedUnlockPrice = values.accessType === "vip"
      ? Math.max(1, Math.floor((normalizedOriginalUnlockPrice * (100 - normalizedDiscountPercent)) / 100))
      : 0;

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
      originalUnlockPrice: values.accessType === "vip" ? normalizedOriginalUnlockPrice : null,
      discountPercent: values.accessType === "vip" ? normalizedDiscountPercent : 0,
      unlockPrice: computedUnlockPrice,
      introEnabled: values.introEnabled === "true",
      playlistTrackIds: values.contentType === "playlist" ? selectedTrackIds : [],
      playlistTrackAccess: values.contentType === "playlist"
        ? selectedTrackIds.map((trackId) => {
          const sourceTrack = selectableTracks.find((item) => item.id === trackId);
          const config = trackAccessConfig[trackId];
          const accessType = config?.accessType === "vip" ? "vip" : "free";
          const fallbackPrice = Math.max(1, Math.floor(sourceTrack?.unlockPrice || 0) || 1);

          return {
            trackId,
            accessType,
            unlockPrice: accessType === "vip"
              ? Math.max(1, Math.floor(config?.unlockPrice || fallbackPrice))
              : 0,
          };
        })
        : [],
      audioDuration: typeof values.audioDuration === "number" ? values.audioDuration : null,
      audioFile: values.contentType !== "playlist" ? audioFile : undefined,
      thumbnailFile,
      clearThumbnail,
    });
  };

  const thumbnailBlock = (
    <div className="space-y-2.5">
      <label className="text-sm font-black uppercase tracking-wider text-slate-700">Thumbnail</label>
      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleThumbnailChange}
        className="hidden"
      />
      {/* >>> KÍCH THƯỚC THUMBNAIL: max-w-[150px] = bề rộng ô ảnh (tăng/giảm số px để to/nhỏ);
              aspect-square = tỉ lệ vuông (đổi sang aspect-[2/3] nếu muốn ảnh dọc). */}
      <button
        type="button"
        onClick={() => thumbnailInputRef.current?.click()}
        className="group relative flex aspect-square w-full max-w-[150px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 transition hover:border-fuchsia-400 hover:bg-fuchsia-50/40"
      >
        {thumbnailPreview ? (
          <>
            <Image
              src={thumbnailPreview}
              alt="thumbnail preview"
              width={400}
              height={400}
              unoptimized
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent py-2 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100">
              <UploadCloud className="h-3.5 w-3.5" /> Bấm để đổi ảnh
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 text-slate-400 transition group-hover:text-fuchsia-500">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <ImageIcon className="h-6 w-6" />
            </span>
            <span className="text-xs font-bold">Bấm để chọn ảnh</span>
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-400">Chỉ nhận PNG, JPG, WEBP.</p>
        {thumbnailPreview ? (
          <button
            type="button"
            onClick={handleRemoveThumbnail}
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 transition hover:text-rose-600"
          >
            <X className="h-3.5 w-3.5" /> Xóa ảnh
          </button>
        ) : null}
      </div>
      {thumbnailError ? <p className="text-xs font-medium text-rose-500">{thumbnailError}</p> : null}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
      {submitError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="mb-1 font-black uppercase tracking-wider text-rose-800">Lỗi từ máy chủ</p>
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-rose-700">{submitError}</pre>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="space-y-5 lg:w-1/2">
          {/* Section: Thiết lập phát hành */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600">
                <Settings2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">Thiết lập phát hành</h3>
                <p className="text-xs font-medium text-slate-400">Loại nội dung, hiển thị và quyền xem.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">Loại nội dung</label>
                <select {...register("contentType")} className="admin-input w-full bg-white">
                  <option value="single">Bài lẻ</option>
                  <option value="podcast">Podcast</option>
                  <option value="playlist">Playlist hệ thống</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">Quyền truy cập</label>
                <select {...register("accessType")} className="admin-input w-full bg-white">
                  <option value="free">Miễn phí</option>
                  <option value="vip">Khóa VIP</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">Hiển thị phần giới thiệu</label>
                <select {...register("introEnabled")} className="admin-input w-full bg-white">
                  <option value="true">Bật</option>
                  <option value="false">Tắt</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">Trạng thái</label>
                <select {...register("isPublic")} className="admin-input w-full bg-white">
                  <option value="true">Công khai</option>
                  <option value="false">Ẩn</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section: Thông tin cơ bản */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Music2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">Thông tin cơ bản</h3>
                <p className="text-xs font-medium text-slate-400">Tiêu đề, nghệ sĩ và mô tả.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tiêu đề</label>
              <input
                {...register("title")}
                className={`admin-input w-full bg-white ${errors.title ? "admin-input-error" : ""}`}
              />
              {errors.title ? <p className="text-xs font-medium text-rose-500">{errors.title.message}</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">Slug</label>
                <input
                  {...register("slug")}
                  className={`admin-input w-full bg-white ${errors.slug ? "admin-input-error" : ""}`}
                />
                <p className="text-xs font-medium text-slate-400">Tự động sinh từ tiêu đề, có thể chỉnh tay.</p>
                {errors.slug ? <p className="text-xs font-medium text-rose-500">{errors.slug.message}</p> : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tác giả / Nghệ sĩ</label>
                <input
                  {...register("artist")}
                  className={`admin-input w-full bg-white ${errors.artist ? "admin-input-error" : ""}`}
                />
                {errors.artist ? <p className="text-xs font-medium text-rose-500">{errors.artist.message}</p> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Mô tả</label>
              <textarea
                {...register("description")}
                rows={4}
                className={`admin-input w-full resize-none bg-white ${errors.description ? "admin-input-error" : ""}`}
              />
              {errors.description ? <p className="text-xs font-medium text-rose-500">{errors.description.message}</p> : null}
            </div>

            {/* >>> HÀNG Tags + Thời lượng: lưới 2 cột (sm:grid-cols-2). Đổi 'sm:grid-cols-2' -> bỏ để xếp dọc; 'gap-4' = khoảng cách. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Tags (phân tách bằng dấu phẩy)</label>
              <input
                {...register("tagsInput")}
                placeholder="lofi, piano, focus"
                className={`admin-input w-full bg-white ${errors.tagsInput ? "admin-input-error" : ""}`}
              />
              <p className="text-xs font-medium text-slate-400">Ví dụ: lo-fi, deep focus, sleep</p>
              {errors.tagsInput ? <p className="text-xs font-medium text-rose-500">{errors.tagsInput.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Thời lượng (giây)</label>
              {/* >>> Ô readonly — TỰ ĐIỀN từ file audio upload (logic ở handleAudioChange). Không gõ tay. */}
              <input
                {...register("audioDuration", { valueAsNumber: true })}
                type="number"
                readOnly
                tabIndex={-1}
                className={`admin-input w-full bg-white ${errors.audioDuration ? "admin-input-error" : ""}`}
              />
              <p className="text-xs font-medium text-slate-400">
                {isReadingDuration
                  ? "Đang đọc thời lượng từ file audio..."
                  : `Định dạng: ${formatSeconds(typeof watchedDuration === "number" ? watchedDuration : 0)}`}
              </p>
              {errors.audioDuration ? <p className="text-xs font-medium text-rose-500">{errors.audioDuration.message}</p> : null}
            </div>
            </div>
          </section>
        </div>

        <div className="space-y-5 lg:w-1/2">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <UploadCloud className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">Upload media</h3>
                <p className="text-xs font-medium text-slate-400">
                  {contentType === "playlist" ? "Ảnh bìa và danh sách track." : "Ảnh bìa và file audio."}
                </p>
              </div>
            </div>

          {/* >>> BỐ CỤC UPLOAD MEDIA: lưới 2 cột — cột TRÁI = Audio, cột PHẢI = Thumbnail.
              'gap-5' = khoảng cách giữa 2 cột; đổi 'sm:grid-cols-2' -> 'sm:grid-cols-1' để xếp dọc. */}
          {contentType !== "playlist" ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div key="audio-upload" className="space-y-2.5">
              <label className="text-sm font-black uppercase tracking-wider text-slate-700">Audio</label>
              <input
                key="audio-file-input"
                type="file"
                accept="audio/*"
                onChange={handleAudioChange}
                className="admin-input w-full bg-white file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-700"
              />
              {/* >>> KÍCH THƯỚC PLAYER AUDIO PREVIEW: đổi className của <audio> (w-full = rộng hết cột). */}
              {audioPreview ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <audio controls src={audioPreview} className="w-full" />
                </div>
              ) : null}
              {audioError ? <p className="text-xs font-medium text-rose-500">{audioError}</p> : null}
              </div>
              {thumbnailBlock}
            </div>
          ) : (
            <div className="space-y-4">
              {/* >>> KÍCH THƯỚC THUMBNAIL (chế độ playlist): max-w-[260px] = bề rộng tối đa */}
              <div className="max-w-[260px]">{thumbnailBlock}</div>
              <div key="playlist-builder" className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
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
                    const selectedConfig = trackAccessConfig[track.id];
                    const effectiveAccessType = selectedConfig?.accessType || (track.accessType === "vip" ? "vip" : "free");
                    const isLocked = effectiveAccessType === "vip";

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
                        <span className="ml-3 shrink-0 text-[11px] font-black">
                          {isLocked ? <Lock className="mr-1 inline h-3.5 w-3.5 text-rose-500" /> : null}
                          {formatSeconds(track.audioDuration)}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-400">Không có track phù hợp.</p>
                )}
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
                Đã chọn <span className="font-black text-fuchsia-600">{selectedTracks.length}</span> track
                {selectedTracksWithAccess.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {selectedTracksWithAccess.map((item, index) => {
                      const locked = item.accessType === "vip";

                      return (
                        <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-500">#{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{item.title}</span>
                            {locked ? <Lock className="h-3.5 w-3.5 text-rose-500" /> : null}
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                            <select
                              value={item.accessType}
                              onChange={(event) => updateTrackAccessType(item.id, event.target.value === "vip" ? "vip" : "free")}
                              className="admin-input w-full bg-white"
                            >
                              <option value="free">Miễn phí</option>
                              <option value="vip">Khóa VIP</option>
                            </select>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatThousand(item.accessType === "vip" ? item.unlockPrice : 0)}
                              disabled={item.accessType !== "vip"}
                              onChange={(event) => updateTrackUnlockPrice(item.id, parseThousand(event.target.value))}
                              onFocus={(event) => event.target.select()}
                              className="admin-input w-full bg-white disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {playlistError ? <p className="text-xs font-medium text-rose-500">{playlistError}</p> : null}
              </div>
            </div>
          )}
          </section>

          {/* Section: Giá mở khóa (đã chuyển sang cột phải, cùng Upload media) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <BadgeDollarSign className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">Giá mở khóa</h3>
                <p className="text-xs font-medium text-slate-400">Chỉ áp dụng khi nội dung khóa VIP.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">Giá gốc (credits)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatThousand(typeof originalUnlockPrice === "number" ? originalUnlockPrice : 0)}
                  onChange={(e) =>
                    setValue("originalUnlockPrice", parseThousand(e.target.value), { shouldValidate: true, shouldDirty: true })
                  }
                  disabled={accessType !== "vip"}
                  onFocus={(e) => e.target.select()}
                  className={`admin-input w-full bg-white ${errors.originalUnlockPrice ? "admin-input-error" : ""}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">Giảm giá (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatThousand(typeof discountPercent === "number" ? discountPercent : 0)}
                  onChange={(e) =>
                    setValue("discountPercent", Math.min(99, parseThousand(e.target.value)), { shouldValidate: true, shouldDirty: true })
                  }
                  disabled={accessType !== "vip"}
                  onFocus={(e) => e.target.select()}
                  className={`admin-input w-full bg-white ${errors.discountPercent ? "admin-input-error" : ""}`}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Giá sau giảm</p>
                <p className="text-xs font-medium text-emerald-700/80">
                  {accessType === "vip"
                    ? "Dùng khi mở khóa từ client."
                    : "Miễn phí: giá tự động về 0."}
                </p>
              </div>
              <p className="shrink-0 text-xl font-black text-emerald-700">
                {accessType === "vip" ? Math.max(0, Math.floor(watchedUnlockPrice || 0)) : 0}
                <span className="ml-1 text-xs font-bold text-emerald-600/70">credits</span>
              </p>
            </div>

            {errors.originalUnlockPrice ? <p className="mt-2 text-xs font-medium text-rose-500">{errors.originalUnlockPrice.message}</p> : null}
            {errors.discountPercent ? <p className="mt-2 text-xs font-medium text-rose-500">{errors.discountPercent.message}</p> : null}
            {errors.unlockPrice ? <p className="mt-2 text-xs font-medium text-rose-500">{errors.unlockPrice.message}</p> : null}
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-white/85 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-7 lg:px-7">
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
          className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-600 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-fuchsia-200 transition hover:bg-fuchsia-700 active:scale-95 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu nhạc
        </button>
      </div>
    </form>
  );
}
