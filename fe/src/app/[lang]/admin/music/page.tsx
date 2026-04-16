"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Music2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import axios from "axios";

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import MusicForm, {
  type MusicFormInitialData,
  type MusicFormSubmitPayload,
} from "./_components/MusicForm";

type MusicItem = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  description: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  contentType: "single" | "playlist";
  playlistTrackIds: string[];
  playlistTracks?: Array<{
    id: string;
    title: string;
    artist: string;
    thumbnailUrl: string | null;
    audioDuration: number | null;
  }>;
  isPublic: boolean;
  createdAt: string;
};

type MusicTrackOption = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  audioDuration: number | null;
};

type MusicResponse = {
  data: MusicItem[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
};

const PAGE_SIZE = 12;

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const extractApiErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Lưu nhạc thất bại. Vui lòng thử lại.";
  }

  const status = error.response?.status;
  const data = error.response?.data;

  const formatPrimitive = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
  };

  const collectMessages = (value: unknown): string[] => {
    if (!value) return [];
    const primitive = formatPrimitive(value);
    if (primitive) return [primitive];
    if (Array.isArray(value)) {
      return value.flatMap((item) => collectMessages(item));
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const directMessages = [record.message, record.error, record.detail, record.details].flatMap((item) =>
        collectMessages(item),
      );

      const detailPairs = Object.entries(record)
        .filter(([key]) => !["message", "error", "detail", "details"].includes(key))
        .flatMap(([key, value]) => {
          if (value === null || value === undefined || value === "") return [];
          if (Array.isArray(value)) {
            return [`${key}: ${value.map((item) => String(item)).join(", ")}`];
          }
          if (typeof value === "object") {
            return [`${key}: ${JSON.stringify(value)}`];
          }
          return [`${key}: ${String(value)}`];
        });

      return [...directMessages, ...detailPairs].filter(Boolean);
    }
    return [];
  };

  const messages = collectMessages(data?.message)
    .concat(collectMessages(data?.error))
    .concat(collectMessages(data?.detail))
    .concat(collectMessages(data?.details));

  const uniqueMessages = Array.from(new Set(messages.map((item) => item.trim()).filter(Boolean)));

  if (uniqueMessages.length > 0) {
    return uniqueMessages.join("\n");
  }

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const fallbackDetails = Object.entries(record)
      .filter(([key]) => !["message", "error", "detail", "details", "statusCode"].includes(key))
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);

    if (fallbackDetails.length) {
      return fallbackDetails.join("\n");
    }
  }

  if (status) {
    return `Lỗi HTTP ${status}: ${error.message}`;
  }

  return error.message || "Lưu nhạc thất bại. Vui lòng thử lại.";
};

