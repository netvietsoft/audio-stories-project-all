"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Heart, Lightbulb, Reply, Send, ThumbsUp, X } from "lucide-react";
import DOMPurify from "dompurify";
import { useLocale } from "next-intl";

import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import SegmentCommentButton from "@/components/story/SegmentCommentButton";
import InlineAdvertisementCard from "@/components/ads/InlineAdvertisementCard";
import { useActiveAdvertisements } from "@/hooks/use-active-advertisements";
import { useAdInsertionFrequency } from "@/hooks/use-ad-insertion-frequency";
import type { AdvertisementItem } from "@/types/advertisement";

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

type CreatedCommentResponse = {
  id?: string;
  content?: string;
  createdAt?: string;
  user?: {
    displayName?: string;
    name?: string;
    avatarUrl?: string | null;
  };
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
  previewPercent?: number;
  lockLabel?: string;
  onUnlockRequest?: () => void;
  // Unlock-by-ad props
  unlockAd?: AdvertisementItem | null;
  unlockReappearMinutes?: number; // minutes until ad reappears after closed
  unlockCountdownSeconds?: number; // seconds before [x] appears
  onAdUnlocked?: () => void;
};

const normalizeStoryContent = (rawHtml: string) =>
  rawHtml
    .replace(/&nbs[p]?;?/gi, " ")
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
  return stripped.replace(/&nbs[p]?;?|\u00A0/gi, "").trim().length > 0;
};

const splitParagraphs = (chapterId: string, content: string | null | undefined): ParagraphItem[] => {
  if (!content) return [];
  const normalizedHtml = normalizeStoryContent(content);
  const blockRegex = /<(p|div)\b[^>]*>[\s\S]*?<\/\1>/gi;
  const blocks = normalizedHtml.match(blockRegex) || [];

  let parts: string[] = blocks
    .map((block) => block.trim())
    .filter(hasVisibleContent);

  if (parts.length === 0) {
    parts = normalizedHtml
      .split(/\n{2,}|<br\s*\/?>/gi)
      .map((part) => part.trim())
      .filter(hasVisibleContent)
      .map((part) => (part.startsWith("<") ? part : `<p>${part}</p>`));
  }

  return parts.map((part, index) => ({
    id: `${chapterId}-p-${index}`,
    index,
    content: part,
  }));
};

const getPlainTextWordCount = (html: string) => {
  const normalized = normalizeStoryContent(html)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
};

