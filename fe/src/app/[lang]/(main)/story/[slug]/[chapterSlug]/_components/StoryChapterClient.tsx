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
  Pause,
  Play,
  Repeat,
  Repeat1,
  Settings2,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Heart,
  Star,
  ThumbsUp,
  Timer,
  Volume2,
  VolumeX,
  Smile,
  Gift,
  Zap,
  Clock3,
  ArrowRight,
  Coins,
  LockOpen,
  Waves,
} from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import FavoriteButton from "@/components/shared/FavoriteButton";
import StoryUpdateSubscriptionButton from "@/components/shared/StoryUpdateSubscriptionButton";
import { getLocaleLabel, getLocalizedValue, getRequestedLocaleValue } from "@/lib/story-localization";
import { cleanChapterTitle, formatChapterTitle } from "@/lib/formatChapterTitle";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { useAuth } from "@/auth/auth-provider";
import { useViewTracking } from "@/hooks/use-view-tracking";

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
  accessType: "free" | "timed" | "vip";
  unlocksAt: string | null;
  isInteractive?: boolean;
  variants?: ChapterVariant[];
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
  },
) => {
  if (chapter.accessType === "free") return null;
  if (chapter.accessType === "vip") return labels.vipOnly;
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
const VIP_UNLOCK_COST = 299;
const VIP_UNLOCK_DAYS = 30;

const chapterNumberFromSlug = (input: string | undefined) => {
  if (!input) return null;
  const match = input.match(/(\d+)$/);
  if (!match) return null;
  return Number(match[1]);
};

export default function StoryChapterClient() {
  const params = useParams<{ slug: string; chapterSlug: string }>();
  const router = useRouter();
  const locale = useLocale();
  const currentLang = locale === "en" ? "en" : "vi";
  const t = useTranslations("StoryChapterClient");
  const slug = params?.slug;
  const chapterSlug = params?.chapterSlug;
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const user = useUserStore((state) => state.user);
  const { refreshProfile } = useAuth();
  const openLogin = useAuthModalStore((state) => state.openLogin);

  // Variant states
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [unlockedVariantIds, setUnlockedVariantIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<ChapterVariant[]>([]);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [isGiftingCredits, setIsGiftingCredits] = useState(false);
  const [giftError, setGiftError] = useState("");
  const [isVariantDropdownOpen, setIsVariantDropdownOpen] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null);
  const [openNestedDropdowns, setOpenNestedDropdowns] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  const setUser = useUserStore((state) => state.setUser);

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
        const rows = reviewsRes.data?.data || [];
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
      setRatingStats(statsRes.data.data);
    },
    [loadReviews, reviewSort],
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
          recommendedResult.status === "fulfilled" ? recommendedResult.value.data?.data || [] : [];
        const fetchedRatingStats =
          ratingResult.status === "fulfilled" ? ratingResult.value.data?.data || null : null;
        const fetchedReviews =
          reviewsResult.status === "fulfilled" ? reviewsResult.value.data?.data || [] : [];
        const fetchedReviewsMeta =
          reviewsResult.status === "fulfilled" ? reviewsResult.value.data?.meta : undefined;

        const detail = detailRes.data;
        const normalizedDetail: StoryDetail = {
          ...detail,
          isInteractive: detail.isInteractive,
          title: getLocalizedValue(locale, detail.titleVi, detail.titleEn, detail.title),
          description: getLocalizedValue(locale, detail.descriptionVi, detail.descriptionEn, detail.description),
          chapters: (detail.chapters || []).map((chapter) => ({
            ...chapter,
            isInteractive: chapter.isInteractive,
            variants: chapter.variants || [],
            title: getLocalizedValue(locale, chapter.titleVi, chapter.titleEn, chapter.title),
            description: getLocalizedValue(locale, chapter.descriptionVi, chapter.descriptionEn, chapter.description || ""),
            content: getLocalizedValue(locale, chapter.contentVi, chapter.contentEn, chapter.content || ""),
            r2AudioUrl: getLocalizedValue(locale, chapter.audioUrlVi, chapter.audioUrlEn, chapter.r2AudioUrl || "") || null,
          })),
        };

        const normalizedRecommended = recommendedData.map((item) => ({
          ...item,
          title: getLocalizedValue(locale, item.titleVi, item.titleEn, item.title),
        }));

        setStory(normalizedDetail);

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
  }, [chapterSlug, locale, router, slug]);

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
        setUnlockedVariantIds(res.data || []);
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
    if (isVipActive) return false;
    if (selectedChapter.accessType === "vip") return true;
    if (selectedChapter.accessType === "timed") {
      if (!selectedChapter.unlocksAt) return true;
      return new Date(selectedChapter.unlocksAt).getTime() > Date.now();
    }
    return false;
  }, [isVipActive, selectedChapter]);

  const lockReasonLabel = useMemo(() => {
    if (!selectedChapter) return t("chapterLocked");
    if (selectedChapter.accessType === "vip") {
      return t("vipOnlyChapter");
    }
    if (selectedChapter.accessType === "timed") {
      return (
        getUnlockLabel(selectedChapter, {
          vipOnly: t("vipOnlyAccess"),
          opensFreeLater: t("opensFreeLater"),
          freeUnlocked: t("freeUnlocked"),
        }) || t("chapterUnlockSoon")
      );
    }
    return t("chapterLocked");
  }, [selectedChapter, t]);

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
      return getRequestedLocaleValue(
        locale,
        selectedVariant.audioUrlVi,
        selectedVariant.audioUrlEn,
        !selectedVariant.audioUrlVi && !selectedVariant.audioUrlEn ? selectedVariant.audioUrl : "",
      ) || "";
    }
    if (selectedChapter) {
      return getRequestedLocaleValue(
        locale,
        selectedChapter.audioUrlVi,
        selectedChapter.audioUrlEn,
        !selectedChapter.audioUrlVi && !selectedChapter.audioUrlEn ? selectedChapter.r2AudioUrl : "",
      ) || "";
    }
    return "";
  }, [locale, selectedChapter, selectedVariant]);
  const localePendingLabel = getLocaleLabel(locale);
  const translationPendingMessage = locale === "en"
    ? `This story does not have an ${localePendingLabel} version for this chapter yet. We will update it as soon as possible.`
    : `Hiện tại truyện này chưa có bản ${localePendingLabel} cho chương này. Chúng tôi sẽ cập nhật sớm nhất có thể.`;

  const hasPlayableAudio = Boolean(selectedChapterAudioUrl);
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
    if (!story || !currentTrack || currentTrack.storyId !== story.id) return;

    const refreshedQueue = story.chapters.map((item) => ({
      id: item.id,
      storyId: story.id,
      chapterId: item.id,
      title: t("chapterTitle", { number: item.chapterNumber, title: cleanChapterTitle(item.title) }),
      storySlug: story.slug,
      chapterNumber: item.chapterNumber,
      author: story.author?.name,
      audioUrl: getRequestedLocaleValue(
        locale,
        item.audioUrlVi,
        item.audioUrlEn,
        !item.audioUrlVi && !item.audioUrlEn ? item.r2AudioUrl : "",
      ) || "",
      coverUrl: item.thumbnailUrl || story.thumbnailUrl || undefined,
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
        setUnlockError("");
        setShowTopupAction(false);
        setIsUnlockModalOpen(true);
        return;
      }

      // If variant is requested but was not provided as arg, use state
      const targetVariant = variantId
        ? (chapter.variants?.find(v => v.id === variantId))
        : (chapter.id === selectedChapterId ? selectedVariant : null);

      const mappedQueue = selectedStory.chapters.map((item) => ({
        id: item.id,
        storyId: selectedStory.id,
        chapterId: item.id,
        title: t("chapterTitle", { number: item.chapterNumber, title: cleanChapterTitle(item.title) }),
        storySlug: selectedStory.slug,
        chapterNumber: item.chapterNumber,
        author: selectedStory.author?.name,
        audioUrl: getRequestedLocaleValue(
          locale,
          item.audioUrlVi,
          item.audioUrlEn,
          !item.audioUrlVi && !item.audioUrlEn ? item.r2AudioUrl : "",
        ) || "",
        coverUrl: item.thumbnailUrl || selectedStory.thumbnailUrl || undefined,
      }));

      let chapterAudioUrl = "";
      let chapterTitle = t("chapterTitle", { number: chapter.chapterNumber, title: cleanChapterTitle(chapter.title) });

      if (targetVariant) {
        chapterAudioUrl = getRequestedLocaleValue(
          locale,
          targetVariant.audioUrlVi,
          targetVariant.audioUrlEn,
          !targetVariant.audioUrlVi && !targetVariant.audioUrlEn ? targetVariant.audioUrl : "",
        ) || "";
        const variantTitle = getLocalizedValue(locale, targetVariant.titleVi, targetVariant.titleEn, targetVariant.title);
        chapterTitle = `${chapterTitle} - ${variantTitle}`;
      } else {
        chapterAudioUrl = getRequestedLocaleValue(
          locale,
          chapter.audioUrlVi,
          chapter.audioUrlEn,
          !chapter.audioUrlVi && !chapter.audioUrlEn ? chapter.r2AudioUrl : "",
        ) || "";
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
    [isVipActive, locale, playTrack, selectedChapterId, selectedVariant, selectedVariantId, setQueue, setTrack, t, togglePlay],
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
        setUnlockError("");
        setShowTopupAction(false);
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
    (index: number, autoPlay = true) => {
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
      goToChapter(selectedChapter, true);
      return;
    }

    // Interactive branching is handled via manual button, not auto-jump

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * story.chapters.length);
      playByIndex(randomIndex);
      return;
    }

    if (repeatMode === "all" && activeChapterIndex >= story.chapters.length - 1) {
      playByIndex(0);
      return;
    }

    playByIndex(activeChapterIndex + 1);
  }, [activeChapterIndex, goToChapter, isShuffle, playByIndex, repeatMode, selectedChapter, selectedVariant, story]);

  const playPrev = useCallback(() => {
    if (!story || !story.chapters.length) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * story.chapters.length);
      playByIndex(randomIndex);
      return;
    }

    if (activeChapterIndex <= 0) {
      playByIndex(0);
      return;
    }

    playByIndex(activeChapterIndex - 1);
  }, [activeChapterIndex, isShuffle, playByIndex, story]);

  const seekBy = (seconds: number) => {
    if (!canSeekSelectedChapter) return;
    seekTo(currentTime + seconds);
  };

  const onShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: story?.title || "AudioTruyen",
          text: t("sharePrompt"),
          url,
        });
        return;
      } catch {
        // ignore canceled share
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
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

  const openUnlockModal = () => {
    setUnlockError("");
    setShowTopupAction(false);
    setIsUnlockModalOpen(true);
  };

  const handleBuyVip = () => {
    if (!user) {
      router.push(`/${currentLang}/login`);
      return;
    }

    if ((user.credits ?? 0) < VIP_UNLOCK_COST) {
      setUnlockError("Credits không đủ để mở VIP. Vui lòng nạp thêm credits.");
      setShowTopupAction(true);
      return;
    }

    const nextExpiry = new Date();
    nextExpiry.setDate(nextExpiry.getDate() + VIP_UNLOCK_DAYS);

    setUser({
      ...user,
      credits: (user.credits ?? 0) - VIP_UNLOCK_COST,
      vipTier: Math.max(1, user.vipTier || 0),
      vipExpirationDate: nextExpiry.toISOString(),
    });

    setUnlockError("");
    setShowTopupAction(false);
    setIsUnlockModalOpen(false);
    void refreshProfile();
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

    if ((user.credits ?? 0) < amount) {
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
        <div className="rounded-3xl border border-blue-200 bg-blue-50/80 p-6 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
          <h1 className="text-2xl font-bold">{story.title}</h1>
          <p className="mt-3 text-sm leading-7">{translationPendingMessage}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <StoryUpdateSubscriptionButton storyId={story.id} />
            <Link
              href={`/story/${story.slug}`}
              className="inline-flex items-center justify-center rounded-full border border-blue-300 px-5 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-100 dark:hover:bg-blue-900/40"
            >
              {t("backToStory")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 md:space-y-8">
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
          {/* Story Info */}
          <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900 lg:col-start-1 lg:col-end-2 lg:row-start-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{story.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t("author")}: <b>{story.author?.name || t("updating")}</b></span>
              <span>{formatStatus(story.status, {
                completed: t("completed"),
                ongoing: t("ongoing"),
                updating: t("updating"),
              })}</span>
              <span>{t("updatedAt")}: {formatDate(story.updatedAt, locale, t("updating"))}</span>
              <span>{t("listens", { count: Number(story.totalViews || 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN") })}</span>
              <span>{Number(story.averageRating || 0).toFixed(1)} ({story.ratingCount || 0})</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <FavoriteButton
                storyId={story.id}
                size="sm"
                label={t("favorite")}
                className="px-4 py-2 text-sm font-medium border shadow-sm"
                activeClassName="border-red-500 bg-red-500 text-white hover:bg-red-600"
                inactiveClassName="border-gray-300 bg-white text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-red-800/60 dark:hover:bg-red-900/20 dark:hover:text-red-300"
              />

              <StoryUpdateSubscriptionButton storyId={story.id} />

              <button
                onClick={onShare}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Share2 className="h-4 w-4" />
                {t("share")}
              </button>
            </div>
          </section>

          {/* Chapter Introduction */}
          <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900 lg:col-start-1 lg:col-end-2 lg:row-start-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("chapterIntro")}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">
              {selectedChapterDescription || translationPendingMessage}
            </p>
          </section>

          {/* RIGHT STICKY SIDEBAR */}
          <div className="lg:col-start-2 lg:row-start-1 lg:row-end-6 relative lg:sticky lg:top-24 h-fit flex flex-col gap-3 z-10">

            {/* Side Panel 1.5: Variant Selection (Interactive Stories) - Moved Inline if hasInlineChoice */}
            {variants.length > 0 && !hasInlineChoice && (
              <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900">

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
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                          isSelected 
                            ? "border-indigo-300 bg-indigo-100 dark:border-indigo-600 dark:bg-indigo-900/60 shadow-sm ring-1 ring-indigo-300/50 cursor-default" 
                            : "border-gray-200 bg-white/50 dark:border-gray-700 dark:bg-gray-800/50 hover:border-gray-400 dark:hover:border-gray-600"
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
            <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900">
              <h2 className="mb-3 flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
                <span className="inline-flex items-center gap-2"><ListMusic className="h-4 w-4" /> {t("currentChapter")}
                </span>
                <span className="text-xs text-gray-500">{t("chaptersCount", { count: chapterCount })}</span>
              </h2>

              <button
                onClick={() => setIsChapterMenuOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg border border-blue-300 px-3 py-2 text-left hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/30"
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
                  })}
                </p>
              ) : null}

              {isChapterMenuOpen ? (
                <div className="mt-3 rounded-xl bg-gray-100 p-2 dark:bg-gray-800">
                  <input
                    value={chapterQuery}
                    onChange={(event) => setChapterQuery(event.target.value)}
                    placeholder={t("searchChapterPlaceholder")}
                    className="mb-2 w-full rounded-md bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
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
                      return (
                        <button
                          key={chapter.id}
                          onClick={() => goToChapter(chapter, true)}
                          className={`w-full rounded-md px-2 py-2 text-left text-xs transition ${isCurrent
                            ? "bg-blue-600 text-white"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                            }`}
                        >
                          <span className="line-clamp-1">{formatChapterTitle(t("chapterKeyword"), chapter.chapterNumber, cleanChapterTitle(getLocalizedValue(locale, chapter.titleVi, chapter.titleEn, chapter.title)))}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>

            {/* Side Panel 2: Audio Player */}
            <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900">
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{t("audioPlayer")}</h2>

              <div className="mt-4 grid gap-3 md:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[136px_minmax(0,1fr)] xl:grid-cols-[148px_minmax(0,1fr)]">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className={`relative h-24 w-24 overflow-hidden rounded-full border-4 border-blue-200 dark:border-blue-900 lg:h-28 lg:w-28 ${isSelectedChapterPlaying ? "animate-spin [animation-duration:10s]" : ""}`}>
                    <img
                      src={playerCoverUrl}
                      alt={story.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="line-clamp-2 text-center text-xs text-gray-500 dark:text-gray-400">
                    {formatChapterTitle(t("chapterKeyword"), selectedChapter.chapterNumber, cleanChapterTitle(getLocalizedValue(locale, selectedChapter.titleVi, selectedChapter.titleEn, selectedChapter.title)))}
                  </p>
                </div>

                <div className="min-w-0 space-y-2.5">
                  <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t("chapterTitle", { number: selectedChapter.chapterNumber, title: selectedChapterTitle })}
                  </p>

                  <input
                    type="range"
                    min={0}
                    max={playerDuration || 0}
                    step={1}
                    value={Math.min(playerCurrentTime, playerDuration || 0)}
                    onChange={(event) => {
                      if (!canSeekSelectedChapter) return;
                      seekTo(Number(event.target.value));
                    }}
                    className="w-full accent-blue-600"
                  />

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatDuration(playerCurrentTime)}</span>
                    <span>{formatDuration(playerDuration)}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                    <button onClick={playPrev} className="rounded-full border border-gray-300 p-2 text-gray-600">
                      <SkipBack className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => seekBy(-10)}
                      disabled={!canSeekSelectedChapter}
                      className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      -10s
                    </button>

                    <button
                      onClick={() => {
                        if (chapterIsLocked) {
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
                      disabled={!hasPlayableAudio}
                      className="rounded-full bg-blue-600 p-3 text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                      {isSelectedChapterPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>

                    <button
                      onClick={() => seekBy(10)}
                      disabled={!canSeekSelectedChapter}
                      className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +10s
                    </button>

                    <button onClick={playNext} className="rounded-full border border-gray-300 p-2 text-gray-600">
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                    <button onClick={() => toggleMute()} className="rounded-full border border-gray-300 p-2 text-gray-600">{isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(event) => setVolume(Number(event.target.value))}
                      className="w-16 sm:w-20 accent-blue-600"
                    />

                    <button
                      onClick={() => setIsShuffle((prev) => !prev)}
                      className={`rounded-full border p-2 ${isShuffle ? "border-blue-500 text-blue-600" : "border-gray-300 text-gray-500"}`}
                    >
                      <Shuffle className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() =>
                        setRepeatMode((prev) => {
                          if (prev === "off") return "all";
                          if (prev === "all") return "one";
                          return "off";
                        })
                      }
                      className={`rounded-full border p-2 ${repeatMode !== "off" ? "border-blue-500 text-blue-600" : "border-gray-300 text-gray-500"}`}
                    >
                      {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                    </button>

                    <button
                      onClick={() => setShowSettings((prev) => !prev)}
                      className="rounded-full bg-gray-100 p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {showSettings ? (
                  <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("playbackSpeed")}</p>
                    <div className="mt-2 grid grid-cols-5 gap-2">
                      {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => setPlaybackRate(rate)}
                          className={`rounded-md px-2 py-1 text-xs ${playbackRate === rate ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>

                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{t("sleepTimer")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[15, 30, 60].map((minute) => (
                        <button
                          key={minute}
                          onClick={() => setSleepTimer(minute)}
                          className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                          {minute}p
                        </button>
                      ))}
                      <button onClick={() => setSleepTimer(null)} className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
                        {t("cancelSleepTimer")}
                      </button>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={customMinutes}
                        onChange={(event) => setCustomMinutes(event.target.value)}
                        className="w-full rounded-md bg-white px-2 py-1 text-xs dark:bg-gray-800"
                        placeholder={t("customMinutesPlaceholder")}
                      />
                      <button
                        onClick={() => {
                          const value = Number(customMinutes);
                          if (value > 0) setSleepTimer(value);
                        }}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                      >
                        {t("setTimer")}
                      </button>
                    </div>

                    {sleepMinutesLeft ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300">
                        <Timer className="h-3.5 w-3.5" /> {t("sleepTimerActive", { minutes: sleepMinutesLeft })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            {/* Side Panel 3: YouTube Player */}
            {selectedChapter.youtubeVideoId ? (
            <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900">
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{t("youtubePlayer")}</h2>
              {chapterIsLocked ? (
                <div className="rounded-xl bg-amber-50/70 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <p className="inline-flex items-center gap-1 font-semibold"><Lock className="h-4 w-4" /> {t("chapterLocked")}</p>
                  <p className="mt-1">{lockReasonLabel}</p>
                  <button
                    onClick={openUnlockModal}
                    className="mt-3 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    {t("unlockYoutube")}
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl bg-white dark:bg-gray-950/70">
                  <iframe
                    title="YouTube audio"
                    className="aspect-video w-full"
                    src={`https://www.youtube.com/embed/${selectedChapter.youtubeVideoId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </section>
            ) : null}

          </div>{/* END RIGHT STICKY SIDEBAR */}

          {/* Chapter Content / Text Reader */}
          <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900 lg:col-start-1 lg:col-end-2 lg:row-start-3">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => previousChapter && goToChapter(previousChapter, false)}
                disabled={!previousChapter}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-5 w-5" />
                {locale === "en" ? "Previous chapter" : "Chương trước"}
              </button>

              <button
                type="button"
                onClick={() => nextChapter && goToChapter(nextChapter, false)}
                disabled={!nextChapter}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                {locale === "en" ? "Next chapter" : "Chương tiếp"}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="min-w-0">
              {selectedChapterContentRaw ? (
                hasInlineChoice ? (
                  <div className="space-y-8">
                    <StoryReader
                      chapterId={`${selectedChapter.id}-part1`}
                      content={contentBeforeChoice}
                      adInterval={700}
                      isLocked={chapterIsLocked}
                      previewChars={500}
                      lockLabel={lockReasonLabel}
                      onUnlockRequest={openUnlockModal}
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
                              base: "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30",
                              hover: "hover:bg-blue-100 dark:hover:bg-blue-900/50",
                              selected: "border-blue-400 bg-blue-100 dark:border-blue-600 dark:bg-blue-900/60 ring-2 ring-blue-300/50",
                              text: "text-blue-900 dark:text-blue-100",
                              textNormal: "text-blue-800 dark:text-blue-200",
                              icon: "text-blue-600 dark:text-blue-400"
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
                              className={`flex flex-col items-start gap-3 rounded-xl p-4 transition-all h-full w-full border ${
                                colorScheme.base
                              } ${
                                isSelected 
                                  ? `${colorScheme.selected} shadow-lg cursor-default` 
                                  : `${colorScheme.hover} shadow-sm`
                              }`}
                              disabled={isSelected}
                            >
                              <div className="w-full flex items-start justify-between gap-3">
                                <p className={`text-base font-bold flex-1 text-left ${
                                  isSelected ? colorScheme.text : colorScheme.textNormal
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
                              { bg: "bg-blue-50 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800" },
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
                                <h4 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                                  {locale === 'en' ? 'Alternative choices:' : 'Các lựa chọn khác:'}
                                </h4>
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
                                        className={`flex flex-col items-start gap-3 rounded-xl p-4 transition-all h-full w-full border ${
                                          colorScheme.base
                                        } ${
                                          isSelected 
                                            ? `${colorScheme.selected} shadow-lg cursor-default` 
                                            : `${colorScheme.hover} shadow-sm`
                                        }`}
                                        disabled={isSelected}
                                      >
                                        <div className="w-full flex items-start justify-between gap-3">
                                          <p className={`text-base font-bold flex-1 text-left ${
                                            isSelected ? colorScheme.text : colorScheme.textNormal
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
                              <div className={`p-5 md:p-6 rounded-2xl ${variantColor.bg} border ${variantColor.border} shadow-md`}>
                                <StoryReader
                                  chapterId={`variant-${currentV.id}-p1`}
                                  content={vParts[0]}
                                  adInterval={700}
                                  isLocked={false}
                                  previewChars={500}
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
                                          className="flex flex-col items-start gap-3 rounded-xl bg-gray-50 p-4 transition-all hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 h-full w-full"
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
                                <div className={`mt-6 p-5 md:p-6 rounded-2xl ${variantColor.bg} border ${variantColor.border} shadow-md`}>
                                  <StoryReader
                                    chapterId={`variant-${currentV.id}-p2`}
                                    content={vParts.slice(1).join('[DIEN_BIEN]')}
                                    adInterval={700}
                                    isLocked={false}
                                    previewChars={500}
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
                          adInterval={700}
                          isLocked={false}
                          previewChars={500}
                        />
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <StoryReader
                    chapterId={selectedChapter.id}
                    content={selectedChapterContentRaw}
                    adInterval={700}
                    isLocked={chapterIsLocked}
                    previewChars={500}
                    lockLabel={lockReasonLabel}
                    onUnlockRequest={openUnlockModal}
                  />
                )
              ) : (
                <div className="rounded-2xl bg-white px-3 py-4 sm:px-4 sm:py-5 text-sm leading-7 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                  {translationPendingMessage}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => previousChapter && goToChapter(previousChapter, false)}
                  disabled={!previousChapter}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="h-5 w-5" />
                  {locale === "en" ? "Previous chapter" : "Chương trước"}
                </button>

                <button
                  type="button"
                  onClick={() => nextChapter && goToChapter(nextChapter, false)}
                  disabled={!nextChapter}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm md:text-base font-semibold text-gray-700 bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {locale === "en" ? "Next chapter" : "Chương tiếp"}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </section>

          {/* Gift Section */}
          <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900 lg:col-start-1 lg:col-end-2 lg:row-start-4">
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
        <section className="rounded-2xl bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-900 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("readerReviews")}</h2>

          {/* ================= TẦNG TRÊN: THỐNG KÊ SAO & FORM ĐÁNH GIÁ ================= */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 border-b border-gray-100 dark:border-gray-800 pb-8 mb-8">
            
            {/* BÊN TRÁI: Thống kê tổng quan (4/12 cột) */}
            <div className="lg:col-span-4 bg-slate-50 dark:bg-gray-800 rounded-xl p-5">
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
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
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
              <div className="rounded-xl bg-slate-50 dark:bg-gray-800 p-4 text-sm">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    className="absolute bottom-2 right-2 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:text-gray-400"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  {showEmojiPicker ? (
                    <div className="absolute bottom-10 right-2 z-10 flex gap-1 rounded-md bg-white p-1 shadow dark:bg-gray-800">
                      {["😍", "🔥", "👏", "💯", "❤️"].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setReviewDraft((prev) => `${prev}${emoji}`);
                            setShowEmojiPicker(false);
                          }}
                          className="rounded px-1.5 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200"
                  : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  }`}
              >
                {t("sortNewest")}
              </button>
              <button
                onClick={() => setReviewSort("helpful")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reviewSort === "helpful"
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200"
                  : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  }`}
              >
                {t("sortHelpful")}
              </button>
              <button
                onClick={() => setReviewSort("highest")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reviewSort === "highest"
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200"
                  : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  }`}
              >
                {t("sortHighest")}
              </button>
            </div>

            {/* Reviews List */}
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
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
                        : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                        }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${review.likedByMe ? "fill-current" : ""}`} />
                      {review.likesCount || 0}
                    </button>
                    <button
                      onClick={() => void toggleReviewHelpful(review.id)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${review.helpfulByMe
                        ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200"
                        : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
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
                      className="rounded-full border border-gray-300 px-2 py-1 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                    >
                      {t("reply")}{review.repliesCount ? ` (${review.repliesCount})` : ""}
                    </button>
                  </div>

                  {(review.replies || []).length ? (
                    <div className="mt-2 space-y-1 rounded-md bg-gray-50 p-2 text-xs dark:bg-gray-800/50">
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
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        placeholder={t("reviewReplyPlaceholder")}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void submitReviewReply(review.id)}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
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
                          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
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
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {t("loadMoreReviews")}
                  </button>
                ) : null}
                {reviews.length > 5 ? (
                  <button
                    onClick={() => void collapseReviews()}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {t("collapseReviews")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

        </section>

        <RecommendedSlider stories={recommendedStories} lang={currentLang} />

        {mounted && createPortal(
          <>
            {isUnlockModalOpen ? (
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setIsUnlockModalOpen(false);
                    setPendingVariantId(null);
                  }
                }}
              >
                <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
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
                      : t("buyVipInfo", { days: VIP_UNLOCK_DAYS, cost: VIP_UNLOCK_COST.toLocaleString(locale === 'vi' ? "vi-VN" : "en-US") })}
                  </p>

                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                    {t("yourBalance", { balance: Number(user?.credits ?? 0).toLocaleString(locale === 'vi' ? "vi-VN" : "en-US") })}
                  </div>

                  {unlockError ? <p className="mt-3 text-sm font-medium text-red-600">{unlockError}</p> : null}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsUnlockModalOpen(false);
                        setPendingVariantId(null);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      {t("cancel")}
                    </button>
                    {showTopupAction ? (
                      <button
                        onClick={() => router.push(`/${currentLang}/topup`)}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                      >
                        <CreditCard className="h-4 w-4" /> {t("topUp")}
                      </button>
                    ) : null}
                    <button
                      disabled={isUnlocking}
                      onClick={pendingVariantId ? handleUnlockVariant : handleBuyVip}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isUnlocking ? "..." : (pendingVariantId ? t("unlockNow") : t("buyVip"))}
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
                <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
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
                              className={`relative flex flex-col items-center justify-center gap-2 rounded-xl p-3 outline-none transition-all duration-200 ${
                                giftAmount === String(gift.amount)
                                  ? "bg-pink-50 border-2 border-pink-500 shadow-sm dark:bg-pink-900/20"
                                  : "bg-gray-50 border-2 border-transparent hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
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

                      <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 px-4 py-3 text-sm">
                        <p className="text-gray-600 dark:text-gray-300">
                          {t("yourBalance", { balance: Number(user?.credits ?? 0).toLocaleString() })}
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
                          className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
