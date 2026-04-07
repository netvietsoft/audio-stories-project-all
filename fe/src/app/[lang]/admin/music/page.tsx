"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Music2, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import MusicForm, {
  type MusicFormInitialData,
  type MusicFormSubmitPayload,
} from "./_components/MusicForm";

type MusicItem = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  isPublic: boolean;
  createdAt: string;
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

export default function AdminMusicPage() {
  const [items, setItems] = useState<MusicItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMusic, setEditingMusic] = useState<MusicItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setItems(rows);
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
  };

  const submitMusic = async (payload: MusicFormSubmitPayload) => {
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("artist", payload.artist);
    formData.append("isPublic", String(payload.isPublic));

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
    } catch (error) {
      console.error("Failed to save music:", error);
      alert("Lưu nhạc thất bại. Vui lòng thử lại.");
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
        title: editingMusic.title,
        artist: editingMusic.artist,
        thumbnailUrl: editingMusic.thumbnailUrl,
        audioUrl: editingMusic.audioUrl,
        audioDuration: editingMusic.audioDuration,
        isPublic: editingMusic.isPublic,
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
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Thời lượng</th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-fuchsia-600" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[36px] bg-white shadow-2xl">
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

            <div className="p-7">
              <MusicForm
                initialData={initialFormData}
                onSubmit={submitMusic}
                onCancel={closeModal}
                isLoading={isSubmitting}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
