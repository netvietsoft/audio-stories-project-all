"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isAxiosError } from "axios";
import Link from "@/components/shared/LocalizedLink";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronDown,
  CreditCard,
  ListMusic,
  Lock,
  Heart,
  Star,
  ThumbsUp,
  Smile,
  Gift,
  Zap,
  Clock3,
  ArrowRight,
  Coins,
  LockOpen,
  Headphones,
} from "lucide-react";

import Image from "next/image";
import { apiClient } from "@/lib/api/api-client";
import { unwrapData, unwrapList } from "@/lib/api/unwrap";
import StoryEngagementActions from "@/components/shared/StoryEngagementActions";
import { getLocaleLabel, getLocalizedValue, getRequestedLocaleValue } from "@/lib/story-localization";
import { cleanChapterTitle, formatChapterTitle } from "@/lib/formatChapterTitle";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { useAuth } from "@/auth/auth-provider";
import SocialLinks from "@/components/shared/SocialLinks";
import { useViewTracking } from "@/hooks/use-view-tracking";
import { useShareAction } from "@/hooks/use-share-action";
import { cycleRepeatMode } from "@/lib/player/playback-modes";
import { resolveNextPlaybackRate } from "@/lib/player/control-helpers";
import StoryAudioPlayerPanel from "@/components/player/StoryAudioPlayerPanel";
import YouTubePlayerPanel from "@/components/player/YouTubePlayerPanel";
import StoryUpdateSubscriptionButton from "@/components/shared/StoryUpdateSubscriptionButton";
import type { AdvertisementItem } from "@/types/advertisement";

const StoryReader = dynamic(() => import("@/components/story/StoryReader"));

const RecommendedSlider = dynamic(() => import("@/components/story/RecommendedSlider"));

type ChapterVariant = {
  id: string;
  id_old?: string; // For backward compatibility if needed
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  audioUrl?: string | null;
  audioUrlVi?: string | null;
  audioUrlEn?: string | null;
  audioDuration: number | null;
  hasAudio?: boolean;
  unlockPrice: number;
  orderIndex: number;
  isDefault: boolean;
  content?: string | null;
  nextChapterId?: string | null;
  nextVariantId?: string | null;
  parentId?: string | null;
};

type ChapterItem = {
  id: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  chapterNumber: number;
  thumbnailUrl?: string | null;
  updatedAt?: string | null;
  description?: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  content: string | null;
  contentVi?: string | null;
  contentEn?: string | null;
  r2AudioUrl: string | null;
  audioUrlVi?: string | null;
  audioUrlEn?: string | null;
  youtubeVideoId?: string | null;
  audioDuration: number | null;
  hasAudio?: boolean;
  accessType: "free" | "timed" | "vip" | "ads";
  unlocksAt: string | null;
  unlockPrice?: number;
  discountPercent?: number;
  isInteractive?: boolean;
  variants?: ChapterVariant[];
  // If chapter is unlocked by ad, backend will populate this
  unlockAdId?: string | null;
  unlockAd?: AdvertisementItem | null;
};

type StoryListItem = {
  id: string;
  slug: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  thumbnailUrl: string | null;
  totalViews: number;
  status: "ongoing" | "completed";
  author?: {
    name: string;
  };
};

type StoryDetail = {
  id: string;
  title: string;
  titleVi?: string | null;
  titleEn?: string | null;
  slug: string;
  description: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  averageRating: string | number;
  ratingCount: number;
  updatedAt: string;
  unlockPrice?: number;
  discountPercent?: number;
  author?: { name: string };
  categories?: Array<{
    category: {
      id: number;
      name: string;
      slug: string;
    };
  }>;
  chapters: ChapterItem[];
  isInteractive?: boolean;
};

type RecommendedResponse = {
  data: StoryListItem[];
};

type RatingStatsResponse = {
  data: {
    averageRating: number;
    ratingCount: number;
    distribution: Array<{
      rating: number;
      count: number;
    }>;
  };
};

type ReviewItem = {
  id: string;
  rating: number;
  content: string | null;
  likesCount: number;
  helpfulCount: number;
  likedByMe?: boolean;
  helpfulByMe?: boolean;
  repliesCount?: number;
  replies?: ReviewReplyItem[];
  createdAt: string;
  user?: {
    displayName?: string;
  };
};

type ReviewReplyItem = {
  id: string;
  parentId?: string | null;
  content: string;
  createdAt: string;
  user?: {
    displayName?: string;
  };
};

type ReviewsResponse = {
  data: ReviewItem[];
  meta?: {
    total?: number;
    page?: number;
    lastPage?: number;
  };
};

