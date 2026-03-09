"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";

type InlineComment = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  authorAvatarUrl?: string | null;
};

type ParagraphItem = {
  id: string;
  index: number;
  content: string;
};

type ParagraphCommentsResponse = {
  comments?: Array<{
    id?: string;
    content?: string;
    createdAt?: string;
    user?: {
      displayName?: string;
      name?: string;
      avatarUrl?: string | null;
    };
  }>;
  data?: {
    comments?: Array<{
      id?: string;
      content?: string;
      createdAt?: string;
      user?: {
        displayName?: string;
        name?: string;
        avatarUrl?: string | null;
      };
    }>;
  };
};

type ChapterCommentsResponse = {
  data?: {
    comments?: Array<{
      id?: string;
      content?: string;
      createdAt?: string;
      user?: {
        displayName?: string;
        name?: string;
        avatarUrl?: string | null;
      };
    }>;
  };
};

type StoryReaderProps = {
  chapterId?: string | null;
  content?: string | null;
  adInterval?: number;
  isLocked?: boolean;
  previewChars?: number;
  lockLabel?: string;
  onUnlockRequest?: () => void;
};

const splitParagraphs = (chapterId: string, content: string | null | undefined): ParagraphItem[] => {
  if (!content) return [];

  const parts = content
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.map((part, index) => ({
    id: `${chapterId}-p-${index}`,
    index,
    content: part,
  }));
};

