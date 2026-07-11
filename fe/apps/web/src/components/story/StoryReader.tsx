"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Heart, Lightbulb, Reply, Send, ThumbsUp, X } from "lucide-react";
import DOMPurify from "dompurify";
import { useLocale } from "next-intl";

import { apiClient } from "@/lib/api/api-client";
import { unwrapData } from "@/lib/api/unwrap";
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
  paragraphAnchor?: string | null;
  paragraphIndex?: number | null;
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
  anchor: string;
};

type ParagraphCommentsResponse = {
  comments?: Array<{
    id?: string;
    content?: string;
    createdAt?: string;
    paragraphAnchor?: string | null;
    paragraphIndex?: number | null;
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

// Quy định: mỗi đoạn văn tối thiểu 250 từ (gộp lại nếu nhỏ hơn).
const MIN_PARAGRAPH_WORDS = 250;

const countWords = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t ? t.split(" ").filter(Boolean).length : 0;
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Giải mã entity HTML phổ biến để escape lại đúng một lần (tránh &amp;amp;).
const decodeHtmlEntities = (text: string) =>
  text
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/&#(\d+);/g, (match, dec: string) => {
      const code = Number(dec);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

// Anchor theo nội dung — PHẢI trùng khớp tuyệt đối với backfill phía BE.
const normFull = (s: string) => s
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase();
const makeAnchor = (s: string) => normFull(s).slice(0, 100); // anchor lưu = 100 ký tự chuẩn hoá đầu

// Text thuần: gom câu thành đoạn >= minWords, tách ở ranh giới câu cho dễ đọc.
const chunkTextToParagraphs = (text: string, minWords: number): string[] => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Tách câu KHÔNG dùng lookbehind (Safari <16.4 / iOS15 báo lỗi cú pháp lúc parse):
  // đánh dấu khoảng trắng ngay sau dấu kết câu rồi split — giữ nguyên dấu ở cuối câu.
  const sentences = clean
    .replace(/([.!?…])(\s+)/gu, "$1\u0000")
    .split("\u0000")
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buffer = "";
  let words = 0;
  for (const sentence of sentences) {
    buffer = buffer ? `${buffer} ${sentence}` : sentence;
    words += countWords(sentence);
    if (words >= minWords) {
      chunks.push(buffer);
      buffer = "";
      words = 0;
    }
  }
  if (buffer) {
    if (chunks.length) chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${buffer}`;
    else chunks.push(buffer);
  }
  return chunks;
};

// HTML có sẵn: gộp các block liên tiếp cho tới khi đạt >= minWords.
const mergeBlocksByWords = (blocks: string[], minWords: number): string[] => {
  const merged: string[] = [];
  let buffer = "";
  let words = 0;
  for (const block of blocks) {
    buffer += block;
    words += getPlainTextWordCount(block);
    if (words >= minWords) {
      merged.push(buffer);
      buffer = "";
      words = 0;
    }
  }
  if (buffer) {
    if (merged.length) merged[merged.length - 1] += buffer;
    else merged.push(buffer);
  }
  return merged;
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
    // Không có block <p>/<div>. Nếu còn thẻ inline (a/b/i/em/strong) thì GIỮ định dạng
    // + link như code cũ: tách theo <br>/xuống dòng, bọc lại thành block rồi gộp >= 250 từ
    // (mergeBlocksByWords không escape nên không double-escape).
    const hasInlineTags = /<(a|b|i|em|strong)\b/i.test(normalizedHtml);
    if (hasInlineTags) {
      const segments = normalizedHtml
        .split(/\n{2,}|<br\s*\/?>/gi)
        .map((segment) => segment.trim())
        .filter(hasVisibleContent)
        .map((segment) => (/^<(p|div)\b/i.test(segment) ? segment : `<p>${segment}</p>`));
      parts = mergeBlocksByWords(segments, MIN_PARAGRAPH_WORDS);
    } else {
      // Text thuần (truyện import từ .doc/.pdf): chia theo câu thành đoạn >= 250 từ.
      const plain = normalizedHtml
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Giải mã entity trước rồi escape đúng MỘT lần (tránh &amp;amp;).
      // Không bọc <p> (block) để icon comment nằm cùng dòng với chữ cuối đoạn.
      parts = chunkTextToParagraphs(decodeHtmlEntities(plain), MIN_PARAGRAPH_WORDS).map((text) =>
        escapeHtml(text),
      );
    }
  } else {
    // HTML có sẵn: gộp đoạn nhỏ để mỗi đoạn >= 250 từ.
    parts = mergeBlocksByWords(parts, MIN_PARAGRAPH_WORDS);
  }

  return parts.map((part, index) => ({
    id: `${chapterId}-p-${index}`,
    index,
    content: part,
    anchor: makeAnchor(part),
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
  const isEn = locale === "en";
  const insertionFrequency = useAdInsertionFrequency(Math.max(1, Math.floor(adInterval || 1000)));
  const isYoutubeUnlockAd = Boolean(unlockAd?.youtubeId);
  const unlockAdCountdown = Math.max(
    0,
    Number(
      unlockAd?.youtubePlayTime
      ?? unlockAd?.countdownSeconds
      ?? unlockCountdownSeconds
      ?? 5,
    ),
  );
  // Ad-unlock modal state
  const [showAdModal, setShowAdModal] = useState(false);
  const [countdown, setCountdown] = useState<number>(Math.floor(unlockAdCountdown));
  const [xVisible, setXVisible] = useState(false);
  const [isVideoStarted, setIsVideoStarted] = useState(false);
  const shouldStartCountdown = !isYoutubeUnlockAd || isVideoStarted;
  const unlockButtonLabel = isYoutubeUnlockAd
    ? isVideoStarted
      ? (isEn ? "Ad playing" : "Đang phát quảng cáo")
      : (isEn ? "Play ad" : "Phát quảng cáo")
    : (isEn ? "View ad" : "Xem quảng cáo");
  const [adUnlockedLocally, setAdUnlockedLocally] = useState(false);
  const [isInUnlockCooldown, setIsInUnlockCooldown] = useState(false);
  const [openParagraphId, setOpenParagraphId] = useState<string | null>(null);
  const [paragraphDrafts, setParagraphDrafts] = useState<Record<string, string>>({});
  const [replyTargetByParagraph, setReplyTargetByParagraph] = useState<Record<string, string | null>>({});
  const [allParagraphComments, setAllParagraphComments] = useState<InlineComment[]>([]);
  const [isSubmittingParagraph, setIsSubmittingParagraph] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>("newest");
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const activeAds = useActiveAdvertisements({ limit: 10 });
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const forcedRedirectRef = useRef(false);
  const openedTargetRef = useRef(false);
  
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

  // Nhóm bình luận đã tải (cấp chương) vào từng đoạn theo NỘI DUNG (anchor), fallback index.
  // Nhờ vậy comment không mất khi đoạn bị chia lại (index đổi) — dùng cho cả popup lẫn badge.
  // Mỗi comment gán vào TỐI ĐA một đoạn: khớp anchor đầu tiên theo thứ tự tài liệu; nếu không
  // khớp anchor thì fallback theo index; không khớp gì thì bỏ. Sắp xếp theo commentSort tại client.
  const groupedComments = useMemo(() => {
    // Chuẩn hoá nội dung mỗi đoạn MỘT lần (không chạy normFull lại cho từng comment).
    const normById = new Map<string, string>();
    const byIndex = new Map<number, ParagraphItem>();
    for (const paragraph of renderedParagraphs) {
      normById.set(paragraph.id, normFull(paragraph.content));
      byIndex.set(paragraph.index, paragraph);
    }

    // Sắp xếp client-side theo lựa chọn hiện tại (không refetch khi đổi sort).
    const ordered = [...allParagraphComments];
    if (commentSort === "newest") {
      ordered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (commentSort === "helpful") {
      ordered.sort((a, b) => (b.reactions?.helpful || 0) - (a.reactions?.helpful || 0));
    }
    // "all": giữ nguyên thứ tự server trả về.

    const map: Record<string, InlineComment[]> = {};
    for (const paragraph of renderedParagraphs) map[paragraph.id] = [];

    // Một lượt duyệt comment (không lọc lại theo từng đoạn), giữ thứ tự đã sắp trong mỗi đoạn.
    for (const comment of ordered) {
      let targetId: string | null = null;
      if (comment.paragraphAnchor) {
        for (const paragraph of renderedParagraphs) {
          if (normById.get(paragraph.id)?.includes(comment.paragraphAnchor)) {
            targetId = paragraph.id;
            break;
          }
        }
      }
      if (!targetId && comment.paragraphIndex != null) {
        targetId = byIndex.get(comment.paragraphIndex)?.id ?? null;
      }
      if (targetId) map[targetId].push(comment);
    }

    return map;
  }, [renderedParagraphs, allParagraphComments, commentSort]);

  // Manage ad modal lifecycle: show on first load if chapter is locked by ad
  useEffect(() => {
    setAdUnlockedLocally(false);
    setIsInUnlockCooldown(false);
    forcedRedirectRef.current = false;
    openedTargetRef.current = false;
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
        setCountdown(Math.floor(unlockAdCountdown));
        setXVisible(false);
        setIsVideoStarted(false);
        setIsInUnlockCooldown(false);
      } else {
        setShowAdModal(false);
        setIsInUnlockCooldown(true);
        const remainingMs = reappearMs - (now - last);
        timeoutId = setTimeout(() => {
          setIsInUnlockCooldown(false);
          setShowAdModal(true);
          setCountdown(Math.floor(unlockAdCountdown));
          setXVisible(false);
          setIsVideoStarted(false);
        }, Math.max(0, remainingMs));
      }
    } catch {
      // ignore localStorage errors
      setShowAdModal(true);
      setCountdown(Math.floor(unlockAdCountdown));
      setXVisible(false);
      setIsVideoStarted(false);
      setIsInUnlockCooldown(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, isLocked, unlockAd, unlockAdCountdown, unlockReappearMinutes]);

  // Countdown effect
  useEffect(() => {
    if (!showAdModal) return;
    if (!shouldStartCountdown) {
      setCountdown(Math.floor(unlockAdCountdown));
      setXVisible(false);
      return;
    }
    if (unlockAdCountdown <= 0) {
      setXVisible(true);
      return;
    }

    setCountdown(Math.floor(unlockAdCountdown));
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
  }, [showAdModal, shouldStartCountdown, unlockAdCountdown]);

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

  const handleNavigateTarget = () => {
    if (!unlockAd) return;
    if (openedTargetRef.current) return;
    const url = unlockAd.targetUrl || '/';
    try {
      const isExternal = /^https?:\/\//i.test(url);
      const href = isExternal ? url : (url.startsWith('/') ? url : `/${url}`);
      const opened = window.open(href, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.href = href;
      } else {
        openedTargetRef.current = true;
      }
      openedTargetRef.current = true;
    } catch {
      window.location.href = url;
      openedTargetRef.current = true;
    }
  };

  const handleRedirectAndUnlock = async () => {
    if (!unlockAd) return;
    // Open target immediately in the current click gesture so popup is not blocked.
    handleNavigateTarget();

    void apiClient.post(`/ads/${unlockAd.id}/click`).catch(() => {});
    try {
      await apiClient.post(`/chapters/${chapterId}/unlock-by-ad`, { adId: unlockAd.id });
      onAdUnlocked?.();
    } catch {
      onAdUnlocked?.();
    }

    markAdClosed(unlockAd.id);
    setAdUnlockedLocally(true);
    setShowAdModal(false);
  };

  const handleWatchAd = async () => {
    if (!unlockAd) return;
    if (unlockAd.youtubeId && youtubeIframeRef.current) {
      const src = `https://www.youtube.com/embed/${unlockAd.youtubeId}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1`;
      youtubeIframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        'https://www.youtube.com',
      );
      if (!youtubeIframeRef.current.src) {
        youtubeIframeRef.current.src = src;
      }
      setIsVideoStarted(true);
      return;
    }
    await handleRedirectAndUnlock();
  };

  const handleCloseAd = () => {
    if (!unlockAd) return;
    if (unlockAd.isForcedRedirect) {
      return;
    }
    if (unlockAd.youtubeId && youtubeIframeRef.current) {
      youtubeIframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        'https://www.youtube.com',
      );
    }
    markAdClosed(unlockAd.id);
    setAdUnlockedLocally(true);
    setShowAdModal(false);
  };

  useEffect(() => {
    if (!showAdModal || !unlockAd?.isForcedRedirect) return;
    if (!shouldStartCountdown || countdown > 0) return;
    if (forcedRedirectRef.current) return;

    forcedRedirectRef.current = true;
    void handleRedirectAndUnlock();
  }, [countdown, showAdModal, shouldStartCountdown, unlockAd?.isForcedRedirect]);

  // Tải TẤT CẢ bình luận đoạn của chương MỘT lần (nhóm theo anchor phía client), thay cho
  // fetch từng đoạn theo index — index đổi khi chia lại đoạn sẽ làm mất comment cũ.
  useEffect(() => {
    if (!chapterId) return;

    let active = true;
    const loadAllParagraphComments = async () => {
      try {
        const response = await apiClient.get<ParagraphCommentsResponse>(`/chapters/${chapterId}/comments`, {
          params: {
            scope: "paragraph",
            allParagraphs: true,
            page: 1,
            limit: 1000,
          },
        });
        const rawComments = unwrapData<ParagraphCommentsResponse>(response?.data)?.comments || [];
        if (active) setAllParagraphComments(normalizeComments(rawComments));
      } catch {
        if (active) setAllParagraphComments([]);
      }
    };

    void loadAllParagraphComments();
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

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
      paragraphAnchor: item.paragraphAnchor ?? null,
      paragraphIndex: typeof item.paragraphIndex === "number" ? item.paragraphIndex : null,
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

  const openCommentPopup = (paragraph: ParagraphItem) => {
    setOpenParagraphId((prev) => (prev === paragraph.id ? null : paragraph.id));
  };

  const toggleReaction = async (
    commentId: string,
    type: "helpful" | "like" | "love",
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

      setAllParagraphComments((prev) =>
        prev.map((comment) => ({
          ...updateOne(comment),
          replies: (comment.replies || []).map(updateOne),
        })),
      );
    } catch {
      // no-op for reaction errors
    }
  };

  const loadMoreReplies = async (commentId: string) => {
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

      setAllParagraphComments((prev) => prev.map(mergeReplies));
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
        paragraphIndex: paragraph.index, // giữ index cho tương thích cũ
        paragraphAnchor: paragraph.anchor, // neo theo nội dung
        parentId,
      });

      const created = response?.data?.data;
      const newComment: InlineComment = {
        id: created?.id || `${paragraph.id}-${Date.now()}`,
        content: created?.content || contentValue,
        authorName: created?.user?.displayName || created?.user?.name || "Bạn",
        authorAvatarUrl: created?.user?.avatarUrl,
        createdAt: created?.createdAt || new Date().toISOString(),
        paragraphAnchor: paragraph.anchor,
        paragraphIndex: paragraph.index,
        reactions: {
          helpful: 0,
          like: 0,
          love: 0,
        },
        replies: [],
        repliesCount: 0,
      };

      // Thêm vào danh sách cấp chương: comment mới có anchor + index nên tự nhóm lại
      // đúng đoạn vừa bấm và tăng badge của đoạn đó.
      setAllParagraphComments((prev) =>
        parentId
          ? appendReplyToComment(prev, parentId, newComment)
          : [...prev, newComment],
      );
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
    setAllParagraphComments([]);
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
          display: inline;
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
          // Popup list + badge đều lấy từ nhóm theo anchor (cấp chương).
          const comments = groupedComments[paragraph.id] || [];
          const isOpen = openParagraphId === paragraph.id;
          const paragraphCount = comments.length;

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
                      onClick={() => openCommentPopup(paragraph)}
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
                          setCommentSort(event.target.value as CommentSort);
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
                              onClick={() => void toggleReaction(comment.id, "helpful")}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-[#303133] dark:text-gray-300 dark:hover:bg-[#464749]"
                              aria-label={`Hữu ích ${comment.reactions?.helpful || 0}`}
                              title="Hữu ích"
                            >
                              <Lightbulb className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px] font-semibold leading-none">{comment.reactions?.helpful || 0}</span>
                            </button>
                            <button
                              onClick={() => void toggleReaction(comment.id, "like")}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-300 px-1.5 text-gray-600 hover:bg-white dark:border-[#303133] dark:text-gray-300 dark:hover:bg-[#464749]"
                              aria-label={`Thích ${comment.reactions?.like || 0}`}
                              title="Thích"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px] font-semibold leading-none">{comment.reactions?.like || 0}</span>
                            </button>
                            <button
                              onClick={() => void toggleReaction(comment.id, "love")}
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
                              onClick={() => void loadMoreReplies(comment.id)}
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
        <div className="absolute inset-x-0 top-3 z-20 flex items-start justify-center p-3 sm:top-4 sm:p-4">
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
              {xVisible && !unlockAd.isForcedRedirect ? (
                <button
                  onClick={handleCloseAd}
                  className="inline-flex h-8 w-14 items-center justify-center rounded-md border border-pink-200 bg-pink-50 text-sm font-bold text-pink-700 hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-900/20 dark:text-pink-200"
                >
                  X
                </button>
              ) : (
                <div className="inline-flex h-8 w-14 items-center justify-center rounded-md bg-pink-50 text-sm font-bold text-pink-600 tabular-nums dark:bg-pink-900/20 dark:text-pink-200">
                  {shouldStartCountdown ? `${countdown}s` : "--"}
                </div>
              )}
            </div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#323234]">
              <div
                className="h-full bg-pink-500 transition-all"
                style={{ width: `${shouldStartCountdown ? ((unlockAdCountdown - countdown) / Math.max(1, unlockAdCountdown)) * 100 : 0}%` }}
              />
            </div>

            <div className="flex flex-col items-center gap-4 text-center">
              {unlockAd.youtubeId ? (
                <div className="relative w-full overflow-hidden rounded-md bg-black aspect-video">
                  <iframe
                    ref={youtubeIframeRef}
                    src={`https://www.youtube.com/embed/${unlockAd.youtubeId}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1`}
                    title={unlockAd.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                  <button
                    type="button"
                    onClick={() => { void handleRedirectAndUnlock(); }}
                    className="absolute inset-0 z-10 bg-transparent"
                    aria-label={isEn ? "Open ad destination" : "Mở trang đích quảng cáo"}
                  />
                </div>
              ) : (
                <button type="button" onClick={() => { void handleRedirectAndUnlock(); }} className="w-full">
                  <img
                    src={unlockAd.imageUrl || "https://placehold.co/640x320?text=Ad"}
                    alt={unlockAd.title}
                    className="w-full h-auto max-h-[60vh] rounded-md object-contain"
                  />
                </button>
              )}
              <button type="button" onClick={() => { void handleRedirectAndUnlock(); }}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:underline">{unlockAd.title}</h3>
              </button>
              <p className="text-sm text-gray-600 dark:text-gray-300">{unlockAd.partnerName}</p>

              <div className="mt-4 flex w-full items-center justify-center">
                <button
                  onClick={handleWatchAd}
                  className="w-full rounded-md bg-pink-600 px-4 py-3 text-sm font-bold text-white hover:bg-pink-700"
                >
                  {unlockButtonLabel}
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