export default function AdminMusicPage() {
  const [items, setItems] = useState<MusicItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [trackOptions, setTrackOptions] = useState<MusicTrackOption[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMusic, setEditingMusic] = useState<MusicItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<MusicResponse>("/music/admin", {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });

      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      const normalizedRows: MusicItem[] = rows.map((row) => ({
        ...row,
        slug: typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : row.id,
        contentType: (row.contentType === "playlist" ? "playlist" : "single") as MusicItem["contentType"],
        playlistTrackIds: Array.isArray(row.playlistTrackIds) ? row.playlistTrackIds : [],
        tags: Array.isArray(row.tags) ? row.tags : [],
      }));

      setItems(normalizedRows);
      setTotal(response.data?.meta?.total || 0);
      setLastPage(Math.max(1, response.data?.meta?.lastPage || 1));
    } catch (error) {
      console.error("Failed to fetch music list:", error);
      setItems([]);
      setTotal(0);
      setLastPage(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;

    const loadTrackOptions = async () => {
      try {
        const response = await apiClient.get<MusicResponse>("/music/admin", {
          params: {
            page: 1,
            limit: 200,
            contentType: "single",
          },
        });

        if (cancelled) return;

        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        setTrackOptions(
          rows.map((item) => ({
            id: item.id,
            title: item.title,
            artist: item.artist,
            thumbnailUrl: item.thumbnailUrl,
            audioDuration: item.audioDuration,
          })),
        );
      } catch {
        if (cancelled) return;
        setTrackOptions([]);
      }
    };

    void loadTrackOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const openCreateModal = () => {
    setEditingMusic(null);
    setIsModalOpen(true);
  };

  const openEditModal = (row: MusicItem) => {
    setEditingMusic(row);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingMusic(null);
    setSubmitError(null);
  };

  const submitMusic = async (payload: MusicFormSubmitPayload) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("slug", payload.slug);
    formData.append("artist", payload.artist);
    formData.append("description", payload.description);
    formData.append("tags", payload.tags.join(","));
    formData.append("isPublic", String(payload.isPublic));
    formData.append("contentType", payload.contentType);

    if (payload.playlistTrackIds.length) {
      formData.append("playlistTrackIds", payload.playlistTrackIds.join(","));
    }

    if (typeof payload.audioDuration === "number") {
      formData.append("audioDuration", String(payload.audioDuration));
    }

    if (payload.audioFile) {
      formData.append("audioFile", payload.audioFile);
    }

    if (payload.thumbnailFile) {
      formData.append("thumbnailFile", payload.thumbnailFile);
    }

    if (payload.clearThumbnail) {
      formData.append("thumbnailUrl", "");
    }

    try {
      if (editingMusic) {
        await apiClient.patch(`/music/${editingMusic.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await apiClient.post("/music", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      closeModal();
      await loadData();
      if (!editingMusic) {
        const nextResponse = await apiClient.get<MusicResponse>("/music/admin", {
          params: {
            page: 1,
            limit: 200,
            contentType: "single",
          },
        });

        const rows = Array.isArray(nextResponse.data?.data) ? nextResponse.data.data : [];
        setTrackOptions(
          rows.map((item) => ({
            id: item.id,
            title: item.title,
            artist: item.artist,
            thumbnailUrl: item.thumbnailUrl,
            audioDuration: item.audioDuration,
          })),
        );
      }
    } catch (error) {
      console.error("Failed to save music:", error);
      setSubmitError(extractApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMusic = async (row: MusicItem) => {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa bài nhạc \"${row.title}\"?`);
    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      await apiClient.delete(`/music/${row.id}`);
      await loadData();
      setTrackOptions((prev) => prev.filter((item) => item.id !== row.id));
    } catch (error) {
      console.error("Failed to delete music:", error);
      alert("Xóa nhạc thất bại. Vui lòng thử lại.");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = useMemo(() => Math.max(1, lastPage), [lastPage]);

  const initialFormData: MusicFormInitialData | undefined = editingMusic
    ? {
        id: editingMusic.id,
        slug: editingMusic.slug,
        title: editingMusic.title,
        artist: editingMusic.artist,
        description: editingMusic.description,
        tags: Array.isArray(editingMusic.tags) ? editingMusic.tags : [],
        thumbnailUrl: editingMusic.thumbnailUrl,
        audioUrl: editingMusic.audioUrl,
        audioDuration: editingMusic.audioDuration,
        isPublic: editingMusic.isPublic,
        contentType: editingMusic.contentType,
        playlistTrackIds: editingMusic.playlistTrackIds,
      }
    : undefined;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-600 shadow-lg shadow-fuchsia-200">
              <Music2 className="h-6 w-6 text-white" />
            </span>
            Quản lý Nhạc Không Lời
          </h1>
          <p className="mt-2 font-medium text-slate-500">Danh sách nhạc dùng chung toàn hệ thống, không theo ngôn ngữ.</p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-600 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-fuchsia-100 transition hover:bg-fuchsia-700"
        >
          <Plus className="h-4 w-4" />
          Thêm nhạc
        </button>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Tìm theo tiêu đề hoặc tác giả..."
            className="admin-input w-full bg-slate-50 pl-12"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Ảnh cover</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Tiêu đề</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Tác giả</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Loại</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Thời lượng</th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-fuchsia-600" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có bản nhạc nào.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {row.thumbnailUrl ? (
                          <Image
                            src={row.thumbnailUrl}
                            alt={row.title}
                            width={112}
                            height={112}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <Music2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.title}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{row.artist}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                          row.contentType === "playlist" ? "bg-pink-100 text-pink-700" : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {row.contentType === "playlist" ? `Playlist (${row.playlistTrackIds.length})` : "Single"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{formatDuration(row.audioDuration)}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                          row.isPublic ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {row.isPublic ? "Public" : "Private"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                        <button
                          onClick={() => void deleteMusic(row)}
                          disabled={deletingId === row.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row">
          <p className="text-sm font-medium text-slate-500">
            Hiển thị <span className="font-black text-slate-700">{items.length}</span> / {" "}
            <span className="font-black text-slate-700">{total}</span> bản nhạc
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Trước
            </button>
            <span className="px-2 text-xs font-black text-slate-600">
              {page}/{totalPages}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Tiếp
            </button>
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[36px]">
            <div className="flex items-center justify-between border-b border-slate-100 px-7 py-5">
              <h2 className="text-2xl font-black text-slate-900">
                {editingMusic ? "Chỉnh sửa nhạc" : "Thêm bản nhạc mới"}
              </h2>
              <button
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
              <MusicForm
                initialData={initialFormData}
                availableTracks={trackOptions}
                onSubmit={submitMusic}
                onCancel={closeModal}
                isLoading={isSubmitting}
                submitError={submitError}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
