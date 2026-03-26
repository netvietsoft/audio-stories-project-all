"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Heart, Lightbulb, Reply, Send, ThumbsUp, X } from "lucide-react";
import DOMPurify from "dompurify";
import { useLocale } from "next-intl";

import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import SegmentCommentButton from "@/components/story/SegmentCommentButton";

type InlineComment = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  authorAvatarUrl?: string | null;
  reactions?: {
    helpful: number;
    like: number;
    love: number;
  };
  repliesCount?: number;
  replies?: InlineComment[];
};

type CommentSort = "newest" | "helpful" | "all";

type ParagraphItem = {
  id: string;
  index: number;
  content: string;
};

type AdvertisementItem = {
  id: string;
  partnerName: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  isActive: boolean;
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
    reactions?: {
      helpful?: number;
      like?: number;
      love?: number;
    };
    repliesCount?: number;
    replies?: Array<{
      id?: string;
      content?: string;
      createdAt?: string;
      user?: {
        displayName?: string;
        name?: string;
        avatarUrl?: string | null;
      };
      reactions?: {
        helpful?: number;
        like?: number;
        love?: number;
      };
    }>;
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
      reactions?: {
        helpful?: number;
        like?: number;
        love?: number;
      };
      repliesCount?: number;
      replies?: Array<{
        id?: string;
        content?: string;
        createdAt?: string;
        user?: {
          displayName?: string;
          name?: string;
          avatarUrl?: string | null;
        };
        reactions?: {
          helpful?: number;
          like?: number;
          love?: number;
        };
      }>;
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
      reactions?: {
        helpful?: number;
        like?: number;
        love?: number;
      };
      repliesCount?: number;
      replies?: Array<{
        id?: string;
        content?: string;
        createdAt?: string;
        user?: {
          displayName?: string;
          name?: string;
          avatarUrl?: string | null;
        };
        reactions?: {
          helpful?: number;
          like?: number;
          love?: number;
        };
      }>;
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

const normalizeStoryContent = (rawHtml: string) =>
  rawHtml
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/([A-Za-zÀ-ỹ0-9])\s*<br\s*\/?>\s*([A-Za-zÀ-ỹ0-9])/g, "$1 $2")
    .replace(/([A-Za-zÀ-ỹ0-9])\s*\r?\n\s*([A-Za-zÀ-ỹ0-9])/g, "$1 $2");

const sanitizeStoryContent = (rawHtml: string) =>
  DOMPurify.sanitize(normalizeStoryContent(rawHtml), {
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed"],
    FORBID_ATTR: ["style", "class", "id", "color", "bgcolor"],
  });

const hasVisibleContent = (html: string) => {
  if (!html) return false;
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return stripped.replace(/&nbsp;|\u00A0/g, "").trim().length > 0;
};

const splitParagraphs = (chapterId: string, content: string | null | undefined): ParagraphItem[] => {
  if (!content) return [];

  let parts: string[] = [];
  const doanRegex = /\[doan\d+\]/gi;
  if (doanRegex.test(content)) {
    parts = content
      .split(doanRegex)
      .map((part) => part.trim())
      .filter(hasVisibleContent);
  } else if (/<hr\s*\/?>/i.test(content)) {
    parts = content
      .split(/<hr\s*\/?>/gi)
      .map((part) => part.trim())
      .filter(hasVisibleContent);
  } else if (content.includes("<") && content.includes(">") && typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");
      const pNodes = Array.from(doc.querySelectorAll("p"));

      if (pNodes.length > 0) {
        parts = pNodes
          .map((node) => (node.textContent || "").trim())
          .filter(hasVisibleContent);
      } else {
        const plainText = (doc.body?.textContent || "").replace(/\r/g, "").trim();
        parts = plainText.split(/\n\s*\n/).map((part) => part.trim()).filter(hasVisibleContent);
      }
    } catch {
      parts = [];
    }
  }

  if (parts.length === 0) {
    parts = content
      .replace(/<[^>]*>/g, "\n")
      .split(/\n\s*\n|\n/)
      .map((part) => part.trim())
      .filter(hasVisibleContent);
  }

  parts = parts
    .map((part) => part.replace(/^\[Paragraph\s*\d+\]\s*/i, "").replace(/^\[Đoạn\s*\d+\]\s*/i, "").replace(/\[.*?\]/g, "").trim())
    .filter(hasVisibleContent);

  return parts.map((part, index) => ({
    id: `${chapterId}-p-${index}`,
    index,
    content: part,
  }));
};