type ReviewSort = "newest" | "helpful" | "highest";

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const totalSeconds = Math.floor(seconds);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const formatDate = (value: string | null | undefined, locale: string, fallbackLabel: string) => {
  if (!value) return fallbackLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallbackLabel;
  return date.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatStatus = (
  status: "ongoing" | "completed" | undefined,
  labels: {
    completed: string;
    ongoing: string;
    updating: string;
  },
) => {
  if (status === "completed") return labels.completed;
  if (status === "ongoing") return labels.ongoing;
  return labels.updating;
};

const getUnlockLabel = (
  chapter: ChapterItem,
  labels: {
    vipOnly: string;
    opensFreeLater: string;
    freeUnlocked: string;
    adsLabel?: string;
  },
) => {
  if (chapter.accessType === "free") return null;
  if (chapter.accessType === "vip") return labels.vipOnly;
  if (chapter.accessType === "ads") return labels.adsLabel || "Quảng cáo";
  if (!chapter.unlocksAt) return labels.opensFreeLater;

  const msLeft = new Date(chapter.unlocksAt).getTime() - Date.now();
  if (msLeft <= 0) return labels.freeUnlocked;

  const day = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hour = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  const minute = Math.floor((msLeft / (1000 * 60)) % 60);

  if (day > 0) return `${labels.opensFreeLater}: ${day}d ${hour}h`;
  if (hour > 0) return `${labels.opensFreeLater}: ${hour}h ${minute}m`;
  return `${labels.opensFreeLater}: ${minute}m`;
};

const chapterHref = (slug: string, chapterNumber: number) => `/story/${slug}/chuong-${chapterNumber}`;

const chapterNumberFromSlug = (input: string | undefined) => {
  if (!input) return null;
  const match = input.match(/(\d+)$/);
  if (!match) return null;
  return Number(match[1]);
};

// A chapter is playable only when it actually has audio. Prefer the BE-computed
// hasAudio flag; fall back to duration for not-yet-hydrated items (matches normalizeChapter).
const chapterHasAudio = (chapter: Pick<ChapterItem, "hasAudio" | "audioDuration">) =>
  typeof chapter.hasAudio === "boolean" ? chapter.hasAudio : Number(chapter.audioDuration) > 0;

export default function StoryChapterClient() {
  const params = useParams<{ slug: string; chapterSlug: string }>();
  const router = useRouter();
  const locale = useLocale();
  const currentLang = locale === "en" ? "en" : "vi";
  const t = useTranslations("StoryChapterClient");
  const slug = params?.slug;
  const chapterSlug = params?.chapterSlug;
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareAction = useShareAction();
  const accessToken = useUserStore((state) => state.accessToken);

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [recommendedStories, setRecommendedStories] = useState<StoryListItem[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStatsResponse["data"] | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [myRating, setMyRating] = useState(5);
  const [reviewDraft, setReviewDraft] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("helpful");
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewLastPage, setReviewLastPage] = useState(1);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewReplyDrafts, setReviewReplyDrafts] = useState<Record<string, string>>({});
  const [reviewReplyTarget, setReviewReplyTarget] = useState<Record<string, string | null>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [isChapterMenuOpen, setIsChapterMenuOpen] = useState(false);
  const [chapterQuery, setChapterQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("45");
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [showTopupAction, setShowTopupAction] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unlockAdReappearMinutes, setUnlockAdReappearMinutes] = useState<number>(15);
  const [unlockAdCountdownSeconds, setUnlockAdCountdownSeconds] = useState<number>(5);
  const [chapterUnlockState, setChapterUnlockState] = useState<{
    isUnlocked: boolean;
    unlockSource: string | null;
    isTimedFree?: boolean;
  } | null>(null);
  const user = useUserStore((state) => state.user);
  const { refreshProfile } = useAuth();
  const openLogin = useAuthModalStore((state) => state.openLogin);

  // Variant states
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [unlockedVariantIds, setUnlockedVariantIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<ChapterVariant[]>([]);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [youtubeUnlockAutoPlaySignal, setYoutubeUnlockAutoPlaySignal] = useState(0);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [isGiftingCredits, setIsGiftingCredits] = useState(false);
  const [giftError, setGiftError] = useState("");
  const [isVariantDropdownOpen, setIsVariantDropdownOpen] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null);
  const [openNestedDropdowns, setOpenNestedDropdowns] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const lastRestoredHistoryKeyRef = useRef<string | null>(null);
  const hydratedChapterIdsRef = useRef<Set<string>>(new Set());


  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const volume = useAudioStore((state) => state.volume);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const isMuted = useAudioStore((state) => state.isMuted);
  const setQueue = useAudioStore((state) => state.setQueue);
  const setTrack = useAudioStore((state) => state.setTrack);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const seekTo = useAudioStore((state) => state.seekTo);
  const setVolume = useAudioStore((state) => state.setVolume);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  const loadReviews = useCallback(
    async (storyIdOrSlug: string, sort: ReviewSort, page: number, append = false) => {
      setIsLoadingReviews(true);
      try {
        const reviewsRes = await apiClient.get<ReviewsResponse>(`/stories/${storyIdOrSlug}/reviews`, {
          params: { page, limit: 5, sort },
        });
        const rows = unwrapList<ReviewItem>(reviewsRes.data);
        setReviews((prev) => (append ? [...prev, ...rows] : rows));
        setReviewPage(reviewsRes.data?.meta?.page || page);
        setReviewLastPage(reviewsRes.data?.meta?.lastPage || 1);
      } finally {
        setIsLoadingReviews(false);
      }
    },
    [],
  );

  const refreshRatingAndReviews = useCallback(
    async (storyIdOrSlug: string, sort = reviewSort) => {
      const [statsRes] = await Promise.all([
        apiClient.get<RatingStatsResponse>(`/stories/${storyIdOrSlug}/rating-stats`),
        loadReviews(storyIdOrSlug, sort, 1, false),
      ]);
      setRatingStats(unwrapData<RatingStatsResponse["data"]>(statsRes.data));
    },
    [loadReviews, reviewSort],
  );

  const normalizeVariant = useCallback(
    (variant: any): ChapterVariant => {
      // For variants, we currently don't have a dedicated API proxy yet.
      // But if we did, it would be identical to chapters.
      // In this setup, we fall back to the old string if present, or construct proxy.
      const rawAudioUrl = getLocalizedValue(
        locale,
        variant.audioUrlVi,
        variant.audioUrlEn,
        !variant.audioUrlVi && !variant.audioUrlEn ? (variant.audioUrl || variant.r2AudioUrl || "") : "",
      ).trim();

      const baseProxyUrl = `${process.env.NEXT_PUBLIC_API_URL}/chapters/${variant.chapterId || variant.id}/audio`;
      const query = new URLSearchParams();
      if (accessToken) {
        query.set("token", accessToken);
      }
      if (variant.id) {
        query.set("variantId", variant.id);
      }
      const proxyUrl = query.toString() ? `${baseProxyUrl}?${query.toString()}` : baseProxyUrl;

      return {
        ...variant,
        title: getLocalizedValue(locale, variant.titleVi, variant.titleEn, variant.title),
        content: getLocalizedValue(locale, variant.contentVi, variant.contentEn, variant.content || ""),
        audioUrl: rawAudioUrl || proxyUrl,
        // Prefer the BE-computed flag; fall back to duration for pre-deploy safety.
        hasAudio: typeof variant.hasAudio === "boolean" ? variant.hasAudio : Number(variant.audioDuration) > 0,
      };
    },
    [locale, accessToken],
  );

  const normalizeChapter = useCallback(
    (chapter: any): ChapterItem => {
      const rawAudioUrl = getLocalizedValue(
        locale,
        chapter.audioUrlVi,
        chapter.audioUrlEn,
        !chapter.audioUrlVi && !chapter.audioUrlEn ? (chapter.r2AudioUrl || chapter.audioUrl || "") : "",
      );

      const proxyUrl = accessToken
        ? `${process.env.NEXT_PUBLIC_API_URL}/chapters/${chapter.id}/audio?token=${accessToken}`
        : `${process.env.NEXT_PUBLIC_API_URL}/chapters/${chapter.id}/audio`;

      return {
        ...chapter,
        isInteractive: chapter.isInteractive,
        variants: (chapter.variants || []).map((variant: any) => normalizeVariant(variant)),
        title: getLocalizedValue(locale, chapter.titleVi, chapter.titleEn, chapter.title),
        description: getLocalizedValue(locale, chapter.descriptionVi, chapter.descriptionEn, chapter.description || ""),
        content: getLocalizedValue(locale, chapter.contentVi, chapter.contentEn, chapter.content || ""),
        r2AudioUrl: rawAudioUrl || proxyUrl,
        // Prefer the BE-computed flag; fall back to duration for pre-deploy safety.
        hasAudio: typeof chapter.hasAudio === "boolean" ? chapter.hasAudio : Number(chapter.audioDuration) > 0,
      };
    },
    [locale, normalizeVariant, accessToken],
  );

  // Initialize mounted flag for portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!slug) return;

    const fetchDetail = async () => {
      try {
        const [detailResult, recommendedResult, ratingResult, reviewsResult] = await Promise.allSettled([
          apiClient.get<StoryDetail>(`/stories/${slug}`),
          apiClient.get<RecommendedResponse>("/stories/recommended", {
            params: {
              limit: 12,
              lang: currentLang,
            },
          }),
          apiClient.get<RatingStatsResponse>(`/stories/${slug}/rating-stats`),
          apiClient.get<ReviewsResponse>(`/stories/${slug}/reviews`, {
            params: { page: 1, limit: 5, sort: "helpful" },
          }),
        ]);

        if (detailResult.status !== "fulfilled") {
          throw detailResult.reason;
        }

        const detailRes = detailResult.value;
        const recommendedData =
          recommendedResult.status === "fulfilled" ? unwrapList<StoryListItem>(recommendedResult.value.data) : [];
        const fetchedRatingStats =
          ratingResult.status === "fulfilled" ? unwrapData<RatingStatsResponse["data"]>(ratingResult.value.data) : null;
        const fetchedReviews =
          reviewsResult.status === "fulfilled" ? unwrapList<ReviewItem>(reviewsResult.value.data) : [];
        const fetchedReviewsMeta =
          reviewsResult.status === "fulfilled" ? reviewsResult.value.data?.meta : undefined;

        const detail = unwrapData<StoryDetail>(detailRes.data);
        if (!detail) {
          throw new Error("Story detail not found");
        }
        const normalizedDetail: StoryDetail = {
          ...detail,
          isInteractive: detail.isInteractive,
          title: getLocalizedValue(locale, detail.titleVi, detail.titleEn, detail.title),
          description: getLocalizedValue(locale, detail.descriptionVi, detail.descriptionEn, detail.description),
          chapters: (detail.chapters || []).map((chapter) => normalizeChapter(chapter)),
        };

        const normalizedRecommended = recommendedData.map((item) => ({
          ...item,
          title: getLocalizedValue(locale, item.titleVi, item.titleEn, item.title),
        }));

        setStory(normalizedDetail);

        // fetch public system settings for unlock ad timings (best-effort)
        (async () => {
          try {
            const resp1 = await apiClient.get(`/settings/unlock_ad_reappearance_minutes`);
            setUnlockAdReappearMinutes(Number(unwrapData<{ value?: unknown }>(resp1?.data)?.value) || 15);
          } catch (e) {
            setUnlockAdReappearMinutes(15);
          }

          try {
            const resp2 = await apiClient.get(`/settings/unlock_ad_countdown_seconds`);
            setUnlockAdCountdownSeconds(Number(unwrapData<{ value?: unknown }>(resp2?.data)?.value) || 5);
          } catch (e) {
            setUnlockAdCountdownSeconds(5);
          }
        })();

        const fromSlug = chapterNumberFromSlug(chapterSlug);
        const pickedBySlug = fromSlug
          ? normalizedDetail.chapters.find((chapter) => chapter.chapterNumber === fromSlug)
          : null;
        const fallbackChapter = normalizedDetail.chapters[0] || null;
        const selected = pickedBySlug || fallbackChapter;

        console.log('[DEBUG] chapterSlug:', chapterSlug);
        console.log('[DEBUG] fromSlug (parsed number):', fromSlug);
        console.log('[DEBUG] pickedBySlug:', pickedBySlug ? `Chapter ${pickedBySlug.chapterNumber}: ${pickedBySlug.title}` : 'null');
        console.log('[DEBUG] selected:', selected ? `Chapter ${selected.chapterNumber}: ${selected.title}` : 'null');

        if (selected) {
          setSelectedChapterId(selected.id);
          setVariants(selected.variants || []);
          // Auto-select default variant
          const defaultVar = (selected.variants || []).find((v: ChapterVariant) => v.isDefault);
          if (defaultVar) {
            setSelectedVariantId(defaultVar.id);
          }
          if (!pickedBySlug && fallbackChapter) {
            router.replace(chapterHref(normalizedDetail.slug, fallbackChapter.chapterNumber));
          }
        }

        setRecommendedStories(normalizedRecommended.filter((item) => item.slug !== normalizedDetail.slug));
        setRatingStats(fetchedRatingStats);
        setReviews(fetchedReviews);
        setReviewPage(fetchedReviewsMeta?.page || 1);
        setReviewLastPage(fetchedReviewsMeta?.lastPage || 1);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu chi tiết truyện:", error);
        setStory(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [chapterSlug, locale, normalizeChapter, router, slug, accessToken]);

  useEffect(() => {
    if (!story || !selectedChapterId) return;

    const chapter = story.chapters.find((item) => item.id === selectedChapterId);
    if (!chapter) return;

    const hasChapterContent = Boolean(chapter.content && chapter.content.trim().length > 0);
    const hasVariantContent = (chapter.variants || []).every((variant) => typeof variant.content === 'string');
    const needsHydration = !hasChapterContent || !hasVariantContent;

    if (!needsHydration || hydratedChapterIdsRef.current.has(selectedChapterId)) return;

    let cancelled = false;

    const fetchChapterDetail = async () => {
      try {
        const response = await apiClient.get(`/chapters/${selectedChapterId}/public`);
        if (cancelled) return;

        const normalizedChapter = normalizeChapter(unwrapData(response.data));
        hydratedChapterIdsRef.current.add(selectedChapterId);

        setStory((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            chapters: prev.chapters.map((item) =>
              item.id === selectedChapterId
                ? {
                  ...item,
                  ...normalizedChapter,
                }
                : item,
            ),
          };
        });

        const nextVariants = normalizedChapter.variants || [];
        setVariants(nextVariants);
        setSelectedVariantId((prev) => {
          if (!nextVariants.length) return null;
          if (prev && nextVariants.some((variant) => variant.id === prev)) return prev;
          const defaultVariant = nextVariants.find((variant) => variant.isDefault);
          return defaultVariant?.id || nextVariants[0]?.id || null;
        });
      } catch (error) {
        hydratedChapterIdsRef.current.add(selectedChapterId);
        console.error('Failed to hydrate chapter detail:', error);
      }
    };

    void fetchChapterDetail();

    return () => {
      cancelled = true;
    };
  }, [normalizeChapter, selectedChapterId, story]);

  useEffect(() => {
    if (!story) return;
    void loadReviews(story.id, reviewSort, 1, false);
  }, [loadReviews, reviewSort, story]);

  useEffect(() => {
    if (!selectedChapterId || !user) {
      setUnlockedVariantIds([]);
      return;
    }

    const fetchUnlocked = async () => {
      try {
        const res = await apiClient.get<string[]>(`/chapters/${selectedChapterId}/unlocked-variants`);
        setUnlockedVariantIds(unwrapList<string>(res.data));
      } catch (error) {
        console.error("Failed to fetch unlocked variants:", error);
      }
    };

    void fetchUnlocked();
  }, [selectedChapterId, user]);

  useEffect(
    () => () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!sleepMinutesLeft) return;
    const timer = setInterval(() => {
      setSleepMinutesLeft((prev) => {
        if (!prev) return null;
        if (prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, [sleepMinutesLeft]);

  // COMMENTED OUT: Anti-debugging and DevTools blocking code
  // Uncomment if you want to prevent users from opening DevTools in production
  /*
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleCopy = (event: ClipboardEvent) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F12") {
        event.preventDefault();
        return;
      }

      if (event.ctrlKey && event.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(event.key)) {
        event.preventDefault();
        return;
      }

      if (event.ctrlKey && ["U", "u"].includes(event.key)) {
        event.preventDefault();
      }
    };

    const antiDebug = window.setInterval(() => {
      Function("debugger")();
    }, 100);

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCopy);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearInterval(antiDebug);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCopy);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  */


  const chapterCount = useMemo(() => story?.chapters?.length ?? 0, [story?.chapters]);

  useViewTracking({
    storyId: story?.id,
    chapterId: selectedChapterId,
  });

  const activeChapterIndex = useMemo(() => {
    if (!story || !selectedChapterId) return -1;
    return story.chapters.findIndex((chapter) => chapter.id === selectedChapterId);
  }, [selectedChapterId, story]);

  const selectedChapter = useMemo(() => {
    if (!story) return null;
    return story.chapters.find((chapter) => chapter.id === selectedChapterId) || story.chapters[0] || null;
  }, [selectedChapterId, story]);

  const selectedChapterUpdatedAt = selectedChapter?.updatedAt || null;

  const previousChapter = useMemo(() => {
    if (!story || activeChapterIndex <= 0) return null;
    return story.chapters[activeChapterIndex - 1] || null;
  }, [activeChapterIndex, story]);

  const nextChapter = useMemo(() => {
    if (!story || activeChapterIndex < 0 || activeChapterIndex >= story.chapters.length - 1) return null;
    return story.chapters[activeChapterIndex + 1] || null;
  }, [activeChapterIndex, story]);

  const getVariantPath = useCallback((targetId: string | null, allVariants: ChapterVariant[]) => {
    const path: ChapterVariant[] = [];
    let currentId = targetId;
    while (currentId) {
      const variant = allVariants.find(v => v.id === currentId);
      if (!variant) break;
      path.unshift(variant);
      currentId = variant.parentId || null;
    }
    return path;
  }, []);

  const selectedVariantPath = useMemo(() => {
    return getVariantPath(selectedVariantId, variants);
  }, [getVariantPath, selectedVariantId, variants]);

  const selectedVariant = useMemo(() => {
    return selectedVariantPath[selectedVariantPath.length - 1] || null;
  }, [selectedVariantPath]);

  const isVipActive = useMemo(() => {
    if (!user) return false;
    if ((user.vipTier || 0) <= 0) return false;
    if (!user.vipExpirationDate) return true;
    return new Date(user.vipExpirationDate) > new Date();
  }, [user]);

  const chapterIsLocked = useMemo(() => {
    if (!selectedChapter) return false;
    if (chapterUnlockState?.isUnlocked) return false;
    if (isVipActive) return false;
    if (selectedChapter.accessType === "ads") return !!selectedChapter.unlockAd;
    if (selectedChapter.accessType === "vip") return true;
    if (selectedChapter.accessType === "timed") {
      if (!selectedChapter.unlocksAt) return true;
      return new Date(selectedChapter.unlocksAt).getTime() > Date.now();
    }
    return false;
  }, [chapterUnlockState?.isUnlocked, isVipActive, selectedChapter]);

  const chapterRequiresUnlockAction = useMemo(() => {
    if (!selectedChapter) return false;
    if (chapterUnlockState?.isUnlocked) return false;
    if (isVipActive) return false;
    if (selectedChapter.accessType === "ads") return !!selectedChapter.unlockAd;
    if (selectedChapter.accessType === "vip") return true;
    if (selectedChapter.accessType === "timed") {
      if (!selectedChapter.unlocksAt) return true;
      return new Date(selectedChapter.unlocksAt).getTime() > Date.now();
    }
    return false;
  }, [chapterUnlockState?.isUnlocked, isVipActive, selectedChapter]);

  const shouldShowInlineAds = useMemo(() => {
    if (!selectedChapter) return false;
    if (selectedChapter.accessType === "vip") return false;
    if (selectedChapter.accessType === "timed") {
      if (chapterUnlockState?.unlockSource === "PULSE_STORY" || chapterUnlockState?.unlockSource === "CHAPTER_PULSE") {
        return false;
      }
      return true;
    }
    return true;
  }, [chapterUnlockState?.unlockSource, selectedChapter]);

  useEffect(() => {
    if (!selectedChapter?.id) {
      setChapterUnlockState(null);
      return;
    }
    const fetchUnlockState = async () => {
      try {
        const res = await apiClient.get(`/chapters/${selectedChapter.id}/unlock-status`);
        setChapterUnlockState(unwrapData(res.data));
      } catch {
        setChapterUnlockState(null);
      }
    };
    void fetchUnlockState();
  }, [selectedChapter?.id, user?.id, user?.vipTier, user?.vipExpirationDate]);

  const lockReasonLabel = useMemo(() => {
    if (!selectedChapter) return t("chapterLocked");
    if (selectedChapter.accessType === "ads") {
      return locale === "en" ? "Watch ads to unlock" : "Xem quảng cáo để mở khóa";
    }
    if (selectedChapter.accessType === "vip") {
      return t("vipOnlyChapter");
    }
    if (selectedChapter.accessType === "timed") {
      return (
        getUnlockLabel(selectedChapter, {
          vipOnly: t("vipOnlyAccess"),
          opensFreeLater: t("opensFreeLater"),
          freeUnlocked: t("freeUnlocked"),
          adsLabel: locale === "en" ? "Ads" : "Quảng cáo",
        }) || t("chapterUnlockSoon")
      );
    }
    return t("chapterLocked");
  }, [selectedChapter, t]);

  const chapterBaseUnlockPrice = Math.max(0, Math.floor(Number(selectedChapter?.unlockPrice || 0)));
  const chapterDiscountPercent = Math.max(0, Math.min(100, Math.floor(Number(selectedChapter?.discountPercent || 0))));
  const chapterFinalUnlockPrice = Math.max(0, Math.floor(chapterBaseUnlockPrice * (100 - chapterDiscountPercent) / 100));

  const storyBaseUnlockPrice = Math.max(0, Math.floor(Number(story?.unlockPrice || 0)));
  const storyDiscountPercent = Math.max(0, Math.min(100, Math.floor(Number(story?.discountPercent || 0))));
  const storyFinalUnlockPrice = Math.max(0, Math.floor(storyBaseUnlockPrice * (100 - storyDiscountPercent) / 100));

  const filteredChapters = useMemo(() => {
    if (!story) return [];
    if (!chapterQuery.trim()) return story.chapters;
    const q = chapterQuery.toLowerCase();
    return story.chapters.filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(q) ||
        String(chapter.chapterNumber).includes(q) ||
        `${t("chapterKeyword").toLowerCase()} ${chapter.chapterNumber}`.includes(q),
    );
  }, [chapterQuery, story, t]);

  const selectedChapterTitle = useMemo(() => {
    const rawBase = selectedChapter
      ? getLocalizedValue(locale, selectedChapter.titleVi, selectedChapter.titleEn, selectedChapter.title)
      : "";
    const baseTitle = cleanChapterTitle(rawBase);
    if (selectedVariant) {
      const variantTitle = getLocalizedValue(locale, selectedVariant.titleVi, selectedVariant.titleEn, selectedVariant.title);
      return `${formatChapterTitle(t("chapterKeyword"), selectedChapter?.chapterNumber ?? 0, baseTitle)} - ${cleanChapterTitle(variantTitle)}`;
    }
    return formatChapterTitle(t("chapterKeyword"), selectedChapter?.chapterNumber ?? 0, baseTitle);
  }, [locale, selectedChapter, selectedVariant]);

  const selectedChapterDescription = selectedChapter
    ? getRequestedLocaleValue(
      locale,
      selectedChapter.descriptionVi,
      selectedChapter.descriptionEn,
      !selectedChapter.descriptionVi && !selectedChapter.descriptionEn ? selectedChapter.description : "",
    )
    : "";
  const selectedChapterContentRaw = selectedChapter
    ? getRequestedLocaleValue(
      locale,
      selectedChapter.contentVi,
      selectedChapter.contentEn,
      !selectedChapter.contentVi && !selectedChapter.contentEn ? selectedChapter.content : "",
    )
    : "";

  const contentParts = selectedChapterContentRaw.split('[DIEN_BIEN]');
  const hasInlineChoice = contentParts.length > 1;
  const contentBeforeChoice = contentParts[0];
  const contentAfterChoice = contentParts.slice(1).join('[DIEN_BIEN]');

  const selectedChapterAudioUrl = useMemo(() => {
    if (selectedVariant) {
      return getLocalizedValue(
        locale,
        selectedVariant.audioUrlVi,
        selectedVariant.audioUrlEn,
        !selectedVariant.audioUrlVi && !selectedVariant.audioUrlEn ? selectedVariant.audioUrl : "",
      ).trim();
    }
    if (selectedChapter) {
      return getLocalizedValue(
        locale,
        selectedChapter.audioUrlVi,
        selectedChapter.audioUrlEn,
        !selectedChapter.audioUrlVi && !selectedChapter.audioUrlEn ? selectedChapter.r2AudioUrl : "",
      ).trim();
    }
    return "";
  }, [locale, selectedChapter, selectedVariant]);
  const localePendingLabel = getLocaleLabel(locale);
  const translationPendingMessage = locale === "en"
    ? `This story does not have an ${localePendingLabel} version for this chapter yet. We will update it as soon as possible.`
    : `Hiện tại truyện này chưa có bản ${localePendingLabel} cho chương này. Chúng tôi sẽ cập nhật sớm nhất có thể.`;

  // Real audio presence comes from the BE-computed hasAudio flag (chapter/variant),
  // not the always-present proxy URL — so text-only chapters hide the player.
  const hasPlayableAudio =
    Boolean(selectedChapterAudioUrl) &&
    (selectedVariant ? Boolean(selectedVariant.hasAudio) : Boolean(selectedChapter?.hasAudio));
  const playerCoverUrl = selectedChapter?.thumbnailUrl || story?.thumbnailUrl || "https://placehold.co/300x300?text=No+Cover";
  const isSelectedChapterTrack = Boolean(
    selectedChapter &&
    currentTrack?.id === selectedChapter.id &&
    (!story?.id || currentTrack?.storyId === story.id),
  );
  const isSelectedChapterPlaying = isSelectedChapterTrack && isPlaying;
  const playerDuration = isSelectedChapterTrack
    ? duration
    : (selectedChapter?.audioDuration || 0);
  const playerCurrentTime = isSelectedChapterTrack ? currentTime : 0;
  const canSeekSelectedChapter = hasPlayableAudio && isSelectedChapterTrack;

  useEffect(() => {
    if (!story || !selectedChapter || !selectedChapterAudioUrl || !hasPlayableAudio || !user) return;

    const historyKey = `${selectedChapter.id}:${selectedVariant?.id || "null"}`;
    if (lastRestoredHistoryKeyRef.current === historyKey) return;

    if (currentTrack?.storyId === story.id && currentTrack?.id === selectedChapter.id && isPlaying) {
      lastRestoredHistoryKeyRef.current = historyKey;
      return;
    }

    const restoreProgress = async () => {
      try {
        const response = await apiClient.get<{ data: Array<{ progressSeconds: number }> }>("/history", {
          params: {
            page: 1,
            limit: 1,
            chapterId: selectedChapter.id,
            ...(selectedVariant?.id ? { variantId: selectedVariant.id } : {}),
          },
        });

        const historyItem = unwrapList<{ progressSeconds: number }>(response.data)[0];
        const resumeSeconds = Math.max(0, Math.floor(historyItem?.progressSeconds || 0));

        if (!resumeSeconds) {
          lastRestoredHistoryKeyRef.current = historyKey;
          return;
        }

        const resumeTrack = {
          id: selectedChapter.id,
          storyId: story.id,
          chapterId: selectedChapter.id,
          title: selectedChapterTitle,
          storySlug: story.slug,
          chapterNumber: selectedChapter.chapterNumber,
          author: story.author?.name,
          audioUrl: selectedChapterAudioUrl,
          coverUrl: selectedChapter.thumbnailUrl || story.thumbnailUrl || undefined,
          storyCoverUrl: story.thumbnailUrl || undefined,
        };

        setQueue(
          story.chapters.filter((chapter) => chapterHasAudio(chapter)).map((chapter) => ({
            id: chapter.id,
            storyId: story.id,
            chapterId: chapter.id,
            title: t("chapterTitle", { number: chapter.chapterNumber, title: cleanChapterTitle(chapter.title) }),
            storySlug: story.slug,
            chapterNumber: chapter.chapterNumber,
            author: story.author?.name,
            audioUrl: getLocalizedValue(
              locale,
              chapter.audioUrlVi,
              chapter.audioUrlEn,
              !chapter.audioUrlVi && !chapter.audioUrlEn ? chapter.r2AudioUrl : "",
            ).trim(),
            coverUrl: chapter.thumbnailUrl || story.thumbnailUrl || undefined,
            storyCoverUrl: story.thumbnailUrl || undefined,
          })),
        );
        setTrack(resumeTrack);
        seekTo(resumeSeconds);
        togglePlay(false);
        lastRestoredHistoryKeyRef.current = historyKey;
      } catch {
        // Ignore resume lookup failures; the chapter can still be played normally.
      }
    };

    void restoreProgress();
  }, [
    currentTrack?.id,
    currentTrack?.storyId,
    hasPlayableAudio,
    isPlaying,
    locale,
    selectedChapter,
    selectedChapterAudioUrl,
    selectedChapterTitle,
    selectedVariant?.id,
    setQueue,
    setTrack,
    seekTo,
    story,
    t,
    togglePlay,
    user,
  ]);

  useEffect(() => {
    if (!story || !currentTrack || currentTrack.storyId !== story.id) return;

    const refreshedQueue = story.chapters.filter((item) => chapterHasAudio(item)).map((item) => ({
      id: item.id,
      storyId: story.id,
      chapterId: item.id,
      title: t("chapterTitle", { number: item.chapterNumber, title: cleanChapterTitle(item.title) }),
      storySlug: story.slug,
      chapterNumber: item.chapterNumber,
      author: story.author?.name,
      audioUrl: getLocalizedValue(
        locale,
        item.audioUrlVi,
        item.audioUrlEn,
        !item.audioUrlVi && !item.audioUrlEn ? item.r2AudioUrl : "",
      ).trim(),
      coverUrl: item.thumbnailUrl || story.thumbnailUrl || undefined,
      storyCoverUrl: story.thumbnailUrl || undefined,
    }));
    setQueue(refreshedQueue);

    const latestChapter = story.chapters.find((chapter) => chapter.id === currentTrack.id);
    if (!latestChapter) return;

    const latestAudioUrl = getRequestedLocaleValue(
      locale,
      latestChapter.audioUrlVi,
      latestChapter.audioUrlEn,
      !latestChapter.audioUrlVi && !latestChapter.audioUrlEn ? latestChapter.r2AudioUrl : "",
    ) || "";
    if (currentTrack.audioUrl === latestAudioUrl) return;

    setTrack({
      ...currentTrack,
      title: t("chapterTitle", { number: latestChapter.chapterNumber, title: cleanChapterTitle(latestChapter.title) }),
      storySlug: story.slug,
      chapterNumber: latestChapter.chapterNumber,
      author: story.author?.name,
      audioUrl: latestAudioUrl,
      coverUrl: latestChapter.thumbnailUrl || story.thumbnailUrl || undefined,
      storyCoverUrl: story.thumbnailUrl || undefined,
    });
  }, [currentTrack, locale, setQueue, setTrack, story, t]);

  useEffect(() => {
    if (!currentTrack?.id || !story) return;
    // Only sync selectedChapterId with currentTrack when audio is actually playing
    // This prevents overriding URL-based navigation
    if (!isPlaying) return;
    const existsInStory = story.chapters.some((chapter) => chapter.id === currentTrack.id);
    if (existsInStory) {
      setSelectedChapterId(currentTrack.id);
    }
  }, [currentTrack?.id, story, isPlaying]);

  const playChapter = useCallback(
    async (chapter: ChapterItem, selectedStory: StoryDetail, autoPlay = true, variantId?: string) => {
      setSelectedChapterId(chapter.id);
      const vId = variantId || selectedVariantId;

      const isTimedLocked =
        chapter.accessType === "timed" &&
        !!chapter.unlocksAt &&
        new Date(chapter.unlocksAt).getTime() > Date.now() &&
        !isVipActive;
      const isVipLocked = chapter.accessType === "vip" && !isVipActive;

      if (isTimedLocked || isVipLocked) {
        openUnlockModalForChapter(chapter);
        return;
      }

      // If variant is requested but was not provided as arg, use state
      const targetVariant = variantId
        ? (chapter.variants?.find(v => v.id === variantId))
        : (chapter.id === selectedChapterId ? selectedVariant : null);

      const mappedQueue = selectedStory.chapters.filter((item) => chapterHasAudio(item)).map((item) => ({
        id: item.id,
        storyId: selectedStory.id,
        chapterId: item.id,
        title: t("chapterTitle", { number: item.chapterNumber, title: cleanChapterTitle(item.title) }),
        storySlug: selectedStory.slug,
        chapterNumber: item.chapterNumber,
        author: selectedStory.author?.name,
        audioUrl: getLocalizedValue(
          locale,
          item.audioUrlVi,
          item.audioUrlEn,
          !item.audioUrlVi && !item.audioUrlEn ? item.r2AudioUrl : "",
        ).trim(),
        coverUrl: item.thumbnailUrl || selectedStory.thumbnailUrl || undefined,
        storyCoverUrl: selectedStory.thumbnailUrl || undefined,
      }));

      let chapterAudioUrl = "";
      let chapterTitle = t("chapterTitle", { number: chapter.chapterNumber, title: cleanChapterTitle(chapter.title) });

      if (targetVariant) {
        chapterAudioUrl = getLocalizedValue(
          locale,
          targetVariant.audioUrlVi,
          targetVariant.audioUrlEn,
          !targetVariant.audioUrlVi && !targetVariant.audioUrlEn ? targetVariant.audioUrl : "",
        ).trim();
        const variantTitle = getLocalizedValue(locale, targetVariant.titleVi, targetVariant.titleEn, targetVariant.title);
        chapterTitle = `${chapterTitle} - ${variantTitle}`;
      } else {
        chapterAudioUrl = getLocalizedValue(
          locale,
          chapter.audioUrlVi,
          chapter.audioUrlEn,
          !chapter.audioUrlVi && !chapter.audioUrlEn ? chapter.r2AudioUrl : "",
        ).trim();
      }

      const track = {
        id: chapter.id,
        storyId: selectedStory.id,
        chapterId: chapter.id,
        variantId: targetVariant?.id,
        title: chapterTitle,
        storySlug: selectedStory.slug,
        chapterNumber: chapter.chapterNumber,
        author: selectedStory.author?.name,
        audioUrl: chapterAudioUrl,
        coverUrl: chapter.thumbnailUrl || selectedStory.thumbnailUrl || undefined,
        storyCoverUrl: selectedStory.thumbnailUrl || undefined,
      };

      if (!chapterAudioUrl) {
        setQueue(mappedQueue);
        setTrack(track);
        togglePlay(false);
        return;
      }

      if (autoPlay) {
        playTrack(track, mappedQueue);
      } else {
        setQueue(mappedQueue);
        setTrack(track);
        togglePlay(false);
      }
    },
    [currentTime, isVipActive, locale, playTrack, selectedChapterId, selectedVariant, selectedVariantId, setQueue, setTrack, t, togglePlay],
  );

  const goToChapter = useCallback(
    (chapter: ChapterItem, autoPlay = false) => {
      if (!story) return;
      setIsChapterMenuOpen(false);
      if (chapter.id !== selectedChapterId) {
        setSelectedVariantId(null);
        setVariants(chapter.variants || []);
        // Auto-select default variant
        const defaultVar = (chapter.variants || []).find((v) => v.isDefault);
        if (defaultVar) {
          setSelectedVariantId(defaultVar.id);
        }
      }
      router.push(chapterHref(story.slug, chapter.chapterNumber));
      void playChapter(chapter, story, autoPlay);
    },
    [playChapter, router, selectedChapterId, setVariants, setSelectedVariantId, story],
  );

  const handleSelectVariant = useCallback(
    async (variant: ChapterVariant) => {
      if (!selectedChapter || !story) return;

      const isFree = variant.unlockPrice <= 0;
      const isUnlocked = unlockedVariantIds.includes(variant.id);

      if (!isFree && !isUnlocked && !isVipActive) {
        // Check if user is logged in
        if (!user) {
          openLogin();
          return;
        }

        setPendingVariantId(variant.id);
        const currentBalance = Number(user?.pulseBalance ?? user?.credits ?? 0);
        const requiredPulse = Math.max(0, Math.floor(Number(variant.unlockPrice || 0)));
        const insufficient = requiredPulse > 0 && currentBalance < requiredPulse;
        setShowTopupAction(insufficient);
        setUnlockError(insufficient ? (locale === "en" ? "Insufficient Pulse balance." : "Bạn không đủ Pulse để mở khóa.") : "");
        setIsUnlockModalOpen(true);
        return;
      }

      setSelectedVariantId(variant.id);
      void playChapter(selectedChapter, story, true, variant.id);
    },
    [isVipActive, playChapter, selectedChapter, story, unlockedVariantIds, user, openLogin],
  );

  const handleUnlockVariant = useCallback(async () => {
    const variantToUnlock = pendingVariantId
      ? variants.find(v => v.id === pendingVariantId)
      : selectedVariant;

    if (!variantToUnlock || !selectedChapterId) return;

    setIsUnlocking(true);
    setUnlockError("");
    try {
      await apiClient.post(`/chapter-variants/${variantToUnlock.id}/unlock`);
      setUnlockedVariantIds((prev) => [...prev, variantToUnlock.id]);
      setSelectedVariantId(variantToUnlock.id);
      setIsUnlockModalOpen(false);
      setPendingVariantId(null);
      void refreshProfile();
      if (story && selectedChapter) {
        void playChapter(selectedChapter, story, true, variantToUnlock.id);
      }
    } catch (error: any) {
      console.error("Failed to unlock variant:", error);
      const msg = error.response?.data?.message || "Lỗi khi mở khoá biến thể";
      setUnlockError(msg);
      if (msg.includes("credit") || msg.toLowerCase().includes("balance")) {
        setShowTopupAction(true);
      }
    } finally {
      setIsUnlocking(false);
    }
  }, [pendingVariantId, variants, selectedVariant, selectedChapterId, story, selectedChapter, playChapter, refreshProfile]);

  const playByIndex = useCallback(
    (index: number, autoPlay = false) => {
      if (!story || index < 0 || index >= story.chapters.length) return;
      const chapter = story.chapters[index];
      if (!chapter) return;
      goToChapter(chapter, autoPlay);
    },
    [goToChapter, story],
  );

  const playNext = useCallback(() => {
    if (!story || !story.chapters.length) return;

    if (repeatMode === "one" && selectedChapter) {
      goToChapter(selectedChapter, false);
      return;
    }

    // Interactive branching is handled via manual button, not auto-jump

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * story.chapters.length);
      playByIndex(randomIndex, false);
      return;
    }

    if (repeatMode === "all" && activeChapterIndex >= story.chapters.length - 1) {
      playByIndex(0, false);
      return;
    }

    playByIndex(activeChapterIndex + 1, false);
  }, [activeChapterIndex, goToChapter, isShuffle, playByIndex, repeatMode, selectedChapter, selectedVariant, story]);

  const playPrev = useCallback(() => {
    if (!story || !story.chapters.length) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * story.chapters.length);
      playByIndex(randomIndex, false);
      return;
    }

    if (activeChapterIndex <= 0) {
      playByIndex(0, false);
      return;
    }

    playByIndex(activeChapterIndex - 1, false);
  }, [activeChapterIndex, isShuffle, playByIndex, story]);

  const seekBy = (seconds: number) => {
    if (!canSeekSelectedChapter) return;
    seekTo(currentTime + seconds);
  };

  const cyclePlaybackRate = () => {
    setPlaybackRate(resolveNextPlaybackRate(playbackRate));
  };

  const onShare = async () => {
    const result = await shareAction({
      title: story?.title || "AudioTruyen",
      text: t("sharePrompt"),
      fallbackPrompt: t("copiedLink"),
    });

    if (result === "copied") {
      alert(t("copiedLink"));
    }
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    if (!minutes) {
      setSleepMinutesLeft(null);
      return;
    }

    setSleepMinutesLeft(minutes);
    sleepTimerRef.current = setTimeout(() => {
      togglePlay(false);
      setSleepMinutesLeft(null);
    }, minutes * 60_000);
  };

  const getChapterFinalPrice = (chapter?: ChapterItem | null) => {
    const basePrice = Math.max(0, Math.floor(Number(chapter?.unlockPrice || 0)));
    const discountPercent = Math.max(0, Math.min(100, Math.floor(Number(chapter?.discountPercent || 0))));
    return Math.max(0, Math.floor((basePrice * (100 - discountPercent)) / 100));
  };

  const openUnlockModalForChapter = (chapter?: ChapterItem | null) => {
    if (!user) {
      openLogin();
      return;
    }
    setUnlockError("");
    const currentBalance = Number(user?.pulseBalance ?? user?.credits ?? 0);
    const chapterToUnlock = chapter || selectedChapter;
    const isChapterUnlock = chapterToUnlock?.accessType === "timed" || chapterToUnlock?.accessType === "vip";
    const requiredPulse = isChapterUnlock ? getChapterFinalPrice(chapterToUnlock) : storyFinalUnlockPrice;
    const insufficient = requiredPulse > 0 && currentBalance < requiredPulse;
    setShowTopupAction(insufficient);
    if (insufficient) {
      setUnlockError(locale === "en" ? "Insufficient Pulse balance." : "Bạn không đủ Pulse để mở khóa.");
    } else {
      setUnlockError("");
    }
    setPendingVariantId(null);
    setIsUnlockModalOpen(true);
  };

  const openUnlockModal = () => {
    openUnlockModalForChapter(selectedChapter);
  };

  const handleBuyVip = async () => {
    if (!user) {
      router.push(`/${currentLang}/login`);
      return;
    }

    if (!selectedChapter?.id || !story?.id) return;

    try {
      setIsUnlocking(true);
      setUnlockError("");
      setShowTopupAction(false);

      if (selectedChapter.accessType === "vip" || selectedChapter.accessType === "timed") {
      await apiClient.post(`/chapters/${selectedChapter.id}/unlock-by-pulse`);
      } else {
        await apiClient.post(`/stories/${story.id}/unlock`);
      }

      await refreshProfile();
      setIsUnlockModalOpen(false);
      if (selectedChapter.youtubeVideoId) {
        setYoutubeUnlockAutoPlaySignal((prev) => prev + 1);
      }
      try {
        const statusRes = await apiClient.get(`/chapters/${selectedChapter.id}/unlock-status`);
        setChapterUnlockState(unwrapData(statusRes.data));
      } catch {
        // ignore
      }
    } catch (error: any) {
      const msg = String(error?.response?.data?.message || "Không thể mở khóa. Vui lòng thử lại.");
      setUnlockError(msg);
      if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("pulse")) {
        setShowTopupAction(true);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleGiftCredits = async () => {
    if (!user) {
      router.push(`/${currentLang}/login`);
      return;
    }

    const amount = parseInt(giftAmount);
    if (isNaN(amount) || amount < 1) {
      setGiftError(t("giftMinAmount"));
      return;
    }

    if ((user.pulseBalance ?? user.credits ?? 0) < amount) {
      setGiftError(t("giftInsufficientCredits"));
      return;
    }

    if (!story?.id) return;

    setIsGiftingCredits(true);
    setGiftError("");

    try {
      await apiClient.post(`/stories/${story.id}/gift`, {
        amount,
        message: giftMessage.trim() || undefined,
        chapterId: selectedChapter?.id,
      });

      // Update user credits
      void refreshProfile();

      // Reset form and close modal
      setGiftAmount("");
      setGiftMessage("");
      setIsGiftModalOpen(false);
      alert(t("giftSuccess"));
    } catch (error) {
      const message =
        typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as any).response?.data?.message === "string"
          ? (error as any).response.data.message
          : t("giftError");
      setGiftError(message);
    } finally {
      setIsGiftingCredits(false);
    }
  };

  const submitReview = async () => {
    if (!story) return;
    if (!user) {
      openLogin();
      return;
    }

    setIsSubmittingReview(true);
    try {
      await apiClient.post(`/stories/${story.id}/reviews`, {
        rating: myRating,
        content: reviewDraft.trim() || undefined,
      });

      await refreshRatingAndReviews(story.id);
      setReviewDraft("");
      setShowEmojiPicker(false);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const toggleReviewLike = async (reviewId: string) => {
    if (!story) return;
    if (!user) {
      openLogin();
      return;
    }

    try {
      await apiClient.post(`/stories/${story.id}/reviews/${reviewId}/like`);
      await loadReviews(story.id, reviewSort, 1, false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        openLogin();
      }
    }
  };

  const toggleReviewHelpful = async (reviewId: string) => {
    if (!story) return;
    if (!user) {
      openLogin();
      return;
    }

    try {
      await apiClient.post(`/stories/${story.id}/reviews/${reviewId}/helpful`);
      await loadReviews(story.id, reviewSort, 1, false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        openLogin();
      }
    }
  };

  const submitReviewReply = async (reviewId: string) => {
    if (!story) return;
    if (!user) {
      openLogin();
      return;
    }

    const content = (reviewReplyDrafts[reviewId] || "").trim();
    if (!content) return;
    const selectedParentId = reviewReplyTarget[reviewId] || undefined;
    const parentId = selectedParentId && selectedParentId !== reviewId ? selectedParentId : undefined;

    try {
      await apiClient.post(`/stories/${story.id}/reviews/${reviewId}/replies`, {
        content,
        parentId,
      });

      setReviewReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
      setReviewReplyTarget((prev) => ({ ...prev, [reviewId]: null }));
      await loadReviews(story.id, reviewSort, 1, false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        openLogin();
      }
    }
  };

  const loadMoreReviews = async () => {
    if (!story) return;
    if (reviewPage >= reviewLastPage) return;
    await loadReviews(story.id, reviewSort, reviewPage + 1, true);
  };

  const collapseReviews = async () => {
    if (!story) return;
    await loadReviews(story.id, reviewSort, 1, false);
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("loadingStory")}</p>;
  }

  if (!story) {
    return <p className="text-sm text-red-600">{t("notFound")}</p>;
  }

  if (!selectedChapter) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl border border-pink-200 bg-pink-50/80 p-6 text-pink-900 dark:border-pink-900/40 dark:bg-pink-950/20 dark:text-pink-100">
          <h1 className="text-2xl font-bold">{story.title}</h1>
          <p className="mt-3 text-sm leading-7">{translationPendingMessage}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <StoryUpdateSubscriptionButton
              storyId={story.id}
              className="px-3 py-2 text-sm font-medium"
              inactiveClassName="border-gray-200 bg-white text-black hover:bg-pink-50 transform transition hover:-translate-y-0.5 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-300 dark:hover:bg-[#464749]"
            />
            <Link
              href={`/story/${story.slug}`}
              className="inline-flex items-center justify-center rounded-full border border-pink-300 px-5 py-2.5 text-sm font-semibold text-pink-800 hover:bg-pink-100 dark:border-pink-800 dark:text-pink-100 dark:hover:bg-pink-900/40"
            >
              {t("backToStory")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 md:space-y-4">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
        {/* Story Info */}
        <div className="-mx-5 md:mx-0 bg-transparent">
          <div className="px-5 md:px-0 lg:px-0">
            <section className="rounded-2xl bg-white p-2 sm:p-3 md:p-3 dark:bg-[#242526] lg:col-start-1 lg:col-end-2 lg:row-start-1">
              <div className="flex flex-col gap-3">
                <div className="flex w-full flex-row items-stretch gap-3 md:hidden">
                  <div className="w-[88px] shrink-0 self-start">
                    <div className="relative w-full overflow-hidden rounded-md shadow-md" style={{ aspectRatio: "2/3" }}>
                      <Image src={playerCoverUrl} alt={story.title} fill className="object-cover" />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <h1 className="mb-1 line-clamp-2 text-base font-bold leading-tight text-gray-900 dark:text-white">{story.title}</h1>

                    <div className="flex flex-col space-y-1.5">
                      <p className="flex min-w-0 items-center gap-1 text-xs leading-tight text-gray-700 dark:text-gray-300">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("author")}:</span>
                        <span className="truncate text-xs font-medium text-gray-900 dark:text-white">{story.author?.name || t("updating")}</span>
                      </p>
                      <p className="flex min-w-0 items-center gap-1 text-xs leading-tight text-gray-700 dark:text-gray-300">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("status")}:</span>
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${story.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400"}`}>
                          {story.status === "completed" ? t("completed") : t("ongoing")}
                        </span>
                      </p>
                      <p className="flex min-w-0 items-center gap-1 text-xs leading-tight text-gray-700 dark:text-gray-300">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("listensLabel")}:</span>
                        <span className="truncate text-xs font-medium text-gray-900 dark:text-white">{Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</span>
                      </p>
                      <p className="flex min-w-0 items-center gap-1 text-xs leading-tight text-gray-700 dark:text-gray-300">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("chapterUpdated")}:</span>
                        <span className="truncate text-xs font-medium text-gray-900 dark:text-white">{formatDate(selectedChapterUpdatedAt, locale, t("updating"))}</span>
                      </p>
                      <p className="flex min-w-0 items-center gap-1 text-xs leading-tight text-gray-700 dark:text-gray-300">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("language")}:</span>
                        <span className="truncate text-xs font-medium text-gray-900 dark:text-white">{locale === "en" ? t("languageOptionEn") : t("languageOptionVi")}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden w-full md:grid md:grid-cols-[150px_minmax(0,1fr)] md:gap-x-3 md:items-stretch">
                  <div className="w-[150px] shrink-0 self-start">
                    <div className="relative w-full overflow-hidden rounded-md shadow-md" style={{ aspectRatio: "2/3" }}>
                      <Image src={playerCoverUrl} alt={story.title} fill className="object-cover" />
                    </div>
                  </div>

                  <div className="flex min-w-0 h-full flex-col md:justify-between md:col-start-2 md:row-start-1 md:pt-0.5">
                    <h1 className="mb-2 text-lg md:text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100">{story.title}</h1>

                    <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <p className="flex min-w-0 flex-col gap-0.5">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("author")}:</span>
                        <span className="truncate font-semibold text-gray-900 dark:text-white">{story.author?.name || t("updating")}</span>
                      </p>
                      <p className="flex min-w-0 flex-col gap-0.5">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("status")}:</span>
                        <span className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${story.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400"}`}>
                          {story.status === "completed" ? t("completed") : t("ongoing")}
                        </span>
                      </p>
                      <p className="flex min-w-0 flex-col gap-0.5">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("listensLabel")}:</span>
                        <span className="inline-flex items-center gap-1 font-medium text-gray-900 dark:text-white">
                          <Headphones className="h-4 w-4" />
                          {Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
                        </span>
                      </p>
                      <p className="flex min-w-0 flex-col gap-0.5">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("chapterUpdated")}:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatDate(selectedChapterUpdatedAt, locale, t("updating"))}</span>
                      </p>
                      <p className="flex min-w-0 flex-col gap-0.5 md:col-span-2">
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{t("language")}:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{locale === "en" ? t("languageOptionEn") : t("languageOptionVi")}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <StoryEngagementActions
                storyId={story.id}
                favoriteLabel={t("favorite")}
                shareLabel={t("share")}
                onShare={onShare}
              />

            </section>
          </div>
        </div>

        {/* Chapter Introduction */}
        <section className="rounded-2xl bg-white p-2 sm:p-3 md:p-4 dark:bg-[#242526] lg:col-start-1 lg:col-end-2 lg:row-start-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("chapterIntro")}</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">
            {selectedChapterDescription || translationPendingMessage}
          </p>
        </section>

        {/* RIGHT STICKY SIDEBAR */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-end-6 relative lg:sticky lg:top-24 h-fit flex flex-col gap-3 z-10">

          {/* Side Panel 1.5: Variant Selection (Interactive Stories) - Moved Inline if hasInlineChoice */}
          {variants.length > 0 && !hasInlineChoice && (
            <section className="rounded-2xl bg-white p-2 sm:p-3 md:p-4 dark:bg-[#242526]">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {variants.map((v) => {
                  const isUnlocked = v.unlockPrice <= 0 || unlockedVariantIds.includes(v.id) || isVipActive;
                  const isSelected = selectedVariantId === v.id;

                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        if (!isSelected) handleSelectVariant(v);
                      }}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${isSelected
                          ? "border-indigo-300 bg-indigo-100 dark:border-indigo-600 dark:bg-indigo-900/60 shadow-sm ring-1 ring-indigo-300/50 cursor-default"
                          : "border-gray-200 bg-white/50 dark:border-[#303133] dark:bg-[#3a3b3c] hover:border-gray-400 dark:hover:border-gray-600"
                        }`}
                      disabled={isSelected}
                    >
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-sm font-bold truncate ${isSelected ? "text-indigo-900 dark:text-indigo-100" : "text-gray-700 dark:text-gray-300"}`}>
                          {getLocalizedValue(locale, v.titleVi, v.titleEn, v.title)}
                        </p>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock3 className="h-3 w-3" /> {formatDuration(v.audioDuration)}
                        </p>
                      </div>

                      {!isUnlocked && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-black">
                          <Lock className="h-3 w-3" />
                          {v.unlockPrice}
                        </div>
                      )}
                      {isUnlocked && isSelected && (
                        <div className="flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <LockOpen className="h-4 w-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {!selectedVariantId && (
                <p className="mt-3 text-[11px] text-center text-amber-700 dark:text-amber-400 font-medium italic">
                  {t("variantSelectionSubtitle")}
                </p>
              )}
            </section>
          )}


          {/* Side Panel 1: Chapter List */}
          <div className="-mx-4 md:mx-0 md:bg-transparent lg:bg-transparent">
            <div className="px-4 md:px-0">
              <section className="rounded-2xl p-2 sm:p-3 md:p-4">
                <h2 className="mb-3 flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
                  <span className="inline-flex items-center gap-2"><ListMusic className="h-4 w-4" /> {t("currentChapter")}
                  </span>
                  <span className="text-xs text-gray-500">{t("chaptersCount", { count: chapterCount })}</span>
                </h2>

                <button
                  onClick={() => setIsChapterMenuOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg border border-pink-300 px-3 py-2 text-left hover:bg-pink-50 dark:border-pink-700 dark:hover:bg-pink-900/30"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedChapterTitle}</p>
                    <p className="text-xs text-gray-500">{formatDuration(selectedChapter.audioDuration)}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${isChapterMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {selectedChapter.accessType !== "free" ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300">
                    <Lock className="h-3 w-3" /> {getUnlockLabel(selectedChapter, {
                      vipOnly: t("vipOnlyAccess"),
                      opensFreeLater: t("opensFreeLater"),
                      freeUnlocked: t("freeUnlocked"),
                      adsLabel: locale === "en" ? "Ads" : "Quảng cáo",
                    })}
                  </p>
                ) : null}

                {isChapterMenuOpen ? (
                  <div className="mt-3 rounded-xl bg-gray-100 p-2 dark:bg-[#3a3b3c]">
                    <input
                      value={chapterQuery}
                      onChange={(event) => setChapterQuery(event.target.value)}
                      placeholder={t("searchChapterPlaceholder")}
                      className="mb-2 w-full rounded-md bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-pink-500 dark:bg-[#3a3b3c] dark:text-white"
                    />
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                      {/* Branch navigation option */}
                      {selectedVariant?.nextChapterId && (() => {
                        const targetChapter = story.chapters.find((c) => c.id === selectedVariant.nextChapterId);
                        if (!targetChapter) return null;
                        return (
                          <button
                            onClick={() => {
                              goToChapter(targetChapter, true);
                              // Auto-select the specific variant if set
                              if (selectedVariant.nextVariantId) {
                                setSelectedVariantId(selectedVariant.nextVariantId);
                              }
                            }}
                            className="w-full rounded-lg px-3 py-2.5 text-left text-xs transition mb-2 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20 border border-emerald-300 dark:border-emerald-800 hover:from-emerald-100 hover:to-green-100 dark:hover:from-emerald-900/50 dark:hover:to-green-900/40"
                          >
                            <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />
                              {locale === "en" ? "Continue the story" : "Tiếp tục câu chuyện"}
                            </p>
                            <span className="line-clamp-1 font-bold text-emerald-900 dark:text-emerald-100">
                              {formatChapterTitle(t("chapterKeyword"), targetChapter.chapterNumber, getLocalizedValue(locale, targetChapter.titleVi, targetChapter.titleEn, targetChapter.title))}
                            </span>
                          </button>
                        );
                      })()}
                      {filteredChapters.map((chapter) => {
                        const isCurrent = chapter.id === selectedChapter.id;
                        const chapterIsAdsLock = chapter.accessType === "ads";
                        const chapterIsVipLock = chapter.accessType === "vip";
                        const chapterIsTimedLock =
                          chapter.accessType === "timed"
                          && (!chapter.unlocksAt || new Date(chapter.unlocksAt).getTime() > Date.now());
                        return (
                          <button
                            key={chapter.id}
                            onClick={() => goToChapter(chapter, true)}
                            className={`w-full rounded-md px-2 py-2 text-left text-xs transition ${isCurrent
                              ? "bg-pink-600 text-white"
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#464749]"
                              }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="line-clamp-1">{formatChapterTitle(t("chapterKeyword"), chapter.chapterNumber, cleanChapterTitle(getLocalizedValue(locale, chapter.titleVi, chapter.titleEn, chapter.title)))}</span>
                              {chapterIsAdsLock ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isCurrent ? "bg-white/20 text-yellow-100" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                                  <Lock className="h-3 w-3" />
                                  {locale === "en" ? "Ads" : "Quảng cáo"}
                                </span>
                              ) : null}
                              {chapterIsVipLock ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isCurrent ? "bg-white/20 text-violet-100" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"}`}>
                                  <Lock className="h-3 w-3" />
                                  {locale === "en" ? "VIP" : "VIP"}
                                </span>
                              ) : null}
                              {chapterIsTimedLock ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isCurrent ? "bg-white/20 text-sky-100" : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"}`}>
                                  <Clock3 className="h-3 w-3" />
                                  {locale === "en" ? "Timed" : "Hẹn giờ"}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          {/* Side Panel 2: Audio Player — hidden when the chapter has no audio */}
          {hasPlayableAudio && (
          <div className="-mx-4 md:mx-0 md:bg-transparent lg:bg-transparent">
            <div className="px-4 md:px-0">
              <StoryAudioPlayerPanel
                heading={t("audioPlayer")}
                coverUrl={playerCoverUrl}
                coverAlt={story.title}
                rotating={isSelectedChapterPlaying}
                chapterMeta={formatChapterTitle(
                  t("chapterKeyword"),
                  selectedChapter.chapterNumber,
                  cleanChapterTitle(getLocalizedValue(locale, selectedChapter.titleVi, selectedChapter.titleEn, selectedChapter.title)),
                )}
                title={selectedChapterTitle}
                currentTime={playerCurrentTime}
                duration={playerDuration}
                canSeek={canSeekSelectedChapter}
                canPlay={hasPlayableAudio}
                isPlaying={isSelectedChapterPlaying}
                isMuted={isMuted}
                volume={volume}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                playbackRate={playbackRate}
                showSettings={showSettings}
                customMinutes={customMinutes}
                sleepMinutesLeft={sleepMinutesLeft}
                sleepTimerActiveLabel={
                  sleepMinutesLeft ? t("sleepTimerActive", { minutes: sleepMinutesLeft }) : null
                }
                labels={{
                  playbackSpeed: t("playbackSpeed"),
                  sleepTimer: t("sleepTimer"),
                  cancelSleepTimer: t("cancelSleepTimer"),
                  customMinutesPlaceholder: t("customMinutesPlaceholder"),
                  setTimer: t("setTimer"),
                }}
                onSeek={seekTo}
                onPrev={playPrev}
                onBack10={() => seekBy(-10)}
                onTogglePlay={() => {
                  if (chapterRequiresUnlockAction) {
                    openUnlockModal();
                    return;
                  }
                  if (!hasPlayableAudio) return;
                  if (!isSelectedChapterTrack && story) {
                    void playChapter(selectedChapter, story, true);
                    return;
                  }
                  togglePlay(!isSelectedChapterPlaying);
                }}
                onForward10={() => seekBy(10)}
                onNext={playNext}
                onCyclePlaybackRate={cyclePlaybackRate}
                onToggleMute={() => toggleMute()}
                onVolumeChange={(nextVolume) => setVolume(nextVolume)}
                onToggleShuffle={() => setIsShuffle((prev) => !prev)}
                onCycleRepeatMode={() => setRepeatMode((prev) => cycleRepeatMode(prev))}
                onToggleSettings={() => setShowSettings((prev) => !prev)}
                onSetSleepTimer={setSleepTimer}
                onCustomMinutesChange={(value) => setCustomMinutes(value)}
                onApplyCustomMinutes={() => {
                  const value = Number(customMinutes);
                  if (value > 0) setSleepTimer(value);
                }}
                footer={!selectedChapter.youtubeVideoId ? <SocialLinks /> : null}
              />
            </div>
          </div>
          )}

          {/* Side Panel 3: YouTube Player */}
          {selectedChapter.youtubeVideoId ? (
            <div className="space-y-3">
              <YouTubePlayerPanel
                videoId={selectedChapter.youtubeVideoId}
                title={t("youtubePlayer")}
                locked={chapterIsLocked && selectedChapter.accessType !== "ads"}
                lockReasonLabel={lockReasonLabel}
                unlockLabel={t("unlockYoutube")}
                onUnlockRequest={openUnlockModal}
                onPlaybackAttempt={() => {
                  if (selectedChapter.accessType === "ads" && !user) {
                    openLogin();
                    return false;
                  }
                  if (chapterRequiresUnlockAction) {
                    openUnlockModal();
                    return false;
                  }
                  return true;
                }}
                autoPlaySignal={youtubeUnlockAutoPlaySignal}
                labels={{
                  playbackSpeed: t("playbackSpeed"),
                  sleepTimer: t("sleepTimer"),
                  cancelSleepTimer: t("cancelSleepTimer"),
                  customMinutesPlaceholder: t("customMinutesPlaceholder"),
                  setTimer: t("setTimer"),
                }}
              />

              {/* Social Links */}
              <SocialLinks />
            </div>
          ) : null}

        </div>{/* END RIGHT STICKY SIDEBAR */}

        {/* Chapter Content / Text Reader */}
        <section className="rounded-2xl bg-white p-1 sm:p-4 md:p-6 dark:bg-[#242526] lg:col-start-1 lg:col-end-2 lg:row-start-3">
          <div className="mb-4 flex items-center justify-between gap-2 sm:mb-6">
            <button
              type="button"
              onClick={() => previousChapter && goToChapter(previousChapter, false)}
              disabled={!previousChapter}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:bg-[#3a3b3c] dark:hover:bg-[#464749]"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{locale === "en" ? "Previous chapter" : "Chương trước"}</span>
              <span className="sm:hidden">{locale === "en" ? "Prev" : "Trước"}</span>
            </button>

            <button
              type="button"
              onClick={() => nextChapter && goToChapter(nextChapter, false)}
              disabled={!nextChapter}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:bg-[#3a3b3c] dark:hover:bg-[#464749]"
            >
              <span className="hidden sm:inline">{locale === "en" ? "Next chapter" : "Chương tiếp"}</span>
              <span className="sm:hidden">{locale === "en" ? "Next" : "Tiếp"}</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          <div className="min-w-0">
            {selectedChapterContentRaw ? (
              hasInlineChoice ? (
                <div className="space-y-8">
                <StoryReader
                  chapterId={`${selectedChapter.id}-part1`}
                  content={contentBeforeChoice}
                  adInterval={shouldShowInlineAds ? 700 : Number.MAX_SAFE_INTEGER}
                  isLocked={chapterIsLocked}
                  previewChars={500}
                  previewPercent={0.1}
                  lockLabel={lockReasonLabel}
                  onUnlockRequest={openUnlockModal}
                  unlockAd={selectedChapter?.unlockAd ?? null}
                    unlockReappearMinutes={unlockAdReappearMinutes}
                    unlockCountdownSeconds={unlockAdCountdownSeconds}
                    onAdUnlocked={() => {
                      // attempt to refresh unlocked state
                      void refreshProfile();
                    }}
                  />

                  {/* Inline Variant Selection */}
                  <div className="rounded-2xl  relative">


                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {variants.filter(v => !v.parentId).map((v, index) => {
                        const isUnlocked = v.unlockPrice <= 0 || unlockedVariantIds.includes(v.id) || isVipActive;
                        const isSelected = selectedVariantPath[0]?.id === v.id;

                        // Define color schemes for each variant (always visible)
                        const colorSchemes = [
                          { // Blue
                            base: "border-pink-300 bg-pink-50 dark:border-pink-700 dark:bg-pink-900/30",
                            hover: "hover:bg-pink-100 dark:hover:bg-pink-900/50",
                            selected: "border-pink-400 bg-pink-100 dark:border-pink-600 dark:bg-pink-900/60 ring-2 ring-pink-300/50",
                            text: "text-pink-900 dark:text-pink-100",
                            textNormal: "text-pink-800 dark:text-pink-200",
                            icon: "text-pink-600 dark:text-pink-400"
                          },
                          { // Pink/Rose
                            base: "border-pink-300 bg-pink-50 dark:border-pink-700 dark:bg-pink-900/30",
                            hover: "hover:bg-pink-100 dark:hover:bg-pink-900/50",
                            selected: "border-pink-400 bg-pink-100 dark:border-pink-600 dark:bg-pink-900/60 ring-2 ring-pink-300/50",
                            text: "text-pink-900 dark:text-pink-100",
                            textNormal: "text-pink-800 dark:text-pink-200",
                            icon: "text-pink-600 dark:text-pink-400"
                          },
                          { // Yellow/Amber
                            base: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30",
                            hover: "hover:bg-amber-100 dark:hover:bg-amber-900/50",
                            selected: "border-amber-400 bg-amber-100 dark:border-amber-600 dark:bg-amber-900/60 ring-2 ring-amber-300/50",
                            text: "text-amber-900 dark:text-amber-100",
                            textNormal: "text-amber-800 dark:text-amber-200",
                            icon: "text-amber-600 dark:text-amber-400"
                          }
                        ];
                        const colorScheme = colorSchemes[index % 3]!; // Non-null assertion since we always have 3 color schemes

                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              if (!isSelected) handleSelectVariant(v);
                            }}
                            className={`flex flex-col items-start gap-3 rounded-xl p-4 transition-all h-full w-full border ${colorScheme.base
                              } ${isSelected
                                ? `${colorScheme.selected} shadow-lg cursor-default`
                                : `${colorScheme.hover} shadow-sm`
                              }`}
                            disabled={isSelected}
                          >
                            <div className="w-full flex items-start justify-between gap-3">
                              <p className={`text-base font-bold flex-1 text-left ${isSelected ? colorScheme.text : colorScheme.textNormal
                                }`}>
                                {getLocalizedValue(locale, v.titleVi, v.titleEn, v.title)}
                              </p>
                            </div>
                            <div className="w-full flex items-center justify-between mt-auto pt-1">
                              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                <Clock3 className="h-3.5 w-3.5 opacity-70" /> {formatDuration(v.audioDuration)}
                              </p>
                              <div className="flex-shrink-0">
                                {!isUnlocked && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-black">
                                    <Coins className="h-3 w-3" />
                                    {v.unlockPrice}
                                  </div>
                                )}
                                {isUnlocked && v.unlockPrice > 0 && !isSelected && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-black">
                                    <LockOpen className="h-3.5 w-3.5" />
                                    {t("unlocked")}
                                  </div>
                                )}
                                {isUnlocked && isSelected && v.unlockPrice > 0 && (
                                  <div className={`${colorScheme.icon} flex items-center justify-center`}>
                                    <LockOpen className="h-4 w-4" />
                                  </div>
                                )}
                                {v.unlockPrice <= 0 && (
                                  <div className={`${isSelected ? colorScheme.icon : "text-emerald-500 dark:text-emerald-400"} flex items-center justify-center`}>
                                    <LockOpen className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recursive Variant Content & Nested Choices */}
                  {(() => {
                    const hasTextContent = (htmlStr?: string | null) => {
                      if (!htmlStr) return false;
                      const stripped = htmlStr.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, '').trim();
                      return stripped.length > 0;
                    };

                    const renderVariantRecursive = (pathIndex: number) => {
                      const currentV = selectedVariantPath[pathIndex];
                      if (!currentV) return null;

                      const nextV = selectedVariantPath[pathIndex + 1];
                      const childVariants = variants.filter(v => v.parentId === currentV.id);
                      const vContent = currentV.content || "";
                      const vParts = vContent.split('[DIEN_BIEN]');
                      const hasVChoice = vParts.length > 1 || childVariants.length > 0;

                      const siblings = variants.filter(v => v.parentId === currentV.parentId);
                      const dropdownKey = currentV.parentId || 'root';
                      const isDropdownOpen = !!openNestedDropdowns[dropdownKey];

                      // Determine color scheme based on variant level and index
                      const getVariantColorScheme = () => {
                        if (pathIndex === 0) {
                          // Root level variants - Blue, Pink, Amber
                          const rootVariants = variants.filter(v => !v.parentId);
                          const variantIndex = rootVariants.findIndex(v => v.id === currentV.id);
                          const rootColors = [
                            { bg: "bg-pink-50 dark:bg-pink-900/30", border: "border-pink-200 dark:border-pink-800" },
                            { bg: "bg-pink-50 dark:bg-pink-900/30", border: "border-pink-200 dark:border-pink-800" },
                            { bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800" }
                          ];
                          return rootColors[variantIndex % 3]!;
                        } else {
                          // Nested variants - Purple, Emerald, Orange
                          const siblingIndex = siblings.findIndex(v => v.id === currentV.id);
                          const nestedColors = [
                            { bg: "bg-purple-50 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
                            { bg: "bg-emerald-50 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800" },
                            { bg: "bg-orange-50 dark:bg-orange-900/30", border: "border-orange-200 dark:border-orange-800" }
                          ];
                          return nestedColors[siblingIndex % 3]!;
                        }
                      };

                      const variantColor = getVariantColorScheme();

                      return (
                        <div key={currentV.id} className="mt-6 space-y-4">
                          {pathIndex > 0 && siblings.length > 1 && (
                            <div className="mt-2 mb-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                                {siblings.map((s, sibIndex) => {
                                  const isUnlocked = s.unlockPrice <= 0 || unlockedVariantIds.includes(s.id) || isVipActive;
                                  const isSelected = currentV.id === s.id;

                                  // Define color schemes for child/nested variants (different from parent)
                                  const colorSchemes = [
                                    { // Purple/Violet
                                      base: "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30",
                                      hover: "hover:bg-purple-100 dark:hover:bg-purple-900/50",
                                      selected: "border-purple-400 bg-purple-100 dark:border-purple-600 dark:bg-purple-900/60 ring-2 ring-purple-300/50",
                                      text: "text-purple-900 dark:text-purple-100",
                                      textNormal: "text-purple-800 dark:text-purple-200",
                                      icon: "text-purple-600 dark:text-purple-400"
                                    },
                                    { // Green/Emerald
                                      base: "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30",
                                      hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
                                      selected: "border-emerald-400 bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/60 ring-2 ring-emerald-300/50",
                                      text: "text-emerald-900 dark:text-emerald-100",
                                      textNormal: "text-emerald-800 dark:text-emerald-200",
                                      icon: "text-emerald-600 dark:text-emerald-400"
                                    },
                                    { // Orange
                                      base: "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/30",
                                      hover: "hover:bg-orange-100 dark:hover:bg-orange-900/50",
                                      selected: "border-orange-400 bg-orange-100 dark:border-orange-600 dark:bg-orange-900/60 ring-2 ring-orange-300/50",
                                      text: "text-orange-900 dark:text-orange-100",
                                      textNormal: "text-orange-800 dark:text-orange-200",
                                      icon: "text-orange-600 dark:text-orange-400"
                                    }
                                  ];
                                  const colorScheme = colorSchemes[sibIndex % 3]!; // Non-null assertion since we always have 3 color schemes

                                  return (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        if (!isSelected) {
                                          handleSelectVariant(s);
                                        }
                                      }}
                                      className={`flex flex-col items-start gap-3 rounded-xl p-4 transition-all h-full w-full border ${colorScheme.base
                                        } ${isSelected
                                          ? `${colorScheme.selected} shadow-lg cursor-default`
                                          : `${colorScheme.hover} shadow-sm`
                                        }`}
                                      disabled={isSelected}
                                    >
                                      <div className="w-full flex items-start justify-between gap-3">
                                        <p className={`text-base font-bold flex-1 text-left ${isSelected ? colorScheme.text : colorScheme.textNormal
                                          }`}>
                                          {getLocalizedValue(locale, s.titleVi, s.titleEn, s.title)}
                                        </p>
                                      </div>
                                      <div className="w-full flex items-center justify-between mt-auto pt-1">
                                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                          <Clock3 className="h-3.5 w-3.5 opacity-70" /> {formatDuration(s.audioDuration)}
                                        </p>
                                        <div className="flex-shrink-0">
                                          {!isUnlocked && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-black">
                                              <Coins className="h-3 w-3" />
                                              {s.unlockPrice}
                                            </div>
                                          )}
                                          {isUnlocked && s.unlockPrice > 0 && !isSelected && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-black">
                                              <LockOpen className="h-3.5 w-3.5" />
                                              {t("unlocked")}
                                            </div>
                                          )}
                                          {isUnlocked && isSelected && s.unlockPrice > 0 && (
                                            <div className={`${colorScheme.icon} flex items-center justify-center`}>
                                              <LockOpen className="h-4 w-4" />
                                            </div>
                                          )}
                                          {s.unlockPrice <= 0 && (
                                            <div className={`${isSelected ? colorScheme.icon : colorScheme.icon} flex items-center justify-center`}>
                                              <LockOpen className="h-4 w-4" />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {hasTextContent(vParts[0]) ? (
                            <div className={`p-1 sm:p-5 md:p-6 rounded-2xl ${variantColor.bg} border ${variantColor.border} shadow-md`}>
                              <StoryReader
                                chapterId={`variant-${currentV.id}-p1`}
                                content={vParts[0]}
                                adInterval={shouldShowInlineAds ? 700 : Number.MAX_SAFE_INTEGER}
                                isLocked={chapterIsLocked}
                                previewChars={500}
                                previewPercent={0.1}
                                lockLabel={lockReasonLabel}
                                onUnlockRequest={openUnlockModal}
                              />
                            </div>
                          ) : null}

                          {hasVChoice && (
                            <div className="py-4">
                              {!nextV ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                                  {childVariants.map((cv) => {
                                    const isUnlocked = cv.unlockPrice <= 0 || unlockedVariantIds.includes(cv.id) || isVipActive;
                                    return (
                                      <button
                                        key={cv.id}
                                        onClick={() => handleSelectVariant(cv)}
                                        className="flex flex-col items-start gap-3 rounded-xl bg-gray-50 p-4 transition-all hover:bg-gray-100 dark:bg-[#3a3b3c] dark:hover:bg-[#464749] h-full w-full"
                                      >
                                        <div className="w-full flex items-start justify-between gap-3">
                                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 text-left">
                                            {getLocalizedValue(locale, cv.titleVi, cv.titleEn, cv.title)}
                                          </p>
                                        </div>
                                        <div className="w-full flex items-center justify-between mt-auto pt-1">
                                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                            <Clock3 className="h-3.5 w-3.5 opacity-70" /> {formatDuration(cv.audioDuration)}
                                          </p>
                                          <div className="flex-shrink-0">
                                            {!isUnlocked && (
                                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-black">
                                                <Coins className="h-3 w-3" /> {cv.unlockPrice}
                                              </div>
                                            )}
                                            {isUnlocked && cv.unlockPrice > 0 && (
                                              <div className="flex items-center gap-1 py-0.5 px-2 rounded bg-green-50 text-green-600 text-[10px] font-black">
                                                <LockOpen className="h-3 w-3" /> {t("unlocked")}
                                              </div>
                                            )}
                                            {cv.unlockPrice <= 0 && (
                                              <div className="text-emerald-500 flex items-center justify-center dark:text-emerald-400">
                                                <LockOpen className="h-3.5 w-3.5" />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : renderVariantRecursive(pathIndex + 1)}
                            </div>
                          )}

                          {vParts.length > 1 && hasTextContent(vParts.slice(1).join('[DIEN_BIEN]')) && (() => {
                            // Only show remaining variant text if all child choices have been resolved
                            const childVars = variants.filter(cv => cv.parentId === currentV.id);
                            const hasUnresolvedChildren = childVars.length > 0 && !nextV;
                            if (hasUnresolvedChildren) return null;
                            return (
                              <div className={`mt-6 p-1 sm:p-5 md:p-6 rounded-2xl ${variantColor.bg} border ${variantColor.border} shadow-md`}>
                                <StoryReader
                                  chapterId={`variant-${currentV.id}-p2`}
                                  content={vParts.slice(1).join('[DIEN_BIEN]')}
                                  adInterval={shouldShowInlineAds ? 700 : Number.MAX_SAFE_INTEGER}
                                  isLocked={chapterIsLocked}
                                  previewChars={500}
                                  previewPercent={0.1}
                                  lockLabel={lockReasonLabel}
                                  onUnlockRequest={openUnlockModal}
                                />
                              </div>
                            );
                          })()}
                        </div>
                      );
                    };

                    return renderVariantRecursive(0);
                  })()}

                  {(() => {
                    const hasTextContent = (htmlStr?: string | null) => {
                      if (!htmlStr) return false;
                      const stripped = htmlStr.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, '').trim();
                      return stripped.length > 0;
                    };
                    // Check if we should show content after choice
                    // Show if: 1) All variants resolved OR 2) Default variant is selected
                    const shouldShowAfterContent = (() => {
                      if (!selectedVariantId) return false;

                      // Check if default variant is selected
                      const selectedVar = variants.find(v => v.id === selectedVariantId);
                      if (selectedVar && selectedVar.isDefault) return true;

                      // Otherwise check if fully resolved (no more children to choose)
                      const deepestVariant = selectedVariantPath[selectedVariantPath.length - 1];
                      if (!deepestVariant) return false;
                      const childVars = variants.filter(v => v.parentId === deepestVariant.id);
                      return childVars.length === 0;
                    })();
                    return hasTextContent(contentAfterChoice) && shouldShowAfterContent ? (
                      <StoryReader
                        chapterId={`${selectedChapter.id}-part2`}
                        content={contentAfterChoice}
                        adInterval={shouldShowInlineAds ? 700 : Number.MAX_SAFE_INTEGER}
                        isLocked={chapterIsLocked}
                        previewChars={500}
                        previewPercent={0.1}
                        lockLabel={lockReasonLabel}
                        onUnlockRequest={openUnlockModal}
                      />
                    ) : null;
                  })()}
                </div>
              ) : (
                <StoryReader
                  chapterId={selectedChapter.id}
                  content={selectedChapterContentRaw}
                  adInterval={shouldShowInlineAds ? 700 : Number.MAX_SAFE_INTEGER}
                  isLocked={chapterIsLocked}
                  previewChars={500}
                  previewPercent={0.1}
                  lockLabel={lockReasonLabel}
                  onUnlockRequest={openUnlockModal}
                  unlockAd={selectedChapter?.unlockAd ?? null}
                  unlockReappearMinutes={unlockAdReappearMinutes}
                  unlockCountdownSeconds={unlockAdCountdownSeconds}
                  onAdUnlocked={() => {
                    void refreshProfile();
                  }}
                />
              )
            ) : (
              <div className="rounded-2xl bg-white px-3 py-4 sm:px-4 sm:py-5 text-sm leading-7 text-gray-700 dark:bg-[#242526] dark:text-gray-200">
                {translationPendingMessage}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 px-2 sm:px-0">
              <button
                type="button"
                onClick={() => previousChapter && goToChapter(previousChapter, false)}
                disabled={!previousChapter}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{locale === "en" ? "Previous chapter" : "Chương trước"}</span>
                <span className="sm:hidden">{locale === "en" ? "Prev" : "Trước"}</span>
              </button>

              <button
                type="button"
                onClick={() => nextChapter && goToChapter(nextChapter, false)}
                disabled={!nextChapter}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#3a3b3c] dark:text-gray-200 dark:hover:bg-[#464749]"
              >
                <span className="hidden sm:inline">{locale === "en" ? "Next chapter" : "Chương tiếp"}</span>
                <span className="sm:hidden">{locale === "en" ? "Next" : "Tiếp"}</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </section>

        {/* Gift Section */}
        <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-[#242526] lg:col-start-1 lg:col-end-2 lg:row-start-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("giftChapter")}</h2>
            <button
              onClick={() => {
                if (!user) {
                  openLogin();
                  return;
                }
                setIsGiftModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-500/30 transition-all hover:shadow-xl hover:shadow-pink-500/40 active:scale-95"
            >
              <Gift className="h-5 w-5" />
              {t("giftButton")}
            </button>
          </div>
        </section>
      </div>

      {/* Reviews - Full Width */}
      <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-[#242526] mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("readerReviews")}</h2>

        {/* ================= TẦNG TRÊN: THỐNG KÊ SAO & FORM ĐÁNH GIÁ ================= */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 border-b border-gray-100 dark:border-[#303133] pb-8 mb-8">

          {/* BÊN TRÁI: Thống kê tổng quan (4/12 cột) */}
          <div className="lg:col-span-4 bg-slate-50 dark:bg-[#3a3b3c] rounded-xl p-5">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {Number(ratingStats?.averageRating || 0).toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-gray-500">{t("reviewCount", { count: ratingStats?.ratingCount || 0 })}</p>

            <div className="mt-4 space-y-2">
              {(ratingStats?.distribution || [])
                .slice()
                .sort((a, b) => b.rating - a.rating)
                .map((item) => {
                  const total = ratingStats?.ratingCount || 1;
                  const width = Math.round((item.count / total) * 100);
                  return (
                    <div key={item.rating} className="flex items-center gap-2 text-xs">
                      <span className="w-10 font-medium">{t("starLabel", { count: item.rating })}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-[#3a3b3c]">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                      </div>
                      <span className="w-7 text-right">{item.count}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* BÊN PHẢI: Form viết đánh giá (8/12 cột) */}
          <div className="lg:col-span-8">
            <div className="rounded-xl bg-slate-50 dark:bg-[#3a3b3c] p-4 text-sm">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t("writeReview")}</p>
              <div className="mt-2 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setMyRating(star)}
                    className={`rounded-md p-1 ${myRating >= star ? "text-amber-500" : "text-gray-300 dark:text-gray-600"}`}
                  >
                    <Star className="h-5 w-5 fill-current" />
                  </button>
                ))}
              </div>

              <div className="relative mt-3">
                <textarea
                  value={reviewDraft}
                  onChange={(event) => setReviewDraft(event.target.value)}
                  placeholder={t("shareThoughts")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-pink-500 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-100"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="absolute bottom-2 right-2 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#464749] dark:text-gray-400"
                >
                  <Smile className="h-4 w-4" />
                </button>
                {showEmojiPicker ? (
                  <div className="absolute bottom-10 right-2 z-10 flex gap-1 rounded-md bg-white p-1 shadow dark:bg-[#3a3b3c]">
                    {["😍", "🔥", "👏", "💯", "❤️"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setReviewDraft((prev) => `${prev}${emoji}`);
                          setShowEmojiPicker(false);
                        }}
                        className="rounded px-1.5 py-1 text-sm hover:bg-gray-100 dark:hover:bg-[#464749]"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => void submitReview()}
                disabled={isSubmittingReview}
                className="mt-3 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
              >
                {t("submitReview")}
              </button>
            </div>
          </div>

        </div>

        {/* ================= TẦNG DƯỚI: DANH SÁCH BÌNH LUẬN ================= */}
        <div className="w-full">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              onClick={() => setReviewSort("newest")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reviewSort === "newest"
                ? "border-pink-500 bg-pink-50 text-pink-700 dark:border-pink-400 dark:bg-pink-900/30 dark:text-pink-200"
                : "border-gray-300 text-gray-600 dark:border-[#303133] dark:text-gray-300"
                }`}
            >
              {t("sortNewest")}
            </button>
            <button
              onClick={() => setReviewSort("helpful")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reviewSort === "helpful"
                ? "border-pink-500 bg-pink-50 text-pink-700 dark:border-pink-400 dark:bg-pink-900/30 dark:text-pink-200"
                : "border-gray-300 text-gray-600 dark:border-[#303133] dark:text-gray-300"
                }`}
            >
              {t("sortHelpful")}
            </button>
            <button
              onClick={() => setReviewSort("highest")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reviewSort === "highest"
                ? "border-pink-500 bg-pink-50 text-pink-700 dark:border-pink-400 dark:bg-pink-900/30 dark:text-pink-200"
                : "border-gray-300 text-gray-600 dark:border-[#303133] dark:text-gray-300"
                }`}
            >
              {t("sortHighest")}
            </button>
          </div>

          {/* Reviews List */}
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-xl border border-gray-200 p-3 text-sm dark:border-[#303133]">
                <p className="text-gray-800 dark:text-gray-100">
                  <span className="font-semibold">{review.user?.displayName || t("readerFallback")}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span>{review.content || t("noReviewContent")}</span>
                </p>
                <p className="mt-1 text-xs text-amber-500">{"★".repeat(review.rating)}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={() => void toggleReviewLike(review.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${review.likedByMe
                      ? "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-900/30 dark:text-pink-200"
                      : "border-gray-300 text-gray-600 dark:border-[#303133] dark:text-gray-300"
                      }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${review.likedByMe ? "fill-current" : ""}`} />
                    {review.likesCount || 0}
                  </button>
                  <button
                    onClick={() => void toggleReviewHelpful(review.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${review.helpfulByMe
                      ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200"
                      : "border-gray-300 text-gray-600 dark:border-[#303133] dark:text-gray-300"
                      }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {t("helpfulCount", { count: review.helpfulCount || 0 })}
                  </button>
                  <button
                    onClick={() => {
                      if (!user) {
                        openLogin();
                        return;
                      }
                      setReviewReplyTarget((prev) => ({
                        ...prev,
                        [review.id]: prev[review.id] ? null : review.id,
                      }));
                    }}
                    className="rounded-full border border-gray-300 px-2 py-1 text-gray-600 dark:border-[#303133] dark:text-gray-300"
                  >
                    {t("reply")}{review.repliesCount ? ` (${review.repliesCount})` : ""}
                  </button>
                </div>

                {(review.replies || []).length ? (
                  <div className="mt-2 space-y-1 rounded-md bg-gray-50 p-2 text-xs dark:bg-[#3a3b3c]">
                    {(review.replies || []).map((reply) => (
                      <p key={reply.id} className="text-gray-700 dark:text-gray-200">
                        <span className="font-semibold">{reply.user?.displayName || t("readerFallback")}</span>: {reply.content}
                      </p>
                    ))}
                  </div>
                ) : null}

                {reviewReplyTarget[review.id] ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={2}
                      value={reviewReplyDrafts[review.id] || ""}
                      onChange={(event) =>
                        setReviewReplyDrafts((prev) => ({
                          ...prev,
                          [review.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-pink-500 dark:border-[#303133] dark:bg-[#3a3b3c] dark:text-gray-100"
                      placeholder={t("reviewReplyPlaceholder")}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void submitReviewReply(review.id)}
                        className="rounded-md bg-pink-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-pink-700"
                      >
                        {t("send")}
                      </button>
                      <button
                        onClick={() =>
                          setReviewReplyTarget((prev) => ({
                            ...prev,
                            [review.id]: null,
                          }))
                        }
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 dark:border-[#303133] dark:text-gray-300"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {isLoadingReviews ? <p className="text-xs text-gray-500">{t("loadingReviews")}</p> : null}

            <div className="flex flex-wrap items-center gap-2 pt-4">
              {reviewPage < reviewLastPage ? (
                <button
                  onClick={() => void loadMoreReviews()}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-[#303133] dark:text-gray-200 dark:hover:bg-[#464749]"
                >
                  {t("loadMoreReviews")}
                </button>
              ) : null}
              {reviews.length > 5 ? (
                <button
                  onClick={() => void collapseReviews()}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-[#303133] dark:text-gray-200 dark:hover:bg-[#464749]"
                >
                  {t("collapseReviews")}
                </button>
              ) : null}
            </div>
          </div>
        </div>

      </section>

      <RecommendedSlider stories={recommendedStories} lang={currentLang} tone="reader" />

      {mounted && createPortal(
        <>
          {isUnlockModalOpen ? (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsUnlockModalOpen(false);
                  setPendingVariantId(null);
                }
              }}
            >
              <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-[#303133] dark:bg-[#242526] max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {pendingVariantId ? t("unlockVariant") : t("chapterLocked")}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {pendingVariantId
                    ? (() => {
                      const variant = variants.find(v => v.id === pendingVariantId);
                      return variant ? t("unlockVariantDescription", { title: getLocalizedValue(locale, variant.titleVi, variant.titleEn, variant.title) }) : "";
                    })()
                    : lockReasonLabel}
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {pendingVariantId
                    ? (() => {
                      const variant = variants.find(v => v.id === pendingVariantId);
                      return variant ? t("unlockVariantPrice", { price: variant.unlockPrice.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US") }) : "";
                    })()
                    : (() => {
                      const storyBase = storyBaseUnlockPrice;
                      const storyFinal = storyFinalUnlockPrice;
                      const hasStoryDiscount = storyDiscountPercent > 0 && storyBase > storyFinal;
                      const chapterBase = chapterBaseUnlockPrice;
                      const chapterFinal = chapterFinalUnlockPrice;
                      const hasChapterDiscount = chapterDiscountPercent > 0 && chapterBase > chapterFinal;

                      if (selectedChapter?.accessType === "timed" || selectedChapter?.accessType === "vip") {
                        if (hasChapterDiscount) {
                          return `${locale === "en" ? "Unlock chapter with" : "Mở khóa chương với"} ${chapterFinal.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse (${chapterBase.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse, -${chapterDiscountPercent}%).`;
                        }
                        return `${locale === "en" ? "Unlock chapter with" : "Mở khóa chương với"} ${chapterFinal.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse.`;
                      }

                      if (hasStoryDiscount) {
                        return `${locale === "en" ? "Unlock whole story with" : "Mở khóa toàn bộ truyện với"} ${storyFinal.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse (${storyBase.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse, -${storyDiscountPercent}%).`;
                      }
                      return `${locale === "en" ? "Unlock whole story with" : "Mở khóa toàn bộ truyện với"} ${storyFinal.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse.`;
                    })()}
                </p>
                {!pendingVariantId ? (
                  <div className="mt-2 rounded-md border border-pink-100 bg-pink-50 px-3 py-2 text-sm dark:border-pink-900/40 dark:bg-pink-900/20">
                    {(() => {
                      const isChapterUnlock = selectedChapter?.accessType === "timed" || selectedChapter?.accessType === "vip";
                      const basePrice = isChapterUnlock ? chapterBaseUnlockPrice : storyBaseUnlockPrice;
                      const finalPrice = isChapterUnlock ? chapterFinalUnlockPrice : storyFinalUnlockPrice;
                      const discount = isChapterUnlock ? chapterDiscountPercent : storyDiscountPercent;
                      const hasDiscount = discount > 0 && basePrice > finalPrice;
                      return (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-pink-700 dark:text-pink-300">
                            {finalPrice.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse
                          </span>
                          {hasDiscount ? (
                            <span className="text-xs text-gray-500 line-through">
                              {basePrice.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US")} Pulse
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                {!pendingVariantId && selectedChapter?.accessType === "timed" && selectedChapter.unlocksAt && new Date(selectedChapter.unlocksAt).getTime() > Date.now() ? (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                    {lockReasonLabel}
                  </p>
                ) : null}

                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-[#303133] dark:bg-[#3a3b3c]">
                  {t("yourBalance", { balance: Number(user?.pulseBalance ?? user?.credits ?? 0).toLocaleString(locale === 'vi' ? "vi-VN" : "en-US") })}
                </div>

                {unlockError ? <p className="mt-3 text-sm font-medium text-red-600">{unlockError}</p> : null}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsUnlockModalOpen(false);
                      setPendingVariantId(null);
                    }}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#303133] dark:text-gray-200 dark:hover:bg-[#464749]"
                  >
                    {t("cancel")}
                  </button>
                  {showTopupAction ? (
                    <button
                      onClick={() => router.push(`/${currentLang}/profile/topup`)}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                    >
                      <CreditCard className="h-4 w-4" /> {t("topUp")}
                    </button>
                  ) : null}
                  <button
                    disabled={isUnlocking}
                    onClick={pendingVariantId ? handleUnlockVariant : handleBuyVip}
                    className="rounded-md bg-pink-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
                  >
                    {isUnlocking ? "..." : (pendingVariantId ? t("unlockNow") : (locale === "en" ? "Unlock Now" : "Mở khóa ngay"))}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Gift Modal */}
          {isGiftModalOpen ? (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsGiftModalOpen(false);
                  setGiftAmount("");
                  setGiftMessage("");
                  setGiftError("");
                }
              }}
            >
              <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-[#303133] dark:bg-[#242526] max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                    <Gift className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t("giftModalTitle")}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("giftModalDescription")}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { id: 'potion', icon: '🥤', amount: 10 },
                        { id: 'pizza', icon: '🍕', amount: 50 },
                        { id: 'pill', icon: '💊', amount: 100 },
                        { id: 'ticket', icon: '🎟️', amount: 500 },
                        { id: 'car', icon: '🏎️', amount: 1000 },
                        { id: 'dragon', icon: '🐉', amount: 2000 },
                        { id: 'castle', icon: '🏰', amount: 5000 },
                        { id: 'spaceship', icon: '🚀', amount: 10000 },
                      ].map((gift) => (
                        <button
                          key={gift.id}
                          type="button"
                          onClick={() => setGiftAmount(String(gift.amount))}
                          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl p-3 outline-none transition-all duration-200 ${giftAmount === String(gift.amount)
                              ? "bg-pink-50 border-2 border-pink-500 shadow-sm dark:bg-pink-900/20"
                              : "bg-gray-50 border-2 border-transparent hover:bg-gray-100 dark:bg-[#3a3b3c] dark:hover:bg-[#464749]"
                            }`}
                        >
                          <div className="text-3xl filter drop-shadow-sm transition-transform duration-200 hover:scale-110">
                            {gift.icon}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-bold ${giftAmount === String(gift.amount) ? "text-pink-700 dark:text-pink-400" : "text-gray-600 dark:text-gray-300"}`}>
                              {gift.amount}
                            </span>
                            <div className="flex items-center justify-center w-3 h-3 rounded-full bg-yellow-400 text-yellow-900">
                              <Coins className="w-2 h-2" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-[#303133] dark:bg-[#3a3b3c] px-4 py-3 text-sm">
                    <p className="text-gray-600 dark:text-gray-300">
                      {t("yourBalance", { balance: Number(user?.pulseBalance ?? user?.credits ?? 0).toLocaleString() })}
                    </p>
                  </div>

                  {giftError ? (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">{giftError}</p>
                  ) : null}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsGiftModalOpen(false);
                        setGiftAmount("");
                        setGiftMessage("");
                        setGiftError("");
                      }}
                      className="flex-1 rounded-xl border border-gray-300 dark:border-[#303133] px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#464749] transition-colors"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      onClick={handleGiftCredits}
                      disabled={isGiftingCredits}
                      className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGiftingCredits ? "..." : t("giftConfirm")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>,
        document.body
      )}
    </div>
  );
}
