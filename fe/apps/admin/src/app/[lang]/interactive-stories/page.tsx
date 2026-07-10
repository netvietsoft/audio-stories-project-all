"use client";
import { useTranslations } from "next-intl";
import { formatChapterTitle, cleanChapterTitle } from "@/lib/formatChapterTitle";
import React, { useState, useEffect } from "react";
import Link from "@/components/shared/LocalizedLink";
import {
  Zap,
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Layers,
  GitBranch,
  ArrowRight,
  Eye,
  Plus,
  Pencil,
  Star,
  Clock,
  Music,
  X,
  ChevronLeft,
  Loader2,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import { unwrapList, unwrapData } from '@/lib/api/unwrap';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import { ChapterForm, type ChapterSubmitPayload } from "../stories/[id]/chapters/_components/ChapterForm";
import { VariantForm } from "../stories/[id]/chapters/_components/VariantForm";
import { StoryForm } from "../stories/_components/StoryForm";
import type { Variant, StorySubmitPayload } from "@/types/admin";

interface VariantInfo {
  id: string;
  title: string;
  unlockPrice: number;
  audioDuration?: number;
  isDefault?: boolean;
  nextChapterId?: string | null;
  nextVariantId?: string | null;
}

interface ChapterInfo {
  id: string;
  title: string;
  chapterNumber: number;
  storyId: string;
  _count?: { variants: number };
  variants: VariantInfo[];
}

interface StoryInfo {
  id: string;
  title: string;
  titleVi?: string;
  titleEn?: string;
  slug: string;
  thumbnailUrl: string | null;
  status: string;
  totalViews: number;
  author: { id: string; name: string };
  _count: { chapters: number };
}

const formatDuration = (seconds?: number) => {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export default function InteractiveStoriesPage() {
  const tChapter = useTranslations("StoryChapterClient");
  const router = useRouter();
  const [stories, setStories] = useState<StoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [storyChapters, setStoryChapters] = useState<Record<string, ChapterInfo[]>>({});
  const [loadingChapters, setLoadingChapters] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const params = useParams<{ lang?: string }>();
  const urlLang = params?.lang === 'en' ? 'en' : 'vi';
  const [selectedLocale, setSelectedLocale] = useState(urlLang);
  const { languages } = useAdminLanguages();

  // Modal States
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterData, setEditingChapterData] = useState<ChapterInfo | null>(null);
  const [fullChapterData, setFullChapterData] = useState<any | null>(null);
  const [isFetchingChapterData, setIsFetchingChapterData] = useState(false);
  const [isSubmittingChapter, setIsSubmittingChapter] = useState(false);

  const [variantsModalOpen, setVariantsModalOpen] = useState(false);
  const [selectedChapterForVariants, setSelectedChapterForVariants] = useState<ChapterInfo | null>(null);
  const [selectedParentVariant, setSelectedParentVariant] = useState<Variant | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isFetchingVariants, setIsFetchingVariants] = useState(false);

  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [newVariantTitle, setNewVariantTitle] = useState("");
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantData, setEditingVariantData] = useState<any | null>(null);
  const [isFetchingVariantData, setIsFetchingVariantData] = useState(false);
  const [isSubmittingVariant, setIsSubmittingVariant] = useState(false);

  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [storyIdForNewChapter, setStoryIdForNewChapter] = useState<string | null>(null);
  const [isSubmittingNewChapter, setIsSubmittingNewChapter] = useState(false);

  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editingStoryData, setEditingStoryData] = useState<any | null>(null);
  const [isFetchingStoryData, setIsFetchingStoryData] = useState(false);
  const [isSubmittingStory, setIsSubmittingStory] = useState(false);

  useEffect(() => {
    if (!languages.some((language) => language.key === selectedLocale)) {
      setSelectedLocale(languages[0]?.key || 'vi');
    }
  }, [languages, selectedLocale]);

  useEffect(() => {
    fetchStories();
  }, [selectedLocale]);

  const fetchStories = async () => {
    setIsLoading(true);
    try {
      // Fetch stories that are explicitly marked as interactive on BE
      const res = await apiClient.get(`/stories/admin?limit=100&isInteractive=true&lang=${selectedLocale}`);
      setStories(unwrapList<StoryInfo>(res.data));
    } catch (error) {
      console.error("Failed to fetch stories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!confirm(`Bạn có chắc muốn xóa truyện "${storyTitle}"? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await apiClient.delete(`/stories/${storyId}`);
      setStories((prev) => prev.filter((s) => s.id !== storyId));
    } catch (error) {
      console.error("Failed to delete story:", error);
      alert("Không thể xóa truyện. Vui lòng thử lại.");
    }
  };

  const handleEditStory = async (story: StoryInfo) => {
    setEditingStoryId(story.id);
    setIsFetchingStoryData(true);
    try {
      const res = await apiClient.get(`/stories/admin/${story.id}`);
      const data = unwrapData<any>(res.data) ?? {};

      // Extensive mapping to match StoryForm requirements
      const mappedData = {
        ...data,
        titleVi: data.titleVi || data.title || "",
        titleEn: data.titleEn || "",
        slug: data.slug || "",
        descriptionVi: data.descriptionVi || data.description || "",
        descriptionEn: data.descriptionEn || "",
        categoryIds: (data.categories || []).map((item: any) => 
          item.category?.id || item.categoryId || (typeof item === 'number' ? item : item.id)
        ).filter(Boolean),
        authorId: data.author?.id || data.authorId,
        status: data.status || "ongoing",
        isInteractive: !!data.isInteractive,
        isRecommended: !!data.isRecommended,
      };
      
      setEditingStoryData(mappedData);
    } catch (error) {
      console.error("Failed to fetch story details:", error);
      alert("Không thể tải thông tin truyện.");
      setEditingStoryId(null);
    } finally {
      setIsFetchingStoryData(false);
    }
  };

  const handleStorySubmit = async (data: StorySubmitPayload) => {
    if (!editingStoryId) return;
    setIsSubmittingStory(true);
    try {
      await apiClient.patch(`/stories/${editingStoryId}`, data);
      setEditingStoryId(null);
      setEditingStoryData(null);
      await fetchStories();
    } catch (error) {
      console.error("Failed to update story:", error);
      alert("Không thể cập nhật truyện.");
    } finally {
      setIsSubmittingStory(false);
    }
  };

  const handleEditChapter = async (chapter: ChapterInfo) => {
    setEditingChapterData(chapter);
    setEditingChapterId(chapter.id);
    setIsFetchingChapterData(true);
    setFullChapterData(null);
    try {
      const res = await apiClient.get(`/chapters/${chapter.id}`);
      setFullChapterData(unwrapData(res.data));
    } catch (error) {
      console.error("Failed to fetch chapter details:", error);
      alert("Không thể tải thông tin chương. Vui lòng thử lại.");
      setEditingChapterId(null);
    } finally {
      setIsFetchingChapterData(false);
    }
  };

  const handleChapterSubmit = async (data: ChapterSubmitPayload) => {
    if (!editingChapterId || !editingChapterData) return;
    setIsSubmittingChapter(true);
    
    try {
      const payload = {
        ...data,
        thumbnailUrl: data.thumbnailUrl || undefined,
        youtubeVideoId: data.youtubeVideoId || undefined,
        r2AudioUrl: data.r2AudioUrl || undefined,
        storyId: data.storyId || undefined,
      };

      await apiClient.patch(`/chapters/${editingChapterId}`, payload);
      
      // Update local state
      const updatedTitle = payload.title || editingChapterData.title;
      setStoryChapters((prev) => ({
        ...prev,
        [editingChapterData.storyId]: (prev[editingChapterData.storyId] || []).map(ch => 
          ch.id === editingChapterId 
            ? { ...ch, title: updatedTitle } // Optimistic partial update
            : ch
        ),
      }));
      
      setEditingChapterId(null);
      setEditingChapterData(null);
    } catch (error) {
      console.error("Failed to save chapter:", error);
      alert("Không thể lưu chương. Vui lòng thử lại.");
    } finally {
      setIsSubmittingChapter(false);
    }
  };

  const fetchVariants = async (chapterId: string, parentId?: string | null) => {
    setIsFetchingVariants(true);
    try {
      const res = await apiClient.get(`/chapters/${chapterId}/variants`, {
        params: { parentId: parentId === null ? 'null' : parentId }
      });
      setVariants(unwrapList<Variant>(res.data));
    } catch (error) {
      console.error("Failed to fetch variants:", error);
    } finally {
      setIsFetchingVariants(false);
    }
  };

  useEffect(() => {
    if (variantsModalOpen && selectedChapterForVariants) {
      fetchVariants(selectedChapterForVariants.id, selectedParentVariant?.id || null);
    }
  }, [variantsModalOpen, selectedChapterForVariants, selectedParentVariant]);

  const updateChapterVariantCount = (storyId: string, chapterId: string, delta: number) => {
    setStoryChapters(prev => ({
      ...prev,
      [storyId]: (prev[storyId] || []).map(ch => {
        if (ch.id !== chapterId) return ch;
        const currentCount = ch._count?.variants ?? ch.variants?.length ?? 0;
        return {
          ...ch,
          _count: {
            ...ch._count,
            variants: Math.max(0, currentCount + delta)
          }
        };
      })
    }));

    setSelectedChapterForVariants(prev => {
      if (!prev || prev.id !== chapterId) return prev;
      const currentCount = prev._count?.variants ?? prev.variants?.length ?? 0;
      return {
        ...prev,
        _count: {
          ...prev._count,
          variants: Math.max(0, currentCount + delta)
        }
      };
    });
  };

  const handleCreateVariant = async () => {
    if (!selectedChapterForVariants || !newVariantTitle.trim()) return;
    setIsCreatingVariant(true);

    try {
      const chapterId = selectedChapterForVariants.id;
      await apiClient.post('/chapter-variants', {
        chapterId,
        parentId: selectedParentVariant?.id || null,
        title: newVariantTitle.trim(),
        orderIndex: variants.length,
        nextChapterId: null,
      });
      updateChapterVariantCount(selectedChapterForVariants.storyId, chapterId, 1);
      await fetchVariants(chapterId, selectedParentVariant?.id || null);
      setIsAddingVariant(false);
      setNewVariantTitle("");
    } catch (error) {
      console.error("Failed to create variant:", error);
      alert("Không thể tạo biến thể.");
    } finally {
      setIsCreatingVariant(false);
    }
  };

  const handleEditVariant = async (variant: Variant) => {
    setEditingVariantId(variant.id);
    setIsFetchingVariantData(true);
    setEditingVariantData(null);
    try {
      const res = await apiClient.get(`/chapter-variants/${variant.id}`);
      setEditingVariantData(unwrapData(res.data));
    } catch (error) {
      console.error("Failed to fetch variant details:", error);
      alert("Không thể tải thông tin diễn biến.");
      setEditingVariantId(null);
    } finally {
      setIsFetchingVariantData(false);
    }
  };

  const handleVariantSubmit = async (data: any) => {
    if (!editingVariantId) return;
    setIsSubmittingVariant(true);
    try {
      await apiClient.patch(`/chapter-variants/${editingVariantId}`, data);
      if (selectedChapterForVariants) {
        await fetchVariants(selectedChapterForVariants.id, selectedParentVariant?.id || null);
      }
      setEditingVariantId(null);
      setEditingVariantData(null);
    } catch (error) {
      console.error("Failed to update variant:", error);
      alert("Không thể lưu diễn biến. Vui lòng thử lại.");
    } finally {
      setIsSubmittingVariant(false);
    }
  };

  const handleChapterCreateSubmit = async (data: any) => {
    if (!storyIdForNewChapter) return;
    setIsSubmittingNewChapter(true);
    try {
      await apiClient.post(`/stories/${storyIdForNewChapter}/chapters`, data);
      setIsCreatingChapter(false);
      
      // Refresh chapters
      const res = await apiClient.get(`/chapters?storyId=${storyIdForNewChapter}&limit=100`);
      const chaptersRaw: any = unwrapList(res.data);
      const chaptersWithVariants: ChapterInfo[] = await Promise.all(
        chaptersRaw.map(async (ch: any) => {
          try {
            const varRes = await apiClient.get(`/chapters/${ch.id}/variants`);
            return {
              id: ch.id,
              title: ch.title || ch.titleVi || ch.titleEn || `Chương ${ch.chapterNumber}`,
              chapterNumber: ch.chapterNumber,
              variants: unwrapList(varRes.data),
            };
          } catch {
            return {
              id: ch.id,
              title: ch.title || ch.titleVi || ch.titleEn || `Chương ${ch.chapterNumber}`,
              chapterNumber: ch.chapterNumber,
              variants: [],
            };
          }
        })
      );
      setStoryChapters((prev) => ({ ...prev, [storyIdForNewChapter]: chaptersWithVariants }));

      // Update local count
      setStories(prev => prev.map(s => 
        s.id === storyIdForNewChapter 
          ? { ...s, _count: { ...s._count, chapters: (s._count?.chapters || 0) + 1 } } 
          : s
      ));
      
      setStoryIdForNewChapter(null);
    } catch (error) {
      console.error("Failed to create chapter:", error);
      alert("Không thể tạo chương mới.");
    } finally {
      setIsSubmittingNewChapter(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm("Xóa biến thể này?")) return;
    try {
      const chapterId = selectedChapterForVariants?.id;
      await apiClient.delete(`/chapter-variants/${variantId}`);
      if (chapterId && selectedChapterForVariants) {
        updateChapterVariantCount(selectedChapterForVariants.storyId, chapterId, -1);
        await fetchVariants(chapterId, selectedParentVariant?.id || null);
      }
    } catch (error) {
      console.error("Failed to delete variant:", error);
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteChapter = async (storyId: string, chapterId: string, chapterTitle: string) => {
    if (!confirm(`Bạn có chắc muốn xóa chương "${chapterTitle}"? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await apiClient.delete(`/chapters/${chapterId}`);
      // Refresh chapters for this story
      setStoryChapters((prev) => ({
        ...prev,
        [storyId]: (prev[storyId] || []).filter((ch) => ch.id !== chapterId),
      }));
    } catch (error) {
      console.error("Failed to delete chapter:", error);
      alert("Không thể xóa chương. Vui lòng thử lại.");
    }
  };

  const toggleStory = async (storyId: string) => {
    if (expandedStoryId === storyId) {
      setExpandedStoryId(null);
      return;
    }
    setExpandedStoryId(storyId);
    setExpandedChapterId(null);

    if (storyChapters[storyId]) return;

    setLoadingChapters(storyId);
    try {
      const res = await apiClient.get(`/chapters?storyId=${storyId}&limit=100`);
      const chaptersRaw: any = unwrapList(res.data);

      // For each chapter, fetch its variants
      const chaptersWithVariants: ChapterInfo[] = await Promise.all(
        chaptersRaw.map(async (ch: any) => {
          try {
            const varRes = await apiClient.get(`/chapters/${ch.id}/variants`);
            return {
              id: ch.id,
              title: ch.title || ch.titleVi || ch.titleEn || `Chương ${ch.chapterNumber}`,
              chapterNumber: ch.chapterNumber,
              variants: unwrapList(varRes.data),
            };
          } catch {
            return {
              id: ch.id,
              title: ch.title || ch.titleVi || ch.titleEn || `Chương ${ch.chapterNumber}`,
              chapterNumber: ch.chapterNumber,
              variants: [],
            };
          }
        })
      );
      
      setStoryChapters((prev) => ({ ...prev, [storyId]: chaptersWithVariants }));
    } catch (error) {
      console.error("Failed to fetch chapters:", error);
    } finally {
      setLoadingChapters(null);
    }
  };

  const getChapterTitle = (storyId: string, chapterId: string) => {
    const chapters = storyChapters[storyId];
    if (!chapters) return chapterId;
    const ch = chapters.find((c) => c.id === chapterId);
    return ch ? `Chương ${ch.chapterNumber}: ${ch.title}` : chapterId;
  };

  const getVariantTitle = (storyId: string, chapterId: string, variantId: string) => {
    const chapters = storyChapters[storyId];
    if (!chapters) return variantId;
    const ch = chapters.find((c) => c.id === chapterId);
    if (!ch) return variantId;
    const v = ch.variants.find((vr) => vr.id === variantId);
    return v ? v.title : variantId;
  };

  const filteredStories = stories.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.title?.toLowerCase().includes(term) ||
      s.titleVi?.toLowerCase().includes(term) ||
      s.titleEn?.toLowerCase().includes(term) ||
      s.author?.name?.toLowerCase().includes(term)
    );
  });

  // Count stories with interactive chapters (have variants)
  const interactiveCount = Object.values(storyChapters).filter((chapters) =>
    chapters.some((ch) => ch.variants.length > 0)
  ).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
              <Zap className="w-6 h-6 text-white" />
            </div>
            Truyện Tương Tác
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Quản lý các diễn biến và nhánh truyện tương tác cho từng chương.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <AdminLanguageDropdown
            value={selectedLocale}
            onChange={setSelectedLocale}
            languages={languages}
          />
          <Link href={`/stories/new?lang=${selectedLocale}&isInteractive=true`}>
            <button className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-amber-200 transition-all active:scale-95 hover:bg-amber-600 md:min-h-0 md:w-auto md:rounded-xl">
              <Plus className="w-4 h-4" />
              Thêm truyện mới
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng truyện</p>
            <p className="text-xl font-black text-slate-900">{stories.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Có nhánh tương tác</p>
            <p className="text-xl font-black text-slate-900">{interactiveCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng biến thể</p>
            <p className="text-xl font-black text-slate-900">
              {Object.values(storyChapters).reduce(
                (sum, chapters) => sum + chapters.reduce((s, ch) => s + ch.variants.length, 0),
                0
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="relative group"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text"
            placeholder="Tìm kiếm truyện theo tiêu đề hoặc tác giả..."
            className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
      </div>

      {/* Stories List */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="px-8 py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Zap className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Không tìm thấy truyện</h3>
            <p className="text-slate-500 mt-1">Vui lòng thử điều chỉnh lại bộ lọc tìm kiếm.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredStories.map((story) => {
              const isExpanded = expandedStoryId === story.id;
              const chapters = storyChapters[story.id] || [];
              const hasVariants = chapters.some((ch) => ch.variants.length > 0);
              const hasBranching = chapters.some((ch) =>
                ch.variants.some((v) => v.nextChapterId)
              );

              return (
                <div key={story.id}>
                  {/* Story Row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => void toggleStory(story.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void toggleStory(story.id);
                      }
                    }}
                    className="w-full flex items-center gap-4 px-8 py-5 text-left hover:bg-slate-50/50 transition-all group cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-16 rounded-lg flex-shrink-0 bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shadow-sm border border-slate-200 group-hover:border-amber-200 transition-colors">
                      {story.thumbnailUrl ? (
                        <img
                          src={story.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <BookOpen className="w-6 h-6 opacity-20" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate group-hover:text-amber-600 transition-colors">
                        {story.titleVi || story.titleEn || story.title}
                      </p>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">
                        By <span className="text-slate-700">{story.author?.name}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                          {story._count?.chapters || 0} chương
                        </span>
                        {isExpanded && hasVariants && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" /> Tương tác
                          </span>
                        )}
                        {isExpanded && hasBranching && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md flex items-center gap-1">
                            <GitBranch className="w-2.5 h-2.5" /> Phân nhánh
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pr-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoryIdForNewChapter(story.id);
                          setIsCreatingChapter(true);
                        }}
                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Thêm chương mới"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStory(story);
                        }}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Sửa truyện"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStory(story.id, story.title);
                        }}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Xóa truyện"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronDown
                        className={`w-5 h-5 ml-2 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Expanded Chapters */}
                  {isExpanded && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-8 py-6">
                      {loadingChapters === story.id ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                        </div>
                      ) : chapters.length === 0 ? (
                        <p className="text-center text-sm text-slate-500 py-8">
                          Chưa có chương nào.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {chapters.map((chapter) => {
                            const isChapterExpanded = expandedChapterId === chapter.id;
                            const variantCount = chapter.variants.length;
                            const branchCount = chapter.variants.filter((v) => v.nextChapterId).length;
                            const defaultVariant = chapter.variants.find((v) => v.isDefault);

                            return (
                              <div
                                key={chapter.id}
                                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                              >
                                {/* Chapter Header */}
                                <div className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-all group">
                                  <div
                                    onClick={() =>
                                      setExpandedChapterId(isChapterExpanded ? null : chapter.id)
                                    }
                                    className="flex-1 flex items-center gap-3 cursor-pointer"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">
                                      {chapter.chapterNumber}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">
                                        {formatChapterTitle(tChapter("chapterKeyword"), chapter.chapterNumber, cleanChapterTitle(chapter.title))}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {variantCount > 0 && (
                                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                            {variantCount} diễn biến
                                          </span>
                                        )}
                                        {branchCount > 0 && (
                                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                            {branchCount} nhánh
                                          </span>
                                        )}
                                        {defaultVariant && (
                                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                            ★ {defaultVariant.title}
                                          </span>
                                        )}
                                        {variantCount === 0 && (
                                          <span className="text-[10px] text-slate-400">
                                            Không có diễn biến
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {/* Plus Icon - Add Variant */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedChapterForVariants(chapter);
                                        setSelectedParentVariant(null);
                                        setVariantsModalOpen(true);
                                        // Auto open add variant form
                                        setTimeout(() => setIsAddingVariant(true), 100);
                                      }}
                                      className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                      title="Thêm diễn biến mới"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>

                                    {/* Layers Icon (Action) */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedChapterForVariants(chapter);
                                        setVariantsModalOpen(true);
                                      }}
                                      className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                                        isChapterExpanded 
                                          ? "bg-indigo-50 text-indigo-600" 
                                          : "text-slate-500 hover:bg-slate-100"
                                      }`}
                                      title="Quản lý biến thể"
                                    >
                                      <Layers className="w-4 h-4" />
                                      <span className="text-xs font-bold">{variantCount}</span>
                                    </button>

                                    {/* Pencil Icon (Action) */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditChapter(chapter);
                                      }}
                                      className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      title="Chỉnh sửa chương"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>

                                    {/* Trash Icon (Action) */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteChapter(story.id, chapter.id, chapter.title);
                                      }}
                                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Xóa chương"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>

                                    {/* ChevronRight was here, removed as redundant */}
                                  </div>
                                </div>

                                {/* Variants Detail */}
                                {isChapterExpanded && variantCount > 0 && (
                                  <div className="border-t border-slate-100 p-4 space-y-2">
                                    {chapter.variants.map((variant) => (
                                      <div
                                        key={variant.id}
                                        className={`rounded-xl p-3 border ${
                                          variant.isDefault
                                            ? "border-amber-200 bg-amber-50/50"
                                            : "border-slate-100 bg-slate-50/50"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            {variant.isDefault && (
                                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                            )}
                                            <p className="text-sm font-bold text-slate-900">
                                              {variant.title}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-slate-500">
                                              {formatDuration(variant.audioDuration)}
                                            </span>
                                            {variant.unlockPrice > 0 && (
                                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                {variant.unlockPrice} credits
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Branching Info */}
                                        {variant.nextChapterId && (
                                          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-100">
                                            <ArrowRight className="w-3 h-3 flex-shrink-0" />
                                            <span className="font-bold">Chuyển đến:</span>
                                            <span className="font-medium truncate">
                                              {getChapterTitle(story.id, variant.nextChapterId)}
                                              {variant.nextVariantId && (
                                                <>
                                                  {" → "}
                                                  {getVariantTitle(story.id, variant.nextChapterId, variant.nextVariantId)}
                                                </>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Chapter Edit */}
      {editingChapterId && editingChapterData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[32px] shadow-2xl relative custom-scrollbar">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 py-6 rounded-t-[32px]">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                Chỉnh sửa chương
              </h2>
              <button
                onClick={() => {
                  setEditingChapterId(null);
                  setEditingChapterData(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
                title="Đóng modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              {isFetchingChapterData ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                  <p className="text-sm font-bold text-slate-500 animate-pulse">Đang tải dữ liệu chương...</p>
                </div>
              ) : fullChapterData && (
                <ChapterForm
                  initialData={fullChapterData}
                  selectedLocale={selectedLocale}
                  onSubmit={handleChapterSubmit}
                  onCancel={() => {
                    setEditingChapterId(null);
                    setEditingChapterData(null);
                    setFullChapterData(null);
                  }}
                  isLoading={isSubmittingChapter}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Variants Manager */}
      {variantsModalOpen && selectedChapterForVariants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white border-b border-slate-100 px-8 py-6 rounded-t-[32px] flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {selectedParentVariant ? `Con của: ${selectedParentVariant.title}` : "Quản lý Diễn biến"}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Chương {selectedChapterForVariants.chapterNumber}: {selectedChapterForVariants.title}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedParentVariant && (
                    <button
                      onClick={() => setSelectedParentVariant(null)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Quay lại gốc
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setVariantsModalOpen(false);
                      setSelectedChapterForVariants(null);
                      setSelectedParentVariant(null);
                    }}
                    className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Danh sách diễn biến</h3>
                <button
                  onClick={() => setIsAddingVariant(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                >
                  <Plus className="w-4 h-4" />
                  Thêm diễn biến
                </button>
              </div>

              {isFetchingVariants ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : variants.length > 0 ? (
                <div className="space-y-4">
                  {variants.map((variant) => (
                    <div key={variant.id} className="p-5 border border-slate-200 rounded-2xl bg-white flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-base">{variant.title}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(variant.audioDuration)}
                          </span>
                          <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg">
                            {variant.unlockPrice} Credits
                          </span>
                          {variant.isDefault && (
                            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-emerald-700 text-transparent" />
                              Mặc định
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={async () => {
                            try {
                              await apiClient.patch(`/chapter-variants/${variant.id}`, { isDefault: !variant.isDefault });
                              await fetchVariants(selectedChapterForVariants.id, selectedParentVariant?.id || null);
                            } catch (e) { console.error(e); }
                          }}
                          className={`p-2 rounded-xl transition-all border border-transparent hover:border-slate-200 ${
                            variant.isDefault 
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                              : 'bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-white'
                          }`}
                          title={variant.isDefault ? 'Bỏ mặc định' : 'Đặt làm mặc định'}
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSelectedParentVariant(variant)}
                          className="p-2 bg-slate-50 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-xl transition-all border border-transparent hover:border-slate-200"
                          title="Quản lý biến thể con"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditVariant(variant)}
                          className="p-2 bg-slate-50 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-xl transition-all border border-transparent hover:border-slate-200"
                          title="Chỉnh sửa chi tiết"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteVariant(variant.id)}
                          className="p-2 bg-slate-50 hover:bg-white text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-slate-200"
                          title="Xóa diễn biến"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Layers className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Chưa có diễn biến</h3>
                  <p className="text-sm text-slate-500">Tạo diễn biến đầu tiên để người đọc có thể lựa chọn.</p>
                </div>
              )}
            </div>
            
            <div className="px-8 py-5 border-t border-slate-100 bg-white rounded-b-[32px] flex items-center justify-center">
              <p className="text-xs font-medium text-slate-400 flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span>Bạn cũng có thể đính kèm âm thanh riêng cho từng diễn biến.</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Variant (Secondary Modal) */}
      {isAddingVariant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-100">
            <div className="px-8 pt-8 pb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  Thêm Diễn Biến
                </h3>
                <button
                  onClick={() => setIsAddingVariant(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Tiêu đề diễn biến
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={newVariantTitle}
                    onChange={(e) => setNewVariantTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateVariant();
                      if (e.key === 'Escape') setIsAddingVariant(false);
                    }}
                    placeholder="Nhập tiêu đề (vd: Chiến đấu, Chạy trốn...)"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500/20 focus:bg-white rounded-2xl py-4 px-6 text-sm font-bold text-slate-700 transition-all outline-none"
                  />
                </div>
                
                <p className="text-xs text-slate-400 px-1 leading-relaxed">
                  Diễn biến mới sẽ được thêm vào cuối danh sách của chapter hiện tại.
                </p>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50/50 flex items-center gap-3 border-t border-slate-100">
              <button
                onClick={() => setIsAddingVariant(false)}
                className="flex-1 py-3.5 px-6 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
              >
                Hủy
              </button>
              <button
                disabled={isCreatingVariant || !newVariantTitle.trim()}
                onClick={handleCreateVariant}
                className="flex-[2] py-3.5 px-6 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                {isCreatingVariant ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Tạo Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Variant (Secondary/Tertiary Modal) */}
      {editingVariantId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] max-w-5xl w-full max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-100 flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100 flex items-center justify-center text-white">
                  <Pencil className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Chỉnh sửa Diễn Biến</h3>
                  {selectedChapterForVariants && (
                    <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                      Chapter {selectedChapterForVariants.chapterNumber} • {selectedChapterForVariants.title}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingVariantId(null);
                  setEditingVariantData(null);
                }}
                className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isFetchingVariantData ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                  <p className="text-sm font-black text-slate-500 animate-pulse">Đang tải chi tiết diễn biến...</p>
                </div>
              ) : editingVariantData && (
                <VariantForm
                  initialData={{
                    title: editingVariantData.title,
                    description: editingVariantData.description || "",
                    content: editingVariantData.content || "",
                    audioUrl: editingVariantData.audioUrl || "",
                    r2AudioUrl: editingVariantData.r2AudioUrl || "",
                    audioDuration: editingVariantData.audioDuration || 0,
                    unlockPrice: editingVariantData.unlockPrice || 0,
                    orderIndex: editingVariantData.orderIndex || 0,
                    isDefault: editingVariantData.isDefault || false,
                    nextChapterId: editingVariantData.nextChapterId || null,
                    nextVariantId: editingVariantData.nextVariantId || null,
                  }}
                  chapterId={editingVariantData.chapterId}
                  storyId={selectedChapterForVariants?.storyId}
                  onSubmit={handleVariantSubmit}
                  onCancel={() => {
                    setEditingVariantId(null);
                    setEditingVariantData(null);
                  }}
                  isLoading={isSubmittingVariant}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Chapter */}
      {isCreatingChapter && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] max-w-5xl w-full max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-100 flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-100 flex items-center justify-center text-white">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Thêm Chương Mới</h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                    Tạo chương mới cho truyện này
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreatingChapter(false);
                  setStoryIdForNewChapter(null);
                }}
                className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <ChapterForm
                initialData={{
                  chapterNumber: (storyChapters[storyIdForNewChapter!]?.length || 0) + 1,
                  titleVi: '',
                  descriptionVi: '',
                  contentVi: '',
                  accessType: 'free',
                }}
                onSubmit={handleChapterCreateSubmit}
                onCancel={() => {
                  setIsCreatingChapter(false);
                  setStoryIdForNewChapter(null);
                }}
                isLoading={isSubmittingNewChapter}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Story */}
      {editingStoryId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] max-w-5xl w-full max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-100 flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100 flex items-center justify-center text-white">
                  <Pencil className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Chi tiết truyện</h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                    {isFetchingStoryData ? 'Đang tải thông tin...' : 'Chỉnh sửa thông tin cơ bản'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingStoryId(null);
                  setEditingStoryData(null);
                }}
                className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isFetchingStoryData ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                  <p className="text-sm font-bold text-slate-400">Đang lấy dữ liệu truyện...</p>
                </div>
              ) : (
                <StoryForm
                  initialData={editingStoryData}
                  onSubmit={handleStorySubmit}
                  onCancel={() => {
                    setEditingStoryId(null);
                    setEditingStoryData(null);
                  }}
                  isLoading={isSubmittingStory}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
