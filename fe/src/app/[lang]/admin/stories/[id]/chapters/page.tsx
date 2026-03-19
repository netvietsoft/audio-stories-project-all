"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Loader2, 
  Plus,
  Music,
  Pencil,
  Trash2,
  Clock,
  Search,
  X,
  Layers,
  Star
} from "lucide-react";

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import { ChapterForm, type ChapterSubmitPayload } from "./_components/ChapterForm";

interface Chapter {
  id: string;
  chapterNumber: number;
  title: string;
  description?: string | null;
  content?: string | null;
  r2AudioUrl?: string | null;
  thumbnailUrl?: string | null;
  youtubeVideoId?: string | null;
  audioDuration?: number | null;
  accessType?: 'free' | 'timed' | 'vip';
  language?: string | null;
  createdAt: string;
  storyId?: string | null;
  variants?: Variant[];
  _count?: {
    variants: number;
  };
}

interface Variant {
  id: string;
  title: string;
  description?: string;
  content?: string;
  audioUrl?: string;
  r2AudioUrl?: string;
  audioDuration?: number;
  unlockPrice: number;
  orderIndex: number;
  nextChapterId?: string | null;
  nextVariantId?: string | null;
  isDefault?: boolean;
}

type VariantUpdatePayload = {
  title?: string;
  unlockPrice?: number;
  orderIndex?: number;
  r2AudioUrl?: string;
  content?: string;
  nextChapterId?: string | null;
  nextVariantId?: string | null;
};