const countWords = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
};

export default function StoryReader({
  chapterId,
  content,
  adInterval = 1000,
  isLocked = false,
  previewChars = 500,
  lockLabel,
  onUnlockRequest,
}: StoryReaderProps) {
  const locale = useLocale();
  const [insertionFrequency, setInsertionFrequency] = useState<number>(adInterval || 1000);
  const [openParagraphId, setOpenParagraphId] = useState<string | null>(null);
  const [paragraphDrafts, setParagraphDrafts] = useState<Record<string, string>>({});
  const [replyTargetByParagraph, setReplyTargetByParagraph] = useState<Record<string, string | null>>({});
  const [paragraphComments, setParagraphComments] = useState<Record<string, InlineComment[]>>({});
  const [paragraphCommentCounts, setParagraphCommentCounts] = useState<Record<number, number>>({});
  const [loadedParagraphs, setLoadedParagraphs] = useState<Record<string, boolean>>({});
  const [isSubmittingParagraph, setIsSubmittingParagraph] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>("newest");
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [activeAds, setActiveAds] = useState<AdvertisementItem[]>([]);
  
  const user = useUserStore((state) => state.user);
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const isProd = process.env.NODE_ENV === "production";

  const paragraphs = useMemo(() => {
    if (!chapterId) return [];
    return splitParagraphs(chapterId, content);
  }, [chapterId, content]);

  // Load comment counts for all paragraphs on mount
  useEffect(() => {
    if (!chapterId || paragraphs.length === 0) return;

    const loadCommentCounts = async () => {
      try {
        const response = await apiClient.get(`/chapters/${chapterId}/comments/counts`);
        const counts = response.data?.data || {};
        setParagraphCommentCounts(counts);
      } catch (error) {
        console.error('Failed to load comment counts:', error);
      }
    };

    void loadCommentCounts();
  }, [chapterId, paragraphs.length]);

  const previewParagraphs = useMemo(() => {
    if (!chapterId || !content) return [];
    const preview = content.slice(0, previewChars).trim();
    if (!preview) return [];
    return splitParagraphs(chapterId, preview);
  }, [chapterId, content, previewChars]);

  useEffect(() => {
    const fetchActiveAds = async () => {
      try {
        const response = await apiClient.get<{ data?: AdvertisementItem[] }>('/ads/active', {
          params: { limit: 10 },
        });
        setActiveAds(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch {
        setActiveAds([]);
      }
    };

    void fetchActiveAds();
  }, []);

  useEffect(() => {
    const fetchInsertionFrequency = async () => {
      try {
        const response = await apiClient.get('/settings/ad_insertion_frequency');
        const rawValue = response?.data?.value;
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed) && parsed > 0) {
          setInsertionFrequency(Math.floor(parsed));
          return;
        }
        setInsertionFrequency(1000);
      } catch {
        setInsertionFrequency(1000);
      }
    };

    void fetchInsertionFrequency();
  }, []);

  const flowItems = useMemo(() => {
    const items: Array<
      | { type: "paragraph"; paragraph: ParagraphItem }
      | { type: "ad"; id: string; ad: AdvertisementItem }
    > = [];

    let accumulatedWords = 0;
    let nextBreakAt = insertionFrequency;
    let adIndex = 0;

    paragraphs.forEach((paragraph) => {
      items.push({ type: "paragraph", paragraph });
      accumulatedWords += countWords(paragraph.content);

      while (accumulatedWords >= nextBreakAt && activeAds.length > 0) {
        const ad = activeAds[adIndex % activeAds.length];
        if (!ad) break;
        items.push({
          type: 'ad',
          id: `${paragraph.id}-slot-${nextBreakAt}`,
          ad,
        });
        adIndex += 1;
        nextBreakAt += insertionFrequency;
      }
    });

    return items;
  }, [activeAds, insertionFrequency, paragraphs]);

  const normalizeComments = (rawComments: ParagraphCommentsResponse["comments"] = []): InlineComment[] => {
    return rawComments.map((item) => ({
      id: item.id || `${Math.random().toString(36).slice(2)}`,
      content: item.content || "",
      authorName: item.user?.displayName || item.user?.name || "Độc giả",
      authorAvatarUrl: item.user?.avatarUrl,
      createdAt: item.createdAt || new Date().toISOString(),
      reactions: {
        helpful: item.reactions?.helpful || 0,
        like: item.reactions?.like || 0,
        love: item.reactions?.love || 0,
      },
      repliesCount: item.repliesCount || 0,
      replies:
        item.replies?.map((reply) => ({
          id: reply.id || `${Math.random().toString(36).slice(2)}`,
          content: reply.content || "",
          authorName: reply.user?.displayName || reply.user?.name || "Độc giả",
          authorAvatarUrl: reply.user?.avatarUrl,
          createdAt: reply.createdAt || new Date().toISOString(),
          reactions: {
            helpful: reply.reactions?.helpful || 0,
            like: reply.reactions?.like || 0,
            love: reply.reactions?.love || 0,
          },
        })) || [],
    }));
  };

  const loadParagraphComments = async (paragraphId: string, paragraphIndex: number, force = false) => {
    if (!chapterId) return;
    if (loadedParagraphs[paragraphId] && !force) return;

    try {
      const response = await apiClient.get<ParagraphCommentsResponse>(`/chapters/${chapterId}/comments`, {
        params: {
          scope: "paragraph",
          paragraphIndex,
          page: 1,
          limit: 30,
          sort: commentSort,
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

  const toggleReaction = async (
    commentId: string,
    type: "helpful" | "like" | "love",
    paragraphId?: string,
  ) => {
    try {
      const response = await apiClient.post<{ data?: { reactions?: InlineComment["reactions"] } }>(
        `/comments/${commentId}/reactions`,
        { type },
      );

      const nextReactions = response?.data?.data?.reactions;
      if (!nextReactions) return;

      const updateOne = (item: InlineComment) =>
        item.id === commentId ? { ...item, reactions: nextReactions } : item;

      if (!paragraphId) return;

      setParagraphComments((prev) => ({
        ...prev,
        [paragraphId]: (prev[paragraphId] || []).map((comment) => ({
          ...updateOne(comment),
          replies: (comment.replies || []).map(updateOne),
        })),
      }));
    } catch {
      // no-op for reaction errors
    }
  };

  const loadMoreReplies = async (commentId: string, paragraphId?: string) => {
    try {
      const response = await apiClient.get<{ data?: { replies?: ParagraphCommentsResponse["comments"] } }>(
        `/comments/${commentId}/replies`,
        {
          params: {
            page: 1,
            limit: 50,
          },
        },
      );

      const replies = normalizeComments(response?.data?.data?.replies || []);

      const mergeReplies = (item: InlineComment) =>
        item.id === commentId
          ? {
              ...item,
              replies,
              repliesCount: replies.length,
            }
          : item;

      if (!paragraphId) return;

      setParagraphComments((prev) => ({
        ...prev,
        [paragraphId]: (prev[paragraphId] || []).map(mergeReplies),
      }));
    } catch {
      // no-op for lazy replies errors
    }
  };

  const appendReplyToComment = (comments: InlineComment[], parentId: string, reply: InlineComment) =>
    comments.map((comment) => {
      if (comment.id !== parentId) return comment;
      const nextReplies = [...(comment.replies || []), reply];
      return {
        ...comment,
        replies: nextReplies,
        repliesCount: Math.max(comment.repliesCount || 0, nextReplies.length),
      };
    });

  const submitParagraphComment = async (paragraph: ParagraphItem) => {
    // Check if user is logged in
    if (!user) {
      openLogin();
      return;
    }
    
    if (!chapterId) return;
    const contentValue = (paragraphDrafts[paragraph.id] || "").trim();
    if (!contentValue) return;
    const parentId = replyTargetByParagraph[paragraph.id] || undefined;

    setIsSubmittingParagraph(true);
    try {
      const response = await apiClient.post<{ data?: any }>(`/chapters/${chapterId}/comments`, {
        content: contentValue,
        scope: "paragraph",
        paragraphIndex: paragraph.index,
        parentId,
      });

      const created = response?.data?.data;
      const newComment: InlineComment = {
        id: created?.id || `${paragraph.id}-${Date.now()}`,
        content: created?.content || contentValue,
        authorName: created?.user?.displayName || created?.user?.name || "Bạn",
        authorAvatarUrl: created?.user?.avatarUrl,
        createdAt: created?.createdAt || new Date().toISOString(),
        reactions: {
          helpful: 0,
          like: 0,
          love: 0,
        },
        replies: [],
        repliesCount: 0,
      };

      setParagraphComments((prev) => ({
        ...prev,
        [paragraph.id]: parentId
          ? appendReplyToComment(prev[paragraph.id] || [], parentId, newComment)
          : [...(prev[paragraph.id] || []), newComment],
      }));
      setParagraphDrafts((prev) => ({ ...prev, [paragraph.id]: "" }));
      setReplyTargetByParagraph((prev) => ({ ...prev, [paragraph.id]: null }));
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmittingParagraph(false);
    }
  };

  const handleReportComment = async (commentId: string) => {
    setReportingCommentId(commentId);
  };

  const submitReport = async () => {
    if (!reportingCommentId || !reportReason.trim()) return;

    try {
      await apiClient.post(`/comments/${reportingCommentId}/report`, {
        reason: reportReason.trim(),
      });
      alert("Đã gửi báo cáo. Cảm ơn bạn đã góp ý!");
      setReportingCommentId(null);
      setReportReason("");
    } catch (error) {
      console.error("Failed to report comment:", error);
      alert("Không thể gửi báo cáo. Vui lòng thử lại.");
    }
  };

  useEffect(() => {
    setOpenParagraphId(null);
    setParagraphDrafts({});
    setReplyTargetByParagraph({});
    setParagraphComments({});
    setLoadedParagraphs({});
    setCommentSort("newest");
  }, [chapterId]);

  if (!paragraphs.length) {
    return null;
  }

  if (isLocked) {
    return (
      <div className={`relative overflow-hidden min-w-0 pr-0 sm:pr-10 lg:pr-14 ${isProd ? "select-none" : ""}`}>
        {previewParagraphs.length ? (
          previewParagraphs.map((paragraph) => (
            <div key={paragraph.id} className="mb-6">
              <div 
                className="text-base sm:text-lg leading-relaxed text-gray-800 dark:text-gray-100 px-3 sm:px-4 md:px-5 text-justify"
                style={{ 
                  wordBreak: "normal",
                  overflowWrap: "break-word",
                  whiteSpace: "normal",
                  wordSpacing: "normal",
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeStoryContent(paragraph.content) }}
              />
            </div>
          ))
        ) : (
          <p className="text-base leading-loose text-gray-500 dark:text-gray-300 px-3 sm:px-4">Chương này hiện đang bị khóa nội dung.</p>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-white dark:to-gray-900" />

        <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-white/95 p-4 text-sm shadow-lg backdrop-blur dark:bg-gray-900/95">
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
    <>
      <style jsx>{`
        .story-paragraph-content {
          line-height: 1.8;
        }
        .story-paragraph-content * {
          color: inherit !important;
          background-color: transparent !important;
          font-family: inherit !important;
          letter-spacing: normal !important;
          word-break: normal !important;
          overflow-wrap: break-word !important;
          line-break: auto;
          hyphens: manual;
        }
        .story-paragraph-content p {
          margin: 0.5em 0;
          line-height: inherit;
        }
        .story-paragraph-content p:first-child {
          margin-top: 0;
        }
        .story-paragraph-content p:last-child {
          margin-bottom: 0;
        }
      `}</style>
      <div className={`relative min-w-0 overflow-x-hidden ${isProd ? "select-none" : ""}`}>
      {flowItems.map((item) => {
        if (item.type === "paragraph") {
          const { paragraph } = item;
          const comments = paragraphComments[paragraph.id] || [];
          const isOpen = openParagraphId === paragraph.id;
          const paragraphCount = paragraphCommentCounts[paragraph.index] || 0;

          return (
            <div key={paragraph.id} className="group mb-4 overflow-visible rounded-lg transition-colors md:mb-6">
              <div className="relative">
                <div
                  className="story-paragraph-content rounded-lg px-3 py-2 text-base sm:text-lg leading-relaxed text-gray-800 transition-colors sm:px-4 sm:py-2.5 md:px-5 md:py-3 dark:text-gray-100 text-justify"
                  style={{
                    wordBreak: "normal",
                    overflowWrap: "break-word",
                  }}
                >
                  <span dangerouslySetInnerHTML={{ __html: sanitizeStoryContent(paragraph.content) }} />
                  <span className="ml-2 inline-flex align-middle">
                    <SegmentCommentButton
                      inline
                      lang={locale}
                      paragraphId={paragraph.index}
                      count={paragraphCount}
                      onClick={() => openCommentPopup(paragraph.id, paragraph.index)}
                    />
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 rounded-lg bg-white p-3 shadow-sm dark:bg-gray-900">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bình luận đoạn #{paragraph.index + 1}</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={commentSort}
                        onChange={(event) => {
                          const nextSort = event.target.value as CommentSort;
                          setCommentSort(nextSort);
                          void loadParagraphComments(paragraph.id, paragraph.index, true);
                        }}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-800"
                      >
                        <option value="newest">Mới nhất</option>
                        <option value="helpful">Hữu ích</option>
                        <option value="all">Tất cả</option>
                      </select>
                      <button
                        onClick={() => setOpenParagraphId(null)}
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        aria-label="Đóng bình luận"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {comments.length ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="rounded-md bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800">
                          <div className="flex items-start gap-2">
                            <img
                              src={comment.authorAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorName}`}
                              alt={comment.authorName}
                              className="h-8 w-8 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-gray-700 dark:text-gray-200">{comment.authorName}</p>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                  {new Date(comment.createdAt).toLocaleDateString('vi-VN', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <p className="mt-1 text-gray-600 dark:text-gray-300">{comment.content}</p>
                            </div>
                          </div>
                          <div className="mt-2 ml-10 flex flex-wrap items-center gap-2 text-[11px]">
                            <button
                              onClick={() => void toggleReaction(comment.id, "helpful", paragraph.id)}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                              aria-label={`Hữu ích ${comment.reactions?.helpful || 0}`}
                              title="Hữu ích"
                            >
                              <Lightbulb className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px] font-semibold leading-none">{comment.reactions?.helpful || 0}</span>
                            </button>
                            <button
                              onClick={() => void toggleReaction(comment.id, "like", paragraph.id)}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                              aria-label={`Thích ${comment.reactions?.like || 0}`}
                              title="Thích"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px] font-semibold leading-none">{comment.reactions?.like || 0}</span>
                            </button>
                            <button
                              onClick={() => void toggleReaction(comment.id, "love", paragraph.id)}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                              aria-label={`Yêu thích ${comment.reactions?.love || 0}`}
                              title="Yêu thích"
                            >
                              <Heart className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px] font-semibold leading-none">{comment.reactions?.love || 0}</span>
                            </button>
                            <button
                              onClick={() =>
                                setReplyTargetByParagraph((prev) => ({
                                  ...prev,
                                  [paragraph.id]: comment.id,
                                }))
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/20"
                              aria-label="Trả lời"
                              title="Trả lời"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => void handleReportComment(comment.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                              aria-label="Báo xấu"
                              title="Báo xấu"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {(comment.replies?.length || 0) > 0 ? (
                            <div className="mt-2 space-y-1 border-l border-gray-300 pl-2 ml-10 dark:border-gray-600">
                              {(comment.replies || []).map((reply) => (
                                <div key={reply.id} className="rounded bg-white/70 px-2 py-1 dark:bg-gray-700/40">
                                  <div className="flex items-start gap-2">
                                    <img
                                      src={reply.authorAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.authorName}`}
                                      alt={reply.authorName}
                                      className="h-6 w-6 rounded-full flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold text-gray-700 dark:text-gray-200">{reply.authorName}</p>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                          {new Date(reply.createdAt).toLocaleDateString('vi-VN', { 
                                            day: '2-digit', 
                                            month: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                      <p className="text-gray-600 dark:text-gray-300">{reply.content}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {(comment.repliesCount || 0) > (comment.replies?.length || 0) ? (
                            <button
                              onClick={() => void loadMoreReplies(comment.id, paragraph.id)}
                              className="mt-2 ml-10 text-[11px] font-semibold text-blue-600 hover:underline"
                            >
                              Xem thêm phản hồi
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Chưa có bình luận nào cho đoạn này.</p>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {replyTargetByParagraph[paragraph.id] ? (
                      <div className="absolute -mt-7 rounded-md bg-blue-50 px-2 py-1 text-[11px] text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                        Đang trả lời bình luận.
                        <button
                          onClick={() =>
                            setReplyTargetByParagraph((prev) => ({
                              ...prev,
                              [paragraph.id]: null,
                            }))
                          }
                          className="ml-2 font-semibold underline"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : null}
                    <input
                      value={paragraphDrafts[paragraph.id] || ""}
                      onChange={(event) =>
                        setParagraphDrafts((prev) => ({
                          ...prev,
                          [paragraph.id]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void submitParagraphComment(paragraph);
                        }
                      }}
                      onFocus={() => {
                        if (!user) {
                          openLogin();
                        }
                      }}
                      placeholder={user ? "Viết bình luận cho đoạn này..." : "Đăng nhập để bình luận..."}
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
          const isExternal = /^https?:\/\//i.test(item.ad.targetUrl);
          const adHref = isExternal
            ? item.ad.targetUrl
            : item.ad.targetUrl.startsWith('/')
              ? item.ad.targetUrl
              : `/${item.ad.targetUrl}`;

          return (
            <div key={item.id} className="mb-8 flex justify-center">
              <a
                href={adHref}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer' : undefined}
                className="group relative block w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-3 shadow-sm transition hover:shadow-md dark:bg-gray-900"
              >
                <span className="absolute right-3 top-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {locale === 'en' ? 'Sponsored' : 'Tài trợ'}
                </span>
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-gray-800">
                    <img src={item.ad.imageUrl} alt={item.ad.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{item.ad.partnerName}</p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-bold text-gray-900 dark:text-gray-100">{item.ad.title}</h3>
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-blue-600 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white transition group-hover:bg-blue-700">
                        {locale === 'en' ? 'Shop now' : 'Mua ngay'}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          );
        }
      })}

      {/* Report Modal */}
      {reportingCommentId && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setReportingCommentId(null);
              setReportReason("");
            }
          }}
        >
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Báo cáo bình luận</h3>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Vui lòng mô tả lý do báo cáo..."
                rows={4}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setReportingCommentId(null);
                    setReportReason("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Hủy
                </button>
                <button
                  onClick={submitReport}
                  disabled={!reportReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Gửi báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

