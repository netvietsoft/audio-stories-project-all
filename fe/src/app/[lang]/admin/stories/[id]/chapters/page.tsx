"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "@/components/shared/LocalizedLink";
import { 
  ChevronLeft, 
  Loader2, 
  Plus,
  Music,
  Pencil,
  Trash2,
  Clock,
  Search,
  X
} from "lucide-react";

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";

interface Chapter {
  id: string;
  chapterNumber: number;
  title: string;
  description?: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: string;
  storyId?: string;
}

export default function StoryChaptersPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storyId = params?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [unassignedChapters, setUnassignedChapters] = useState<Chapter[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storyId) return;
    fetchData();
  }, [storyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length > 0) {
      searchUnassignedChapters();
    } else {
      setUnassignedChapters([]);
    }
  }, [searchQuery]);

  const fetchData = async () => {
    try {
      const [storyRes, chaptersRes] = await Promise.all([
        apiClient.get(`/stories/admin/${storyId}`),
        apiClient.get(`/stories/${storyId}/chapters`),
      ]);
      
      setStoryTitle(storyRes.data.title);
      setChapters(chaptersRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchUnassignedChapters = async () => {
    setIsSearching(true);
    try {
      const res = await apiClient.get('/chapters', {
        params: {
          storyId: 'null',
          search: searchQuery,
          limit: 20,
        }
      });
      setUnassignedChapters(res.data.data || []);
    } catch (error) {
      console.error("Failed to search chapters:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const assignChapterToStory = async (chapterId: string) => {
    try {
      await apiClient.patch(`/chapters/${chapterId}`, {
        storyId: storyId,
      });
      
      // Refresh chapters list
      await fetchData();
      
      // Clear search
      setSearchQuery("");
      setUnassignedChapters([]);
      setIsSearchOpen(false);
    } catch (error) {
      console.error("Failed to assign chapter:", error);
      alert("Không thể gắn chương vào truyện. Vui lòng thử lại.");
    }
  };

  const handleUnassign = async (chapterId: string) => {
    if (!confirm("Bạn có chắc muốn bỏ gán chương này khỏi truyện?")) return;
    
    try {
      await apiClient.patch(`/chapters/${chapterId}`, {
        storyId: null,
      });
      setChapters(chapters.filter(c => c.id !== chapterId));
    } catch (error) {
      console.error("Failed to unassign chapter:", error);
      alert("Không thể bỏ gán chương. Vui lòng thử lại.");
    }
  };

  const handleEdit = (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    setEditingChapter(chapter);
    setIsEditModalOpen(true);
  };

  const handleUpdateChapter = async (data: Partial<Chapter>) => {
    if (!editingChapter) return;
    
    try {
      await apiClient.patch(`/chapters/${editingChapter.id}`, data);
      
      // Update local state
      setChapters(chapters.map(c => 
        c.id === editingChapter.id ? { ...c, ...data } : c
      ));
      
      setIsEditModalOpen(false);
      setEditingChapter(null);
    } catch (error) {
      console.error("Failed to update chapter:", error);
      alert("Không thể cập nhật chương. Vui lòng thử lại.");
    }
  };

  const handleDelete = async (chapterId: string) => {
    if (!confirm("Bạn có chắc muốn xóa chương này?")) return;
    
    try {
      await apiClient.delete(`/chapters/${chapterId}`);
      setChapters(chapters.filter(c => c.id !== chapterId));
    } catch (error) {
      console.error("Failed to delete chapter:", error);
      alert("Không thể xóa chương. Vui lòng thử lại.");
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="top-0">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/admin/stories/${storyId}`}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-black text-black">Quay lại</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters List */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Search Box */}
        <div className="mb-6 relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm chương chưa gắn truyện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-12 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setUnassignedChapters([]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchQuery && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-20">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
              ) : unassignedChapters.length > 0 ? (
                <div className="max-h-80 overflow-y-auto">
                  {unassignedChapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => assignChapterToStory(chapter.id)}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                          <Music className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {chapter.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            Chương {chapter.chapterNumber}
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4">
                  <p className="text-sm text-slate-500">Không tìm thấy chương nào</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden">
          {chapters.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex items-center gap-6 p-6 hover:bg-slate-50 transition-colors group"
                >
                  {/* Chapter Icon */}
                  <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Music className="w-6 h-6 text-indigo-600" />
                  </div>

                  {/* Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                        Chương {chapter.chapterNumber}
                      </span>
                      {chapter.audioDuration && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {formatDuration(chapter.audioDuration)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {chapter.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(chapter.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(chapter.id)}
                      className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUnassign(chapter.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      title="Bỏ gán"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4">
                <Music className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Chưa có chương nào</h3>
              <p className="text-sm text-slate-500">
                Sử dụng ô tìm kiếm ở trên để gắn chương vào truyện
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingChapter && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 rounded-t-[32px]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Chỉnh sửa Chương</h2>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingChapter(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Số chương</label>
                <input
                  type="number"
                  defaultValue={editingChapter.chapterNumber}
                  onChange={(e) => setEditingChapter({ ...editingChapter, chapterNumber: parseInt(e.target.value) })}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Tiêu đề</label>
                <input
                  type="text"
                  defaultValue={editingChapter.title}
                  onChange={(e) => setEditingChapter({ ...editingChapter, title: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Mô tả</label>
                <textarea
                  defaultValue={editingChapter.description || ''}
                  onChange={(e) => setEditingChapter({ ...editingChapter, description: e.target.value })}
                  rows={4}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingChapter(null);
                  }}
                  className="flex-1 px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleUpdateChapter({
                    chapterNumber: editingChapter.chapterNumber,
                    title: editingChapter.title,
                    description: editingChapter.description,
                  })}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