export default function StoryReader({
  chapterId,
  content,
  adInterval = 1000,
  isLocked = false,
  previewChars = 500,
  previewPercent = 0.1,
  lockLabel,
  onUnlockRequest,
  unlockAd = null,
  unlockReappearMinutes = 15,
  unlockCountdownSeconds = 5,
  onAdUnlocked,
}: StoryReaderProps) {
  const locale = useLocale();
  const insertionFrequency = useAdInsertionFrequency(Math.max(1, Math.floor(adInterval || 1000)));
  // Ad-unlock modal state
  const [showAdModal, setShowAdModal] = useState(false);
  const [countdown, setCountdown] = useState<number>(unlockCountdownSeconds || 5);
  const [xVisible, setXVisible] = useState(false);
  const [adUnlockedLocally, setAdUnlockedLocally] = useState(false);
  const [isInUnlockCooldown, setIsInUnlockCooldown] = useState(false);
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
  const activeAds = useActiveAdvertisements({ limit: 10 });
  
  const user = useUserStore((state) => state.user);
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const isProd = process.env.NODE_ENV === "production";

  const paragraphs = useMemo(() => {
    if (!chapterId) return [];
    return splitParagraphs(chapterId, content);
  }, [chapterId, content]);

  const renderedParagraphs = useMemo(() => {
    return paragraphs;
  }, [paragraphs]);

  // Manage ad modal lifecycle: show on first load if chapter is locked by ad
  useEffect(() => {
    setAdUnlockedLocally(false);
    setIsInUnlockCooldown(false);
    if (!isLocked || !unlockAd || !chapterId) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const storageKey = 'unlock_ad_last_closed_map';
      const raw = localStorage.getItem(storageKey);
      const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const last = Number(map[chapterId] || 0);
      const now = Date.now();
      const reappearMs = (unlockReappearMinutes || 15) * 60 * 1000;
      if (!last || now - last >= reappearMs) {
        setShowAdModal(true);
        setCountdown(unlockCountdownSeconds || 5);
        setXVisible(false);
        setIsInUnlockCooldown(false);
      } else {
        setShowAdModal(false);
        setIsInUnlockCooldown(true);
        const remainingMs = reappearMs - (now - last);
        timeoutId = setTimeout(() => {
          setIsInUnlockCooldown(false);
          setShowAdModal(true);
          setCountdown(unlockCountdownSeconds || 5);
          setXVisible(false);
        }, Math.max(0, remainingMs));
      }
    } catch {
      // ignore localStorage errors
      setShowAdModal(true);
      setCountdown(unlockCountdownSeconds || 5);
      setXVisible(false);
      setIsInUnlockCooldown(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, unlockAd, chapterId, unlockReappearMinutes, unlockCountdownSeconds]);

  // Countdown effect
  useEffect(() => {
    if (!showAdModal) return;
    if ((unlockCountdownSeconds || 0) <= 0) {
      setXVisible(true);
      return;
    }

    setCountdown(unlockCountdownSeconds || 5);
    setXVisible(false);
    const iv = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setXVisible(true);
          clearInterval(iv);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [showAdModal, unlockCountdownSeconds]);

  const markAdClosed = (adId?: string) => {
    if (!adId || !chapterId) return;
    try {
      const storageKey = 'unlock_ad_last_closed_map';
      const raw = localStorage.getItem(storageKey);
      const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      map[chapterId] = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(map));
      setIsInUnlockCooldown(true);
    } catch {
      // ignore
    }
  };

  const handleWatchAd = async () => {
    if (!unlockAd) return;
    const url = unlockAd.targetUrl || '/';
    void apiClient.post(`/ads/${unlockAd.id}/click`).catch(() => {});
    // open destination
    try {
      const isExternal = /^https?:\/\//i.test(url);
      if (isExternal) {
        window.open(url, '_blank', 'noopener');
      } else {
        window.location.href = url;
      }
    } catch {
      // fallback navigation
      window.location.href = url;
    }

    // Try to notify backend about ad-unlock (best-effort)
    try {
      await apiClient.post(`/chapters/${chapterId}/unlock-by-ad`, { adId: unlockAd.id });
      // notify parent
      onAdUnlocked?.();
    } catch {
      // ignore server errors; still unlock locally
      onAdUnlocked?.();
    }

    markAdClosed(unlockAd.id);
    setAdUnlockedLocally(true);
    setShowAdModal(false);
  };

  const handleCloseAd = () => {
    if (!unlockAd) return;
    markAdClosed(unlockAd.id);
    setAdUnlockedLocally(true);
    setShowAdModal(false);
  };

  // Load comment counts for all paragraphs on mount
  useEffect(() => {
    if (!chapterId || renderedParagraphs.length === 0) return;

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
  }, [chapterId, renderedParagraphs.length]);

  const flowItems = useMemo(() => {
    const items: Array<
      | { type: "paragraph"; paragraph: ParagraphItem }
      | { type: "ad"; id: string; ad: AdvertisementItem }
    > = [];

    const inlineAds = activeAds.filter((ad) => (ad.routeType ?? 1) === 1);
    if (renderedParagraphs.length === 0) return items;
    const threshold = Math.max(1, Math.floor(insertionFrequency || 1000));
    let wordCounter = 0;
    let adIndex = 0;

    renderedParagraphs.forEach((paragraph) => {
      items.push({ type: "paragraph", paragraph });
      wordCounter += getPlainTextWordCount(paragraph.content);
      const shouldInsertAd = inlineAds.length > 0 && adIndex < inlineAds.length && wordCounter >= threshold;
      if (shouldInsertAd) {
        const ad = inlineAds[adIndex];
        if (!ad) return;
        items.push({
          type: 'ad',
          id: `${paragraph.id}-slot-${adIndex}`,
          ad,
        });
        adIndex += 1;
        wordCounter = 0;
      }
    });

    return items;
  }, [activeAds, insertionFrequency, renderedParagraphs]);

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
      const response = await apiClient.post<{ data?: CreatedCommentResponse }>(`/chapters/${chapterId}/comments`, {
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

  if (!renderedParagraphs.length) {
    return null;
  }

  const effectiveIsLocked = isLocked && !adUnlockedLocally && !(!!unlockAd && isInUnlockCooldown);
  const shouldBlurContent = effectiveIsLocked;

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
      <div className="relative">
      <div
        key={`${chapterId || "chapter"}-${effectiveIsLocked ? "locked" : "open"}`}
        className={`relative min-w-0 overflow-x-hidden ${isProd ? "select-none" : ""} ${
          shouldBlurContent ? "blur-sm select-none pointer-events-none overflow-hidden" : ""
        }`}
      >
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
                  className="story-paragraph-content rounded-lg px-1 py-2 text-base sm:text-lg leading-relaxed text-gray-800 transition-colors sm:px-4 sm:py-2.5 md:px-5 md:py-3 dark:text-gray-100 text-justify"
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
                <div className="mt-3 rounded-lg bg-white p-3 shadow-sm dark:bg-[#242526]">
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
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] dark:border-[#303133] dark:bg-[#3a3b3c]"
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
                        <div key={comment.id} className="rounded-md bg-gray-50 px-3 py-2 text-xs dark:bg-[#3a3b3c]">
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
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-[#303133] dark:text-gray-300 dark:hover:bg-[#464749]"
                              aria-label={`Hữu ích ${comment.reactions?.helpful || 0}`}
                              title="Hữu ích"
                            >
                              <Lightbulb className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px] font-semibold leading-none">{comment.reactions?.helpful || 0}</span>
                            </button>
                            <button
                              onClick={() => void toggleReaction(comment.id, "like", paragraph.id)}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-[#303133] dark:text-gray-300 dark:hover:bg-[#464749]"
                              aria-label={`Thích ${comment.reactions?.like || 0}`}
                              title="Thích"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px] font-semibold leading-none">{comment.reactions?.like || 0}</span>
                            </button>
                            <button
                              onClick={() => void toggleReaction(comment.id, "love", paragraph.id)}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-[#303133] dark:text-gray-300 dark:hover:bg-[#464749]"
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
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-pink-300 text-pink-600 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-300 dark:hover:bg-pink-900/20"
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
                            <div className="mt-2 space-y-1 border-l border-gray-300 pl-2 ml-10 dark:border-[#303133]">
                              {(comment.replies || []).map((reply) => (
                                <div key={reply.id} className="rounded bg-white/70 px-2 py-1 dark:bg-[#3a3b3c]/60">
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
                              className="mt-2 ml-10 text-[11px] font-semibold text-pink-600 hover:underline"
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
                      <div className="absolute -mt-7 rounded-md bg-pink-50 px-2 py-1 text-[11px] text-pink-700 dark:bg-pink-900/20 dark:text-pink-300">
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
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs outline-none focus:border-pink-500 dark:border-[#303133] dark:bg-[#3a3b3c]"
                    />
                    <button
                      onClick={() => void submitParagraphComment(paragraph)}
                      disabled={isSubmittingParagraph}
                      className="rounded-md bg-pink-600 px-3 py-2 text-white hover:bg-pink-700 disabled:opacity-50"
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
            <div key={item.id} className="mb-8 flex justify-center">
              <InlineAdvertisementCard ad={item.ad} className="max-w-2xl" />
            </div>
          );
        }
      })}
      </div>
      {effectiveIsLocked && !unlockAd ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => onUnlockRequest?.()}
            className="rounded-2xl border border-pink-200 bg-white/95 px-5 py-4 text-center shadow-lg backdrop-blur-sm transition hover:bg-white"
          >
            <p className="text-sm font-semibold text-pink-700">{lockLabel || "Nội dung đang bị khóa"}</p>
            <p className="mt-1 text-xs text-gray-600">Bấm để mở khóa</p>
          </button>
        </div>
      ) : null}
      </div>

      {/* Ad Unlock Modal Overlay */}
      {showAdModal && unlockAd ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 mx-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1f1f1f]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-300">{lockLabel || "Mở khóa bằng quảng cáo"}</span>
              {xVisible ? (
                <button
                  onClick={handleCloseAd}
                  className="inline-flex h-8 w-14 items-center justify-center rounded-md border border-pink-200 bg-pink-50 text-sm font-bold text-pink-700 hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-900/20 dark:text-pink-200"
                >
                  X
                </button>
              ) : (
                <div className="inline-flex h-8 w-14 items-center justify-center rounded-md bg-pink-50 text-sm font-bold text-pink-600 tabular-nums dark:bg-pink-900/20 dark:text-pink-200">
                  {`${countdown}s`}
                </div>
              )}
            </div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#323234]">
              <div
                className="h-full bg-pink-500 transition-all"
                style={{ width: `${((unlockCountdownSeconds || 5) - countdown) / Math.max(1, unlockCountdownSeconds || 5) * 100}%` }}
              />
            </div>

            <div className="flex flex-col items-center gap-4 text-center">
              <img
                src={unlockAd.imageUrl || "https://placehold.co/640x320?text=Ad"}
                alt={unlockAd.title}
                className="w-full h-auto max-h-[60vh] rounded-md object-contain"
              />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{unlockAd.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{unlockAd.partnerName}</p>

              <div className="mt-4 flex w-full items-center justify-center">
                <button
                  onClick={handleWatchAd}
                  className="w-full rounded-md bg-pink-600 px-4 py-3 text-sm font-bold text-white hover:bg-pink-700"
                >
                  Xem quảng cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
            <div className="bg-white dark:bg-[#3a3b3c] rounded-2xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Báo cáo bình luận</h3>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Vui lòng mô tả lý do báo cáo..."
                rows={4}
                className="w-full border border-gray-300 dark:border-[#303133] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 dark:bg-[#3a3b3c] dark:text-white resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setReportingCommentId(null);
                    setReportReason("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#303133] rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-[#464749]"
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
    </>
  );
}
