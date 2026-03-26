import { useTranslations } from "next-intl";
import { formatChapterTitle, cleanChapterTitle } from "@/lib/formatChapterTitle";
"use client";

import React, { useState, useEffect } from "react";
import Link from "@/components/shared/LocalizedLink";
import {
  Zap,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Layers,
  Star,
  GitBranch,
  ArrowRight,
  Eye,
  Music,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';

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
  const [stories, setStories] = useState<StoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [storyChapters, setStoryChapters] = useState<Record<string, ChapterInfo[]>>({});
  const [loadingChapters, setLoadingChapters] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState('vi');
  const { languages } = useAdminLanguages();

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
      setStories(res.data.data || []);
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
      const chaptersRaw = res.data.data || res.data || [];
      
      // For each chapter, fetch its variants
      const chaptersWithVariants: ChapterInfo[] = await Promise.all(
        chaptersRaw.map(async (ch: any) => {
          try {
            const varRes = await apiClient.get(`/chapters/${ch.id}/variants`);
            return {
              id: ch.id,
              title: ch.title || ch.titleVi || ch.titleEn || `Chương ${ch.chapterNumber}`,
              chapterNumber: ch.chapterNumber,
              variants: varRes.data || [],
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
          <Link href={`/admin/stories/new?lang=${selectedLocale}&isInteractive=true`}>
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
            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all"
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
                      <Link
                        href={`/admin/stories/${story.id}/chapters`}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                        title="Quản lý chương"
                      >
                        <Music className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/admin/stories/${story.id}?lang=${selectedLocale}`}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Sửa truyện"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStory(story.id, story.title);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Xóa truyện"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronDown
                        className={`w-5 h-5 ml-2 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
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
                                <button
                                  onClick={() =>
                                    setExpandedChapterId(isChapterExpanded ? null : chapter.id)
                                  }
                                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-all"
                                >
                                  <div className="flex items-center gap-3">
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
                                  {variantCount > 0 && (
                                    <ChevronRight
                                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isChapterExpanded ? "rotate-90" : ""}`}
                                    />
                                  )}
                                </button>

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
    </div>
  );
}