export default function StoryReader({
  chapterId,
  content,
  adInterval = 700,
  isLocked = false,
  previewChars = 500,
  lockLabel,
  onUnlockRequest,
}: StoryReaderProps) {
  const [openParagraphId, setOpenParagraphId] = useState<string | null>(null);
  const [paragraphDrafts, setParagraphDrafts] = useState<Record<string, string>>({});
  const [chapterDraft, setChapterDraft] = useState("");
  const [paragraphComments, setParagraphComments] = useState<Record<string, InlineComment[]>>({});
  const [loadedParagraphs, setLoadedParagraphs] = useState<Record<string, boolean>>({});
  const [chapterComments, setChapterComments] = useState<InlineComment[]>([]);
  const [isLoadingChapterComments, setIsLoadingChapterComments] = useState(false);
  const [isSubmittingParagraph, setIsSubmittingParagraph] = useState(false);
  const [isSubmittingChapter, setIsSubmittingChapter] = useState(false);

  const paragraphs = useMemo(() => {
    if (!chapterId) return [];
    return splitParagraphs(chapterId, content);
  }, [chapterId, content]);

  const previewParagraphs = useMemo(() => {
    if (!chapterId || !content) return [];
    const preview = content.slice(0, previewChars).trim();
    if (!preview) return [];
    return splitParagraphs(chapterId, preview);
  }, [chapterId, content, previewChars]);

  const flowItems = useMemo(() => {
    const items: Array<
      | { type: "paragraph"; paragraph: ParagraphItem }
      | { type: "ad"; id: string }
      | { type: "cta"; id: string }
    > = [];

    let accumulatedChars = 0;
    let nextBreakAt = adInterval;

    paragraphs.forEach((paragraph, paragraphIndex) => {
      items.push({ type: "paragraph", paragraph });
      accumulatedChars += paragraph.content.length;

      while (accumulatedChars >= nextBreakAt) {
        const isCta = Math.floor(nextBreakAt / adInterval) % 2 === 0;
        items.push({
          type: isCta ? "cta" : "ad",
          id: `${paragraph.id}-slot-${nextBreakAt}`,
        });
        nextBreakAt += adInterval;
      }

      if ((paragraphIndex + 1) % 6 === 0) {
        // Keep a gentle rhythm for very short paragraphs where character threshold is not reached.
        items.push({ type: "cta", id: `${paragraph.id}-fallback-cta` });
      }
    });

    return items;
  }, [adInterval, paragraphs]);

  const normalizeComments = (rawComments: ParagraphCommentsResponse["comments"] = []): InlineComment[] => {
    return rawComments.map((item) => ({
      id: item.id || `${Math.random().toString(36).slice(2)}`,
      content: item.content || "",
      authorName: item.user?.displayName || item.user?.name || "Độc giả",
      authorAvatarUrl: item.user?.avatarUrl,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
  };

  const loadChapterComments = async () => {
    if (!chapterId) return;

    setIsLoadingChapterComments(true);
    try {
      const response = await apiClient.get<ChapterCommentsResponse>(`/chapters/${chapterId}/comments`, {
        params: {
          scope: "chapter",
          page: 1,
          limit: 30,
        },
      });
      const rawComments = response?.data?.data?.comments || [];
      setChapterComments(normalizeComments(rawComments));
    } catch {
      setChapterComments([]);
    } finally {
      setIsLoadingChapterComments(false);
    }
  };

  const loadParagraphComments = async (paragraphId: string, paragraphIndex: number) => {
    if (!chapterId) return;
    if (loadedParagraphs[paragraphId]) return;

    try {
      const response = await apiClient.get<ParagraphCommentsResponse>(`/chapters/${chapterId}/comments`, {
        params: {
          scope: "paragraph",
          paragraphIndex,
          page: 1,
          limit: 30,
        },
      });
      const rawComments = response?.data?.data?.comments || response?.data?.comments || [];
      const normalized = normalizeComments(rawComments);

      setParagraphComments((prev) => ({
        ...prev,
        [paragraphId]: normalized,
      }));
    } catch {
      setParagraphComments((prev) => ({
        ...prev,
        [paragraphId]: prev[paragraphId] || [],
      }));
    } finally {
      setLoadedParagraphs((prev) => ({
        ...prev,
        [paragraphId]: true,
      }));
    }
  };

  const openCommentPopup = (paragraphId: string, paragraphIndex: number) => {
    setOpenParagraphId((prev) => (prev === paragraphId ? null : paragraphId));
    if (!loadedParagraphs[paragraphId]) {
      void loadParagraphComments(paragraphId, paragraphIndex);
    }
  };

  const submitParagraphComment = async (paragraph: ParagraphItem) => {
    if (!chapterId) return;
    const contentValue = (paragraphDrafts[paragraph.id] || "").trim();
    if (!contentValue) return;

    setIsSubmittingParagraph(true);
    try {
      const response = await apiClient.post<{ data?: any }>(`/chapters/${chapterId}/comments`, {
        content: contentValue,
        scope: "paragraph",
        paragraphIndex: paragraph.index,
      });

      const created = response?.data?.data;
      const newComment: InlineComment = {
        id: created?.id || `${paragraph.id}-${Date.now()}`,
        content: created?.content || contentValue,
        authorName: created?.user?.displayName || created?.user?.name || "Bạn",
        authorAvatarUrl: created?.user?.avatarUrl,
        createdAt: created?.createdAt || new Date().toISOString(),
      };

      setParagraphComments((prev) => ({
        ...prev,
        [paragraph.id]: [...(prev[paragraph.id] || []), newComment],
      }));
      setParagraphDrafts((prev) => ({ ...prev, [paragraph.id]: "" }));
    } catch {
      // silent fail to avoid breaking reading flow
    } finally {
      setIsSubmittingParagraph(false);
    }
  };

  const submitChapterComment = async () => {
    if (!chapterId) return;
    const contentValue = chapterDraft.trim();
    if (!contentValue) return;

    setIsSubmittingChapter(true);
    try {
      const response = await apiClient.post<{ data?: any }>(`/chapters/${chapterId}/comments`, {
        content: contentValue,
        scope: "chapter",
      });

      const created = response?.data?.data;
      const newComment: InlineComment = {
        id: created?.id || `chapter-${Date.now()}`,
        content: created?.content || contentValue,
        authorName: created?.user?.displayName || created?.user?.name || "Bạn",
        authorAvatarUrl: created?.user?.avatarUrl,
        createdAt: created?.createdAt || new Date().toISOString(),
      };

      setChapterComments((prev) => [newComment, ...prev]);
      setChapterDraft("");
    } catch {
      // silent fail to avoid breaking reading flow
    } finally {
      setIsSubmittingChapter(false);
    }
  };

  useEffect(() => {
    setOpenParagraphId(null);
    setParagraphDrafts({});
    setParagraphComments({});
    setLoadedParagraphs({});
    setChapterDraft("");
    setChapterComments([]);

    if (chapterId) {
      void loadChapterComments();
    }
  }, [chapterId]);

  if (!paragraphs.length) {
    return <p className="text-base leading-loose text-gray-500 dark:text-gray-300">Chương này chưa có bản truyện chữ.</p>;
  }

  if (isLocked) {
    return (
      <div className="relative overflow-hidden pr-0 sm:pr-10 lg:pr-14">
        {previewParagraphs.length ? (
          previewParagraphs.map((paragraph) => (
            <div key={paragraph.id} className="mb-6">
              <p className="text-lg leading-loose text-gray-800 dark:text-gray-100">{paragraph.content}</p>
            </div>
          ))
        ) : (
          <p className="text-base leading-loose text-gray-500 dark:text-gray-300">Chương này hiện đang bị khóa nội dung.</p>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-white dark:to-gray-900" />

        <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border border-amber-200 bg-white/95 p-4 text-sm shadow-lg backdrop-blur dark:border-amber-900/60 dark:bg-gray-900/95">
          <p className="font-semibold text-amber-700 dark:text-amber-300">Nội dung bị khóa</p>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            {lockLabel || "Cần mở khóa VIP để đọc toàn bộ chương này."}
          </p>
          <button
            type="button"
            onClick={onUnlockRequest}
            className="mt-3 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            Mở khóa ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-visible pr-0 sm:pr-10 lg:pr-14">
      {flowItems.map((item) => {
        if (item.type === "paragraph") {
          const { paragraph } = item;
          const comments = paragraphComments[paragraph.id] || [];
          const isOpen = openParagraphId === paragraph.id;

          return (
            <div key={paragraph.id} className="group relative mb-6 overflow-visible">
              <p className="text-lg leading-loose text-gray-800 dark:text-gray-100">{paragraph.content}</p>

              <button
                onClick={() => openCommentPopup(paragraph.id, paragraph.index)}
                className={`absolute bottom-0 right-0 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/90 px-2 py-1 text-xs text-slate-600 transition-all duration-200 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 sm:bottom-auto sm:top-1/2 sm:-right-12 sm:-translate-y-1/2 ${
                  comments.length > 0
                    ? "opacity-40 group-hover:opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                aria-label={`Bình luận đoạn ${paragraph.index + 1}`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{comments.length}</span>
              </button>

              {isOpen && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bình luận đoạn #{paragraph.index + 1}</p>
                    <button
                      onClick={() => setOpenParagraphId(null)}
                      className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      aria-label="Đóng bình luận"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {comments.length ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="rounded-md bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800">
                          <p className="font-semibold text-gray-700 dark:text-gray-200">{comment.authorName}</p>
                          <p className="mt-1 text-gray-600 dark:text-gray-300">{comment.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Chưa có bình luận nào cho đoạn này.</p>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={paragraphDrafts[paragraph.id] || ""}
                      onChange={(event) =>
                        setParagraphDrafts((prev) => ({
                          ...prev,
                          [paragraph.id]: event.target.value,
                        }))
                      }
                      placeholder="Viết bình luận cho đoạn này..."
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                    />
                    <button
                      onClick={() => void submitParagraphComment(paragraph)}
                      disabled={isSubmittingParagraph}
                      className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                      aria-label="Gửi bình luận"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }

        if (item.type === "ad") {
          return (
            <div key={item.id} className="mb-8 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide">Sponsored</p>
              <p className="mt-1">Quảng cáo: Nâng cấp Premium để mở khóa audio chất lượng cao và nghe không giới hạn.</p>
            </div>
          );
        }

        return (
          <div key={item.id} className="mb-8 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200">
            <p className="text-[11px] font-semibold uppercase tracking-wide">Gợi ý cho bạn</p>
            <p className="mt-1">Tiếp tục chương sau để mở khóa đoạn cao trào và nhận thưởng 20 credits.</p>
          </div>
        );
      })}
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bình luận toàn chương</h3>

        <div className="mt-3 flex gap-2">
          <input
            value={chapterDraft}
            onChange={(event) => setChapterDraft(event.target.value)}
            placeholder="Viết bình luận cho toàn chương..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
          />
          <button
            onClick={() => void submitChapterComment()}
            disabled={isSubmittingChapter}
            className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            aria-label="Gửi bình luận toàn chương"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {isLoadingChapterComments ? (
            <p className="text-xs text-gray-500">Đang tải bình luận...</p>
          ) : chapterComments.length ? (
            chapterComments.map((comment) => (
              <div key={comment.id} className="rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                <p className="font-semibold text-gray-700 dark:text-gray-200">{comment.authorName}</p>
                <p className="mt-1 text-gray-600 dark:text-gray-300">{comment.content}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-500">Chưa có bình luận nào cho toàn chương này.</p>
          )}
        </div>
      </section>
    </div>
  );
}