export default function StoryChaptersPage() {
  const router = useRouter();
  const params = useParams<{ id: string; lang?: string }>();
  const storyId = params?.id;
  const currentLang = params?.lang === "en" ? "en" : "vi";

  const [isLoading, setIsLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  const [storyLanguage, setStoryLanguage] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [unassignedChapters, setUnassignedChapters] = useState<Chapter[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [isUpdatingChapter, setIsUpdatingChapter] = useState(false);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [selectedChapterForVariants, setSelectedChapterForVariants] = useState<Chapter | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isFetchingVariants, setIsFetchingVariants] = useState(false);
  const [isEditingVariantModalOpen, setIsEditingVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [branchVariants, setBranchVariants] = useState<Variant[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    if (storyId) {
      router.push(`/${currentLang}/admin/stories/${storyId}`);
      return;
    }

    router.push(`/${currentLang}/admin/stories`);
  };

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
      setStoryLanguage(storyRes.data.language || null);
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
          lang: storyLanguage,
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

  const fetchVariants = async (chapterId: string) => {
    setIsFetchingVariants(true);
    try {
      const res = await apiClient.get(`/chapters/${chapterId}/variants`);
      setVariants(res.data);
    } catch (error) {
      console.error("Failed to fetch variants:", error);
    } finally {
      setIsFetchingVariants(false);
    }
  };

  useEffect(() => {
    if (isVariantsModalOpen && selectedChapterForVariants) {
      fetchVariants(selectedChapterForVariants.id);
    }
  }, [isVariantsModalOpen, selectedChapterForVariants]);

  const updateChapterVariantCount = (chapterId: string, delta: number) => {
    setChapters(prev =>
      prev.map(chapter => {
        if (chapter.id !== chapterId) return chapter;
        const currentCount = chapter._count?.variants ?? chapter.variants?.length ?? 0;
        return {
          ...chapter,
          _count: {
            variants: Math.max(0, currentCount + delta),
          },
        };
      })
    );

    setSelectedChapterForVariants(prev => {
      if (!prev || prev.id !== chapterId) return prev;
      const currentCount = prev._count?.variants ?? prev.variants?.length ?? 0;
      return {
        ...prev,
        _count: {
          variants: Math.max(0, currentCount + delta),
        },
      };
    });
  };

  const handleCreateVariant = async () => {
    if (!selectedChapterForVariants) return;
    const title = prompt("Nhập tiêu đề biến thể mới:");
    if (!title) return;

    try {
      const chapterId = selectedChapterForVariants.id;
      await apiClient.post('/chapter-variants', {
        chapterId,
        title,
        orderIndex: variants.length,
        nextChapterId: null,
      });
      updateChapterVariantCount(chapterId, 1);
      await Promise.all([fetchVariants(chapterId), fetchData()]);
    } catch (error) {
      console.error("Failed to create variant:", error);
      alert("Không thể tạo biến thể.");
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm("Xóa biến thể này?")) return;
    try {
      const chapterId = selectedChapterForVariants?.id;
      await apiClient.delete(`/chapter-variants/${variantId}`);
      if (chapterId) {
        updateChapterVariantCount(chapterId, -1);
        await Promise.all([fetchVariants(chapterId), fetchData()]);
      } else {
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to delete variant:", error);
    }
  };

  const handleUpdateVariant = async (data: VariantUpdatePayload) => {
    if (!editingVariant) return;
    try {
      const res = await apiClient.patch(`/chapter-variants/${editingVariant.id}`, data);
      setVariants(variants.map(v => v.id === editingVariant.id ? res.data : v));
      setIsEditingVariantModalOpen(false);
      setEditingVariant(null);
    } catch (error) {
      console.error("Failed to update variant:", error);
      alert("Không thể cập nhật biến thể.");
    }
  };

  const handleUpdateChapter = async (data: ChapterSubmitPayload) => {
    if (!editingChapter) return;
    
    setIsUpdatingChapter(true);
    try {
      const payload: ChapterSubmitPayload = {
        ...data,
        thumbnailUrl: data.thumbnailUrl || undefined,
        youtubeVideoId: data.youtubeVideoId || undefined,
        r2AudioUrl: data.r2AudioUrl || undefined,
        storyId: data.storyId || undefined,
        language: storyLanguage || data.language || undefined,
      };
      await apiClient.patch(`/chapters/${editingChapter.id}`, payload);
      await fetchData();
      setIsEditModalOpen(false);
      setEditingChapter(null);
    } catch (error) {
      console.error("Failed to update chapter:", error);
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error
          ? (
              error as {
                response?: { data?: { message?: string | string[] } };
              }
            ).response?.data?.message
          : undefined;
      const detail = Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage;
      alert(detail ? "Không thể cập nhật chương: " + detail : "Không thể cập nhật chương. Vui lòng thử lại.");
    } finally {
      setIsUpdatingChapter(false);
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
              <button
                type="button"
                onClick={handleGoBack}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
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
                      onClick={() => {
                        setSelectedChapterForVariants(chapter);
                        setIsVariantsModalOpen(true);
                      }}
                      className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors flex items-center gap-2"
                      title="Quản lý biến thể"
                    >
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-bold">{chapter._count?.variants || 0}</span>
                    </button>
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
          <div className="bg-white rounded-[32px] max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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

            <div className="p-8">
              <ChapterForm
                initialData={editingChapter ? {
                  chapterNumber: editingChapter.chapterNumber,
                  titleVi: editingChapter.title,
                  titleEn: editingChapter.title,
                  thumbnailUrl: editingChapter.thumbnailUrl ?? undefined,
                  descriptionVi: editingChapter.description ?? undefined,
                  descriptionEn: editingChapter.description ?? undefined,
                  contentVi: editingChapter.content ?? undefined,
                  contentEn: editingChapter.content ?? undefined,
                  r2AudioUrl: editingChapter.r2AudioUrl ?? undefined,
                  audioUrlVi: editingChapter.r2AudioUrl ?? undefined,
                  audioUrlEn: editingChapter.r2AudioUrl ?? undefined,
                  youtubeVideoId: editingChapter.youtubeVideoId ?? undefined,
                  audioDuration: editingChapter.audioDuration ?? undefined,
                  accessType: editingChapter.accessType ?? 'free',
                  storyId: editingChapter.storyId ?? undefined,
                } : undefined}
                selectedLocale={storyLanguage === 'en' ? 'en' : 'vi'}
                onSubmit={handleUpdateChapter}
                onCancel={() => {
                  setIsEditModalOpen(false);
                  setEditingChapter(null);
                }}
                isLoading={isUpdatingChapter}
              />
            </div>
          </div>
        </div>
      )}
      {/* Variants Modal */}
      {isVariantsModalOpen && selectedChapterForVariants && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-slate-200 px-8 py-6 rounded-t-[32px]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Quản lý Biến thể</h2>
                  <p className="text-sm text-slate-500">Chương {selectedChapterForVariants.chapterNumber}: {selectedChapterForVariants.title}</p>
                </div>
                <button
                  onClick={() => {
                    setIsVariantsModalOpen(false);
                    setSelectedChapterForVariants(null);
                    setVariants([]);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Danh sách biến thể</h3>
                <button
                  onClick={handleCreateVariant}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Thêm biến thể
                </button>
              </div>

              {isFetchingVariants ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : variants.length > 0 ? (
                <div className="space-y-4">
                  {variants.map((variant) => (
                    <div key={variant.id} className="p-5 border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-between group">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900">{variant.title}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(variant.audioDuration)}
                          </span>
                          <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                            {variant.unlockPrice} Credits
                          </span>
                          {variant.isDefault && (
                            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                              ★ Mặc định
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={async () => {
                            try {
                              await apiClient.patch(`/chapter-variants/${variant.id}`, { isDefault: !variant.isDefault });
                              if (!variant.isDefault) {
                                setVariants(prev => prev.map(v => ({ ...v, isDefault: v.id === variant.id })));
                              } else {
                                setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, isDefault: false } : v));
                              }
                            } catch (e) { console.error(e); }
                          }}
                          className={`p-2 rounded-lg transition-colors border border-transparent hover:border-slate-200 ${
                            variant.isDefault 
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                              : 'hover:bg-white text-slate-400 hover:text-emerald-600'
                          }`}
                          title={variant.isDefault ? 'Bỏ mặc định' : 'Đặt làm mặc định'}
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            setEditingVariant(variant);
                            setIsEditingVariantModalOpen(true);
                            setBranchVariants([]);
                            if (variant.nextChapterId) {
                              try {
                                const res = await apiClient.get(`/chapters/${variant.nextChapterId}/variants`);
                                setBranchVariants(res.data || []);
                              } catch (err) { console.error(err); }
                            }
                          }}
                          className="p-2 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                          title="Chỉnh sửa chi tiết"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteVariant(variant.id)}
                          className="p-2 hover:bg-white text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl">
                  <p className="text-slate-500">Chưa có biến thể nào cho chương này.</p>
                </div>
              )}
            </div>
            
            <div className="p-8 border-t border-slate-200 bg-slate-50/50 rounded-b-[32px]">
              <p className="text-xs text-slate-500 text-center italic">Tip: M?i bi?n th? c� th? c� n?i dung v� �m thanh ri�ng bi?t d? t?o ra c�c di?n bi?n kh�c nhau.</p>
            </div>
          </div>
        </div>
      )}
      {/* Edit Variant Modal */}
      {isEditingVariantModalOpen && editingVariant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[40px] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 py-8 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Chi tiết Biến thể</h2>
                  <p className="text-slate-500 font-medium text-sm mt-1">{editingVariant.title}</p>
                </div>
                <button
                  onClick={() => {
                    setIsEditingVariantModalOpen(false);
                    setEditingVariant(null);
                  }}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-all active:scale-90"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề biến thể</label>
                <input
                  type="text"
                  defaultValue={editingVariant.title}
                  onChange={(e) => setEditingVariant({ ...editingVariant, title: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-6 text-base font-bold text-slate-900 focus:border-indigo-500/20 focus:bg-white transition-all outline-none"
                  placeholder="Ví dụ: Cái kết khác cho chương 1..."
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Giá mở khóa (Credits)</label>
                  <input
                    type="number"
                    defaultValue={editingVariant.unlockPrice}
                    onChange={(e) => setEditingVariant({ ...editingVariant, unlockPrice: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-6 text-base font-bold text-slate-900 focus:border-indigo-500/20 focus:bg-white transition-all outline-none"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    defaultValue={editingVariant.orderIndex}
                    onChange={(e) => setEditingVariant({ ...editingVariant, orderIndex: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-6 text-base font-bold text-slate-900 focus:border-indigo-500/20 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Audio URL (S3/R2)</label>
                <div className="relative group">
                  <Music className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    defaultValue={editingVariant.r2AudioUrl || editingVariant.audioUrl || ''}
                    onChange={(e) => setEditingVariant({ ...editingVariant, r2AudioUrl: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-slate-900 focus:border-indigo-500/20 focus:bg-white transition-all outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung / Kịch bản</label>
                <textarea
                  defaultValue={editingVariant.content || ''}
                  onChange={(e) => setEditingVariant({ ...editingVariant, content: e.target.value })}
                  rows={8}
                  className="w-full bg-slate-50 border-2 border-transparent rounded-[32px] py-6 px-8 text-base font-medium text-slate-700 focus:border-indigo-500/20 focus:bg-white transition-all outline-none resize-none leading-relaxed"
                  placeholder="Nhập nội dung khác biệt của biến thể này..."
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Chapter tiếp theo (Branching)</label>
                <select
                  value={editingVariant.nextChapterId || ''}
                  onChange={async (e) => {
                    const chId = e.target.value || null;
                    setEditingVariant({ ...editingVariant, nextChapterId: chId, nextVariantId: null });
                    setBranchVariants([]);
                    if (chId) {
                      try {
                        const res = await apiClient.get(`/chapters/${chId}/variants`);
                        setBranchVariants(res.data || []);
                      } catch (err) { console.error(err); }
                    }
                  }}
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-6 text-base font-bold text-slate-900 focus:border-indigo-500/20 focus:bg-white transition-all outline-none"
                >
                  <option value="">Theo thứ tự thường (mặc định)</option>
                  {chapters.filter(c => c.id !== selectedChapterForVariants?.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      Chương {c.chapterNumber}: {c.title}
                    </option>
                  ))}
                </select>

                {editingVariant.nextChapterId && branchVariants.length > 0 && (
                  <>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mt-3 block">Diễn biến cụ thể (tùy chọn)</label>
                    <select
                      value={editingVariant.nextVariantId || ''}
                      onChange={(e) => setEditingVariant({ ...editingVariant, nextVariantId: e.target.value || null })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-6 text-base font-bold text-slate-900 focus:border-indigo-500/20 focus:bg-white transition-all outline-none"
                    >
                      <option value="">Diễn biến mặc định của chương</option>
                      {branchVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} ({v.unlockPrice} credits)
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <p className="text-xs text-slate-400 ml-1">Chọn chapter và diễn biến mà user sẽ chuyển đến sau khi chọn diễn biến này</p>
              </div>

              <div className="flex items-center gap-4 pt-4 pb-2">
                <button
                  onClick={() => {
                    setIsEditingVariantModalOpen(false);
                    setEditingVariant(null);
                  }}
                  className="flex-1 px-8 py-5 text-sm font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => handleUpdateVariant({
                    title: editingVariant.title,
                    unlockPrice: editingVariant.unlockPrice,
                    orderIndex: editingVariant.orderIndex,
                    r2AudioUrl: editingVariant.r2AudioUrl,
                    content: editingVariant.content,
                    nextChapterId: editingVariant.nextChapterId || null,
                    nextVariantId: editingVariant.nextVariantId || null,
                  })}
                  className="flex-[2] px-8 py-5 bg-indigo-600 text-white rounded-[24px] text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-xl shadow-indigo-100"
                >
                  Cập nhật ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

