"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  CornerDownRight,
  Headphones,
  Heart,
  Home,
  ListMusic,
  Loader2,
  Lock,
  LockOpen,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";

import AddToPlaylistButton from "@/components/shared/AddToPlaylistButton";
import MusicLikeButton from "@/components/shared/MusicLikeButton";
import PlayNextButton from "@/components/shared/PlayNextButton";
import ShareActionButton from "@/components/shared/ShareActionButton";
import Link from "@/components/shared/LocalizedLink";
import { apiClient } from "@/lib/api/api-client";
import { fetchMusicAccessStatus, fetchMusicLikeStatus, unlockMusicItem } from "@/lib/music/music-interactions";
import {
  type MusicComment,
  listMusicComments,
  createMusicComment,
  replyMusicComment,
  likeMusicComment,
  unlikeMusicComment,
  updateMusicComment,
  deleteMusicComment,
} from "@/lib/music/music-comments";
import {
  formatCompactCount,
  formatMusicDuration,
  normalizeMusicItem,
} from "@/lib/music/normalize-music";
import {
  isMusicTrackActive,
  toPlaylistQueue,
  toSingleQueueTrack,
} from "@/lib/music/music-queue";
import { useAudioStore } from "@/stores/audio-store";
import { useAuthModalStore } from "@/stores/auth-modal-store";
import { useUserStore } from "@/stores/user-store";
import type { MusicApiItem, MusicTrack } from "@/types/music";

type MusicDetailResponse = {
  data: MusicApiItem;
};

type RelatedResponse = {
  data: MusicApiItem[];
};

type DetailAccessState = {
  accessType: "free" | "vip";
  unlockPrice: number;
  unlocked: boolean;
  unlockSource: "free" | "track" | "playlist" | null;
};

type PlaylistChildUnlockTarget = {
  id: string;
  title: string;
  unlockPrice: number;
};

type PlaylistUnlockMode = "track" | "playlist";

type TopupPackage = {
  code: string;
  name?: string;
  nameVi?: string;
  nameEn?: string;
  title?: string;
  titleVi?: string;
  titleEn?: string;
  credits: number;
  priceVnd?: number;
  price?: number;
  currency?: string;
  lang?: string;
  isActive?: boolean;
  displayOrder?: number;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const maybeMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(maybeMessage) && maybeMessage.length) return maybeMessage[0] || fallback;
  if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
  return fallback;
};

const normalizeErrorText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const isInsufficientCreditsText = (message: string) => {
  const normalized = normalizeErrorText(message);
    return (
      normalized.includes("insufficient credits") ||
      normalized.includes("insufficient pulse") ||
      (normalized.includes("khong du") && normalized.includes("credit"))
    );
};

const isInsufficientCreditsError = (error: unknown) => {
  const maybeMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(maybeMessage)) {
    return maybeMessage.some((item) => typeof item === "string" && isInsufficientCreditsText(item));
  }

  if (typeof maybeMessage === "string") {
    return isInsufficientCreditsText(maybeMessage);
  }

  return false;
};

const WAVEFORM_BAR_COUNT = 72;

const createWaveformBars = (seedKey: string) => {
  const seed = seedKey
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
    const wave1 = Math.sin((index + 1) * ((seed % 11) + 1) * 0.17);
    const wave2 = Math.cos((index + 3) * ((seed % 7) + 2) * 0.09);
    const amplitude = Math.abs(wave1 * 0.65 + wave2 * 0.35);
    return 20 + Math.round(amplitude * 72);
  });
};

const formatTimelineTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

function WaveformTimeline({
  bars,
  progress,
  currentTime,
  duration,
  isAnimating,
  disabled,
  onSeek,
}: {
  bars: number[];
  progress: number;
  currentTime: number;
  duration: number;
  isAnimating: boolean;
  disabled: boolean;
  onSeek: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="space-y-2.5">
      <div
        role="slider"
        aria-label="Waveform timeline"
        aria-valuemin={0}
        aria-valuemax={Math.max(Math.round(duration), 0)}
        aria-valuenow={Math.max(Math.round(currentTime), 0)}
        aria-disabled={disabled}
        className={`group relative flex h-14 items-end gap-1 overflow-hidden rounded-2xl border border-pink-100 bg-gradient-to-r from-rose-50 via-white to-slate-50 px-2 py-2 dark:border-[#343943] dark:from-[#1e232b] dark:via-[#1a1f26] dark:to-[#202632] ${
          disabled ? "cursor-default" : "cursor-pointer"
        }`}
        onClick={onSeek}
      >
        {bars.map((height, index) => {
          const barProgress = ((index + 1) / bars.length) * 100;
          const played = barProgress <= safeProgress;
          const style: CSSProperties = {
            height: `${height}%`,
            animationDelay: `${(index % 9) * 0.08}s`,
            animationDuration: `${0.9 + (index % 6) * 0.14}s`,
            animationName: isAnimating ? "waveBarBounce" : "none",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          };

          return (
            <span
              key={`wave-${index}`}
              className={`flex-1 rounded-full transition-colors duration-200 ${
                played
                  ? "bg-gradient-to-t from-pink-500 to-pink-400 dark:from-pink-400 dark:to-rose-300"
                  : "bg-slate-300 dark:bg-slate-600/70"
              }`}
              style={{ ...style, transformOrigin: "bottom center", willChange: "transform" }}
            />
          );
        })}

        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-pink-300/25 via-pink-200/20 to-transparent dark:from-pink-500/20 dark:via-pink-400/12"
          style={{ width: `${safeProgress}%` }}
        />
      </div>

      <style jsx global>{`
        @keyframes waveBarBounce {
          0%,
          100% {
            transform: scaleY(0.45);
          }
          50% {
            transform: scaleY(1);
          }
        }
      `}</style>

      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        <span>{formatTimelineTime(currentTime)}</span>
        <span>{formatTimelineTime(duration)}</span>
      </div>
    </div>
  );
}

export default function MusicDetailPage() {
  const params = useParams<{ lang?: string; slug?: string }>();
  const musicSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentLang = Array.isArray(params?.lang) ? params?.lang[0] : params?.lang;
  const t = useTranslations("MusicDetailPage");

  const openLogin = useAuthModalStore((state) => state.openLogin);
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const accessToken = useUserStore((state) => state.accessToken);
  const isAdmin = user?.roles?.includes("admin") || false;

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const seekTo = useAudioStore((state) => state.seekTo);

  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedTracks, setRelatedTracks] = useState<MusicTrack[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [accessState, setAccessState] = useState<DetailAccessState>({
    accessType: "free",
    unlockPrice: 0,
    unlocked: true,
    unlockSource: null,
  });
  const [accessNotice, setAccessNotice] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [showUnlockConfirmModal, setShowUnlockConfirmModal] = useState(false);
  const [showPlaylistUnlockChoiceModal, setShowPlaylistUnlockChoiceModal] = useState(false);
  const [showPlaylistUnlockPaymentConfirmModal, setShowPlaylistUnlockPaymentConfirmModal] = useState(false);
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] = useState(false);
  const [selectedPlaylistUnlockMode, setSelectedPlaylistUnlockMode] = useState<PlaylistUnlockMode>("track");
  const [playlistUnlockTarget, setPlaylistUnlockTarget] = useState<PlaylistChildUnlockTarget | null>(null);
  const [requiredCreditsForTopup, setRequiredCreditsForTopup] = useState(0);
  const [recommendedTopupPackages, setRecommendedTopupPackages] = useState<TopupPackage[]>([]);
  const [isLoadingTopupPackages, setIsLoadingTopupPackages] = useState(false);
  const [playlistTrackAccess, setPlaylistTrackAccess] = useState<Record<string, DetailAccessState>>({});
  const [relatedTrackAccess, setRelatedTrackAccess] = useState<Record<string, DetailAccessState>>({});
  const currentUserCredits = typeof user?.pulseBalance === "number" && Number.isFinite(user.pulseBalance)
    ? Math.max(0, Math.floor(user.pulseBalance))
    : 0;

  const trackId = track?.id;
  const trackAccessType = track?.accessType;
  const trackUnlockPrice = track?.unlockPrice ?? 0;

  // Comments state
  const [comments, setComments] = useState<MusicComment[]>([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsLastPage, setCommentsLastPage] = useState(1);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentSort, setCommentSort] = useState<"newest" | "oldest">("newest");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);

  // Reply state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Liked comments tracking
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
      }),
    [],
  );

  // ─── Fetch detail ─────────────────────────────

  useEffect(() => {
    if (!musicSlug) return;

    let active = true;

    const loadDetail = async () => {
      setIsLoading(true);

      try {
        const [detailRes, relatedRes] = await Promise.all([
          apiClient.get<MusicDetailResponse>(`/music/${musicSlug}`),
          apiClient.get<RelatedResponse>(`/music/${musicSlug}/related`).catch(() => ({ data: { data: [] as MusicApiItem[] } })),
        ]);

        if (!active) return;

        const normalized = normalizeMusicItem(detailRes.data.data);
        setTrack(normalized);

        const normalizedRelated = (relatedRes.data?.data || [])
          .map((item, index) => normalizeMusicItem(item, index))
          .filter((item) => Boolean(item.audioUrl))
          .slice(0, 5);
        setRelatedTracks(normalizedRelated);
      } catch {
        if (!active) return;
        setTrack(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [musicSlug]);

  // ─── Fetch like status ────────────────────────

  useEffect(() => {
    if (!trackId || !accessToken) return;
    let active = true;

    void fetchMusicLikeStatus(trackId)
      .then((liked) => {
        if (active) setIsLiked(liked);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [accessToken, trackId]);

  useEffect(() => {
    setAccessNotice(null);
    setShowUnlockConfirmModal(false);
    setShowPlaylistUnlockChoiceModal(false);
    setShowPlaylistUnlockPaymentConfirmModal(false);
    setShowInsufficientCreditsModal(false);
    setSelectedPlaylistUnlockMode("track");
    setPlaylistUnlockTarget(null);
    setRequiredCreditsForTopup(0);
    setRecommendedTopupPackages([]);
  }, [trackId]);

  const formatTopupCurrency = useCallback((amount: number, currency: string) => {
    const resolvedCurrency = currency.toUpperCase() === "USD" ? "USD" : "VND";
    const locale = currentLang === "en" ? "en-US" : "vi-VN";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: resolvedCurrency,
      maximumFractionDigits: resolvedCurrency === "USD" ? 2 : 0,
    }).format(amount);
  }, [currentLang]);

  const getTopupPackageLabel = useCallback((pkg: TopupPackage) => {
    if (currentLang === "en") {
      return pkg.titleEn || pkg.nameEn || pkg.title || pkg.name || pkg.code;
    }
    return pkg.titleVi || pkg.nameVi || pkg.title || pkg.name || pkg.code;
  }, [currentLang]);

  const getTopupPackagePrice = useCallback((pkg: TopupPackage) => {
    const currency = typeof pkg.currency === "string" && pkg.currency.trim() ? pkg.currency : "VND";

    if (currency.toUpperCase() === "USD") {
      const usdAmount = typeof pkg.price === "number" && Number.isFinite(pkg.price) ? pkg.price : 0;
      return formatTopupCurrency(Math.max(0, usdAmount), "USD");
    }

    const vndAmount = typeof pkg.priceVnd === "number" && Number.isFinite(pkg.priceVnd)
      ? pkg.priceVnd
      : typeof pkg.price === "number" && Number.isFinite(pkg.price)
        ? pkg.price
        : 0;

    return formatTopupCurrency(Math.max(0, vndAmount), "VND");
  }, [formatTopupCurrency]);

  const loadRecommendedTopupPackages = useCallback(async (requiredCredits: number) => {
    setIsLoadingTopupPackages(true);

    try {
      const response = await apiClient.get("/packages");
      const responseData = response.data as unknown;

      const rawPackages: TopupPackage[] = Array.isArray(responseData)
        ? responseData as TopupPackage[]
        : Array.isArray((responseData as { data?: unknown[] })?.data)
          ? ((responseData as { data: unknown[] }).data as TopupPackage[])
          : [];

      const filteredPackages = rawPackages
        .filter((pkg) => (pkg.isActive ?? true) && typeof pkg.credits === "number" && Number.isFinite(pkg.credits) && pkg.credits > 0)
        .filter((pkg) => {
          if (!pkg.lang || !pkg.lang.trim()) return true;
          return pkg.lang === (currentLang === "en" ? "en" : "vi");
        });

      const lowerCandidates = filteredPackages
        .filter((pkg) => pkg.credits < requiredCredits)
        .sort((a, b) => {
          const diffA = requiredCredits - a.credits;
          const diffB = requiredCredits - b.credits;
          if (diffA !== diffB) return diffA - diffB;
          return b.credits - a.credits;
        });

      const greaterOrEqualCandidates = filteredPackages
        .filter((pkg) => pkg.credits >= requiredCredits)
        .sort((a, b) => {
          const diffA = a.credits - requiredCredits;
          const diffB = b.credits - requiredCredits;
          if (diffA !== diffB) return diffA - diffB;
          return a.credits - b.credits;
        });

      const selected: TopupPackage[] = [];
      const selectedCodes = new Set<string>();

      const pushIfNeeded = (pkg?: TopupPackage) => {
        if (!pkg || selectedCodes.has(pkg.code) || selected.length >= 3) return;
        selected.push(pkg);
        selectedCodes.add(pkg.code);
      };

      pushIfNeeded(lowerCandidates[0]);
      pushIfNeeded(greaterOrEqualCandidates[0]);
      pushIfNeeded(greaterOrEqualCandidates[1]);

      if (selected.length < 3) {
        const fallbackSorted = filteredPackages
          .slice()
          .sort((a, b) => {
            const diffA = Math.abs(a.credits - requiredCredits);
            const diffB = Math.abs(b.credits - requiredCredits);
            if (diffA !== diffB) return diffA - diffB;
            return a.credits - b.credits;
          });

        fallbackSorted.forEach((pkg) => {
          pushIfNeeded(pkg);
        });
      }

      const nextPackages = selected;

      setRecommendedTopupPackages(nextPackages);
    } catch {
      setRecommendedTopupPackages([]);
    } finally {
      setIsLoadingTopupPackages(false);
    }
  }, [currentLang]);

  const openInsufficientCreditsModal = useCallback((requiredCredits: number) => {
    const normalizedRequiredCredits = Math.max(1, Math.floor(requiredCredits || 0));
    setRequiredCreditsForTopup(normalizedRequiredCredits);
    setShowInsufficientCreditsModal(true);
    void loadRecommendedTopupPackages(normalizedRequiredCredits);
  }, [loadRecommendedTopupPackages]);

  useEffect(() => {
    if (!trackId) return;

    const normalizedAccessType = trackAccessType === "vip" ? "vip" : "free";
    const normalizedUnlockPrice = Math.max(0, Math.floor(trackUnlockPrice || 0));

    if (normalizedAccessType === "free" || normalizedUnlockPrice <= 0) {
      setAccessState({
        accessType: "free",
        unlockPrice: 0,
        unlocked: true,
        unlockSource: "free",
      });
      setIsCheckingAccess(false);
      return;
    }

    if (!accessToken) {
      setAccessState({
        accessType: "vip",
        unlockPrice: normalizedUnlockPrice,
        unlocked: false,
        unlockSource: null,
      });
      setIsCheckingAccess(false);
      return;
    }

    let active = true;
    setIsCheckingAccess(true);

    void fetchMusicAccessStatus(trackId)
      .then((status) => {
        if (!active || !status) return;
        setAccessState({
          accessType: status.accessType === "vip" ? "vip" : "free",
          unlockPrice: Math.max(0, Math.floor(status.unlockPrice || 0)),
          unlocked: Boolean(status.unlocked),
          unlockSource: status.unlockSource || null,
        });
      })
      .catch(() => {
        if (!active) return;
        setAccessState({
          accessType: normalizedAccessType,
          unlockPrice: normalizedUnlockPrice,
          unlocked: false,
          unlockSource: null,
        });
      })
      .finally(() => {
        if (active) setIsCheckingAccess(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, trackAccessType, trackId, trackUnlockPrice]);

  useEffect(() => {
    if (!track || track.contentType !== "playlist") {
      setPlaylistTrackAccess({});
      return;
    }

    const baseAccessState: Record<string, DetailAccessState> = {};

    track.playlistTracks.forEach((child) => {
      const childAccessType = child.accessType === "vip" ? "vip" : "free";
      const childUnlockPrice = Math.max(0, Math.floor(child.unlockPrice || 0));
      const childLocked = childAccessType === "vip" && childUnlockPrice > 0;

      baseAccessState[child.id] = {
        accessType: childAccessType,
        unlockPrice: childUnlockPrice,
        unlocked: !childLocked,
        unlockSource: childLocked ? null : "free",
      };
    });

    if (!accessToken) {
      setPlaylistTrackAccess(baseAccessState);
      return;
    }

    const lockedChildIds = track.playlistTracks
      .filter((child) => child.accessType === "vip" && Math.max(0, Math.floor(child.unlockPrice || 0)) > 0)
      .map((child) => child.id);

    if (!lockedChildIds.length) {
      setPlaylistTrackAccess(baseAccessState);
      return;
    }

    let active = true;

    void Promise.allSettled(lockedChildIds.map((id) => fetchMusicAccessStatus(id)))
      .then((results) => {
        if (!active) return;

        const nextState = { ...baseAccessState };

        results.forEach((result, index) => {
          const childId = lockedChildIds[index];

          if (result.status !== "fulfilled" || !result.value || !childId) return;

          const status = result.value;
          nextState[childId] = {
            accessType: status.accessType === "vip" ? "vip" : "free",
            unlockPrice: Math.max(0, Math.floor(status.unlockPrice || 0)),
            unlocked: Boolean(status.unlocked),
            unlockSource: status.unlockSource || null,
          };
        });

        setPlaylistTrackAccess(nextState);
      })
      .catch(() => {
        if (active) {
          setPlaylistTrackAccess(baseAccessState);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, track]);

  useEffect(() => {
    if (!relatedTracks.length) {
      setRelatedTrackAccess({});
      return;
    }

    const baseAccessState: Record<string, DetailAccessState> = {};

    relatedTracks.forEach((item) => {
      const accessType = item.accessType === "vip" ? "vip" : "free";
      const unlockPrice = Math.max(0, Math.floor(item.unlockPrice || 0));
      const locked = accessType === "vip" && unlockPrice > 0;

      baseAccessState[item.id] = {
        accessType,
        unlockPrice,
        unlocked: !locked,
        unlockSource: locked ? null : "free",
      };
    });

    if (!accessToken) {
      setRelatedTrackAccess(baseAccessState);
      return;
    }

    const lockedIds = relatedTracks
      .filter((item) => item.accessType === "vip" && Math.max(0, Math.floor(item.unlockPrice || 0)) > 0)
      .map((item) => item.id);

    if (!lockedIds.length) {
      setRelatedTrackAccess(baseAccessState);
      return;
    }

    let active = true;

    void Promise.allSettled(lockedIds.map((id) => fetchMusicAccessStatus(id)))
      .then((results) => {
        if (!active) return;

        const nextState = { ...baseAccessState };

        results.forEach((result, index) => {
          const targetId = lockedIds[index];
          if (result.status !== "fulfilled" || !result.value || !targetId) return;

          const status = result.value;
          nextState[targetId] = {
            accessType: status.accessType === "vip" ? "vip" : "free",
            unlockPrice: Math.max(0, Math.floor(status.unlockPrice || 0)),
            unlocked: Boolean(status.unlocked),
            unlockSource: status.unlockSource || null,
          };
        });

        setRelatedTrackAccess(nextState);
      })
      .catch(() => {
        if (active) {
          setRelatedTrackAccess(baseAccessState);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, relatedTracks]);

  const promptLogin = useCallback(() => {
    setAccessNotice({
      tone: "info",
      text: t("loginToUnlockTrack"),
    });
    openLogin();
  }, [openLogin, t]);

  const formatUnlockSource = useCallback((source: DetailAccessState["unlockSource"]) => {
    if (source === "playlist") return t("unlockSourcePlaylist");
    if (source === "free") return t("unlockSourceFree");
    return t("unlockSourceTrack");
  }, [t]);

  const isTrackLocked = accessState.accessType === "vip" && accessState.unlockPrice > 0 && !accessState.unlocked;

  const ensureCurrentTrackPlayable = useCallback(() => {
    if (!track || !isTrackLocked) return true;

    if (!accessToken) {
      promptLogin();
      return false;
    }

    setAccessNotice({
      tone: "error",
      text: t("unlockBeforePlay"),
    });
    return false;
  }, [accessToken, isTrackLocked, promptLogin, t, track]);

  const handleUnlockCurrentTrack = async (): Promise<boolean> => {
    if (!track) return false;

    if (!accessToken) {
      promptLogin();
      return false;
    }

    setIsUnlocking(true);
    setAccessNotice(null);

    try {
      const result = await unlockMusicItem(track.id);

      setAccessState((prev) => ({
        ...prev,
        unlockPrice: typeof result?.unlockPrice === "number" ? Math.max(0, Math.floor(result.unlockPrice)) : prev.unlockPrice,
        unlocked: true,
        unlockSource: result?.unlockSource || "track",
      }));

      if (track.contentType === "playlist") {
        setPlaylistTrackAccess((prev) => {
          const next = { ...prev };

          track.playlistTracks.forEach((child) => {
            const previous = next[child.id];
            const accessType = previous?.accessType || (child.accessType === "vip" ? "vip" : "free");
            const unlockPrice = previous?.unlockPrice ?? Math.max(0, Math.floor(child.unlockPrice || 0));

            next[child.id] = {
              accessType,
              unlockPrice,
              unlocked: true,
              unlockSource: "playlist",
            };
          });

          return next;
        });
      }

      if (user && typeof result?.balance === "number") {
        setUser({ ...user, credits: result.balance });
        setUser({ ...user, pulseBalance: result.balance });
        setUser({ ...user, pulseBalance: result.balance });
      }

      const chargedCredits = typeof result?.chargedCredits === "number" ? Math.max(0, result.chargedCredits) : 0;
      setAccessNotice({
        tone: "success",
        text: t("unlockSuccess", {
          chargedCredits,
          suffix: chargedCredits > 0 ? ` (-${chargedCredits} credits)` : "",
        }),
      });
      return true;
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        setShowUnlockConfirmModal(false);
        setAccessNotice(null);
        openInsufficientCreditsModal(accessState.unlockPrice);
        return false;
      }

      setAccessNotice({
        tone: "error",
        text: getApiErrorMessage(
          error,
          t("unlockFailed"),
        ),
      });
      return false;
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleConfirmUnlock = async () => {
    const success = await handleUnlockCurrentTrack();
    if (success) {
      setShowUnlockConfirmModal(false);
    }
  };

  const openPlaylistUnlockChoice = (target: PlaylistChildUnlockTarget) => {
    if (!accessToken) {
      setAccessNotice({
        tone: "info",
        text: t("loginToUnlockTrack"),
      });
      promptLogin();
      return;
    }

    setPlaylistUnlockTarget(target);
    setSelectedPlaylistUnlockMode("track");
    setShowPlaylistUnlockPaymentConfirmModal(false);
    setShowPlaylistUnlockChoiceModal(true);
  };

  const closePlaylistUnlockFlow = () => {
    setShowPlaylistUnlockChoiceModal(false);
    setShowPlaylistUnlockPaymentConfirmModal(false);
    setSelectedPlaylistUnlockMode("track");
    setPlaylistUnlockTarget(null);
  };

  const moveToPlaylistUnlockPaymentConfirm = () => {
    if (!playlistUnlockTarget) return;
    if (selectedPlaylistUnlockMode === "playlist" && !(accessState.accessType === "vip" && accessState.unlockPrice > 0)) {
      return;
    }

    setShowPlaylistUnlockChoiceModal(false);
    setShowPlaylistUnlockPaymentConfirmModal(true);
  };

  const handleUnlockPlaylistChild = async (mode: PlaylistUnlockMode) => {
    if (!track || !playlistUnlockTarget) return;
    if (!accessToken) {
      promptLogin();
      return;
    }

    setIsUnlocking(true);
    setAccessNotice(null);

    const targetId = mode === "playlist" ? track.id : playlistUnlockTarget.id;

    try {
      const result = await unlockMusicItem(targetId);

      if (mode === "playlist") {
        setAccessState((prev) => ({
          ...prev,
          unlockPrice: typeof result?.unlockPrice === "number" ? Math.max(0, Math.floor(result.unlockPrice)) : prev.unlockPrice,
          unlocked: true,
          unlockSource: "playlist",
        }));

        setPlaylistTrackAccess((prev) => {
          const next = { ...prev };

          track.playlistTracks.forEach((child) => {
            const previous = next[child.id];
            const accessType = previous?.accessType || (child.accessType === "vip" ? "vip" : "free");
            const unlockPrice = previous?.unlockPrice ?? Math.max(0, Math.floor(child.unlockPrice || 0));

            next[child.id] = {
              accessType,
              unlockPrice,
              unlocked: true,
              unlockSource: "playlist",
            };
          });

          return next;
        });
      } else {
        setPlaylistTrackAccess((prev) => ({
          ...prev,
          [playlistUnlockTarget.id]: {
            accessType: "vip",
            unlockPrice: Math.max(0, Math.floor(playlistUnlockTarget.unlockPrice || 0)),
            unlocked: true,
            unlockSource: result?.unlockSource || "track",
          },
        }));
      }

      if (user && typeof result?.balance === "number") {
        setUser({ ...user, credits: result.balance });
      }

      const chargedCredits = typeof result?.chargedCredits === "number" ? Math.max(0, result.chargedCredits) : 0;
      setAccessNotice({
        tone: "success",
        text: t("unlockSuccess", {
          chargedCredits,
          suffix: chargedCredits > 0 ? ` (-${chargedCredits} credits)` : "",
        }),
      });
      closePlaylistUnlockFlow();
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        closePlaylistUnlockFlow();
        setAccessNotice(null);
        const requiredCredits = mode === "playlist"
          ? Math.max(0, Math.floor(accessState.unlockPrice || 0))
          : Math.max(0, Math.floor(playlistUnlockTarget.unlockPrice || 0));
        openInsufficientCreditsModal(requiredCredits);
        return;
      }

      setAccessNotice({
        tone: "error",
        text: getApiErrorMessage(
          error,
          t("unlockFailed"),
        ),
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  // ─── Comments ─────────────────────────────────

  const loadComments = useCallback(
    async (targetPage: number, reset = false) => {
      if (!track?.id) return;

      setIsLoadingComments(true);

      try {
        const result = await listMusicComments(track.id, {
          page: targetPage,
          limit: 10,
          sort: commentSort,
        });

        if (reset) {
          setComments(result.data);
        } else {
          setComments((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newItems = result.data.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newItems];
          });
        }

        setCommentsPage(result.meta.page);
        setCommentsLastPage(result.meta.lastPage);
        setCommentsTotal(result.meta.total);
      } catch {
        if (reset) setComments([]);
      } finally {
        setIsLoadingComments(false);
      }
    },
    [commentSort, track?.id],
  );

  useEffect(() => {
    void loadComments(1, true);
  }, [loadComments]);

  const handleSubmitComment = async () => {
    if (!track?.id || !newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);

    try {
      const created = await createMusicComment(track.id, newComment.trim());
      if (created) {
        setComments((prev) => (commentSort === "newest" ? [created, ...prev] : [...prev, created]));
        setCommentsTotal((prev) => prev + 1);
        setNewComment("");
      }
    } catch {
      // Keep UI stable.
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || isSubmittingReply) return;

    setIsSubmittingReply(true);

    try {
      const created = await replyMusicComment(parentId, replyContent.trim());
      if (created) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, children: [...c.children, created] }
              : c,
          ),
        );
        setCommentsTotal((prev) => prev + 1);
        setReplyContent("");
        setReplyingToId(null);
      }
    } catch {
      // Keep UI stable.
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    const isCurrentlyLiked = likedCommentIds.has(commentId);

    try {
      if (isCurrentlyLiked) {
        await unlikeMusicComment(commentId);
        setLikedCommentIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        // Update likeCount in comment
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, likeCount: Math.max(0, c.likeCount - 1) };
            return {
              ...c,
              children: c.children.map((r) =>
                r.id === commentId ? { ...r, likeCount: Math.max(0, r.likeCount - 1) } : r,
              ),
            };
          }),
        );
      } else {
        await likeMusicComment(commentId);
        setLikedCommentIds((prev) => new Set(prev).add(commentId));
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, likeCount: c.likeCount + 1 };
            return {
              ...c,
              children: c.children.map((r) =>
                r.id === commentId ? { ...r, likeCount: r.likeCount + 1 } : r,
              ),
            };
          }),
        );
      }
    } catch {
      // Keep UI stable.
    }
  };

  const startEditComment = (comment: MusicComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  const saveEditedComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;

    setPendingCommentId(commentId);

    try {
      const updated = await updateMusicComment(commentId, editingCommentContent.trim());
      if (updated) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, content: updated.content, updatedAt: updated.updatedAt };
            return {
              ...c,
              children: c.children.map((r) =>
                r.id === commentId ? { ...r, content: updated.content, updatedAt: updated.updatedAt } : r,
              ),
            };
          }),
        );
        cancelEditComment();
      }
    } catch {
      // Keep UI stable.
    } finally {
      setPendingCommentId(null);
    }
  };

  const handleDeleteComment = async (comment: MusicComment) => {
    if (!window.confirm(t("deleteCommentConfirm"))) return;

    setPendingCommentId(comment.id);

    try {
      await deleteMusicComment(comment.id);
      setComments((prev) =>
        prev
          .filter((c) => c.id !== comment.id)
          .map((c) => ({
            ...c,
            children: c.children.filter((r) => r.id !== comment.id),
          })),
      );
      setCommentsTotal((prev) => Math.max(0, prev - 1));
    } catch {
      // Keep UI stable.
    } finally {
      setPendingCommentId(null);
    }
  };

  // ─── Player actions ───────────────────────────

  const handlePlayTrack = (item: MusicTrack) => {
    if (item.id === track?.id && !ensureCurrentTrackPlayable()) {
      return;
    }

    const isPlaylist = item.contentType === "playlist";
    const playlistQueue = isPlaylist ? toPlaylistQueue(item) : [];
    const isCurrentMatch = isPlaylist
      ? playlistQueue.some((row) => row.id === currentTrack?.id)
      : currentTrack?.id === item.id;

    if (isCurrentMatch) {
      togglePlay(!isPlaying);
      return;
    }

    if (isPlaylist) {
      if (!playlistQueue.length) return;
      const firstTrack = playlistQueue[0];
      if (!firstTrack) return;
      playTrack(firstTrack, playlistQueue);
      return;
    }

    playTrack(toSingleQueueTrack(item), [toSingleQueueTrack(item)]);
  };

  const handlePlayPlaylistChild = (parent: MusicTrack, index: number, childAccessState?: DetailAccessState) => {
    const isChildLocked = Boolean(
      childAccessState
      && childAccessState.accessType === "vip"
      && childAccessState.unlockPrice > 0
      && !childAccessState.unlocked,
    );

    if (isChildLocked) {
      const target = parent.playlistTracks[index];
      if (!target) return;

      openPlaylistUnlockChoice({
        id: target.id,
        title: target.title,
        unlockPrice: Math.max(0, Math.floor(childAccessState?.unlockPrice || target.unlockPrice || 0)),
      });
      return;
    }

    const queue = toPlaylistQueue(parent);
    const target = queue[index];
    if (!target) return;

    const isCurrent = currentTrack?.id === target.id;
    if (isCurrent) {
      togglePlay(!isPlaying);
      return;
    }

    playTrack(target, queue);
  };

  const resolvePlaylistQueue = useCallback(async (item: MusicTrack) => {
    const existingQueue = toPlaylistQueue(item);
    if (existingQueue.length) return existingQueue;

    if (!item.slug) return [];

    try {
      const response = await apiClient.get<MusicDetailResponse>(`/music/${item.slug}`);
      const normalized = normalizeMusicItem(response.data.data);
      return toPlaylistQueue(normalized);
    } catch {
      return [];
    }
  }, []);

  const waveformBars = useMemo(() => createWaveformBars(track?.id || "music-wave"), [track?.id]);
  const baseOriginalUnlockPrice = typeof track?.originalUnlockPrice === "number"
    ? Math.max(0, Math.floor(track.originalUnlockPrice))
    : 0;
  const hasBaseDiscount = Boolean(track && track.accessType === "vip" && baseOriginalUnlockPrice > track.unlockPrice);
  const isActive = track ? isMusicTrackActive(track, currentTrack) : false;
  const playing = isActive && isPlaying;
  const playbackDuration = track
    ? (isActive ? (duration > 0 ? duration : track.audioDuration || 0) : (track.audioDuration || 0))
    : 0;
  const playbackTime = isActive ? Math.min(currentTime, playbackDuration || currentTime) : 0;
  const playbackProgress = playbackDuration > 0 ? Math.min(100, (playbackTime / playbackDuration) * 100) : 0;

  const handleWaveSeek = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isActive || playbackDuration <= 0 || isTrackLocked) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekTo(ratio * playbackDuration);
  }, [isActive, isTrackLocked, playbackDuration, seekTo]);

  // ─── Render ───────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6 pb-40">
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-[#1e1e1e]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="h-96 animate-pulse rounded-3xl bg-slate-100 dark:bg-[#1e1e1e]" />
          <div className="h-96 animate-pulse rounded-3xl bg-slate-100 dark:bg-[#1e1e1e]" />
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="mx-auto max-w-[1280px] pb-40">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center text-sm font-semibold text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {t("notFound")}
        </div>
      </div>
    );
  }

  const renderCommentItem = (comment: MusicComment, isChild = false) => {
    const canManage = Boolean(isAdmin || (user?.id && user.id === comment.userId));
    const isEditing = editingCommentId === comment.id;
    const isCommentLiked = likedCommentIds.has(comment.id);

    return (
      <div
        key={comment.id}
        className={`${
          isChild
            ? "ml-8 border-l-2 border-pink-200/40 pl-4 dark:border-pink-900/30"
            : "rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#2f2f2f] dark:bg-[#141414]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-[#2b2b2b]">
              {comment.user.avatarUrl ? (
                <Image
                  src={comment.user.avatarUrl}
                  alt={comment.user.displayName}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-600 dark:text-zinc-300">
                  {comment.user.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-800 dark:text-zinc-100">{comment.user.displayName}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                {dateFormatter.format(new Date(comment.createdAt))}
              </p>
            </div>
          </div>

          {canManage ? (
            <div className="flex items-center gap-1">
              {!isEditing ? (
                <button
                  onClick={() => startEditComment(comment)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#242424]"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
              <button
                onClick={() => void handleDeleteComment(comment)}
                disabled={pendingCommentId === comment.id}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-rose-400 transition hover:bg-rose-50 disabled:opacity-60 dark:hover:bg-rose-950/30"
              >
                {pendingCommentId === comment.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-2">
            <textarea
              value={editingCommentContent}
              onChange={(event) => setEditingCommentContent(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-pink-400 dark:border-[#333] dark:bg-[#191919] dark:text-zinc-200"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                onClick={cancelEditComment}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-[#3a3a3a] dark:text-zinc-300"
              >
                <X className="h-3 w-3" /> {t("cancel")}
              </button>
              <button
                onClick={() => void saveEditedComment(comment.id)}
                disabled={pendingCommentId === comment.id}
                className="inline-flex items-center gap-1 rounded-full bg-pink-500 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-pink-600 disabled:opacity-60"
              >
                {pendingCommentId === comment.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {t("save")}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-zinc-300">{comment.content}</p>
        )}

        {/* Comment actions: like + reply */}
        {!isEditing ? (
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => void handleToggleCommentLike(comment.id)}
              className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
                isCommentLiked
                  ? "text-pink-600 dark:text-pink-300"
                  : "text-slate-400 hover:text-pink-600 dark:text-zinc-500 dark:hover:text-pink-300"
              }`}
            >
              <ThumbsUp className={`h-3 w-3 ${isCommentLiked ? "fill-current" : ""}`} />
              {comment.likeCount > 0 ? comment.likeCount : null}
            </button>

            {!isChild && accessToken ? (
              <button
                onClick={() => {
                  setReplyingToId(replyingToId === comment.id ? null : comment.id);
                  setReplyContent("");
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-pink-600 dark:text-zinc-500"
              >
                <CornerDownRight className="h-3 w-3" /> {t("reply")}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Reply form */}
        {replyingToId === comment.id ? (
          <div className="mt-3 ml-8 flex gap-2">
            <input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={t("replyPlaceholder")}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-orange-400 dark:border-[#333] dark:bg-[#191919] dark:text-zinc-200"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmitReply(comment.id);
                }
              }}
            />
            <button
              onClick={() => void handleSubmitReply(comment.id)}
              disabled={isSubmittingReply || !replyContent.trim()}
              className="inline-flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmittingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : null}

        {/* Render replies */}
        {!isChild && comment.children.length > 0 ? (
          <div className="mt-3 space-y-3">
            {comment.children.map((reply) => renderCommentItem(reply, true))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-40">
      <div className="flex items-center gap-2 px-2 text-sm text-slate-500 dark:text-zinc-400">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-pink-600">
          <Home className="h-3.5 w-3.5" />
          <span>{currentLang === "en" ? "Home" : "Trang chủ"}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-slate-700 dark:text-zinc-200">{track.title}</span>
      </div>

      {/* Hero */}
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717]">
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="relative min-h-[250px] sm:min-h-[320px] lg:min-h-[430px]">
            <Image
              src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
              alt={track.title}
              fill
              unoptimized
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
          </div>

          <div className="flex min-h-[430px] flex-col px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-pink-700 dark:bg-pink-950/30 dark:text-pink-300">
                  {track.contentType === "playlist" ? <ListMusic className="h-3 w-3" /> : <Headphones className="h-3 w-3" />}
                  {track.contentType === "playlist" ? "Playlist" : track.contentType === "podcast" ? "Podcast" : "Single"}
                </span>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
                    track.accessType === "vip"
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  }`}
                >
                  {track.accessType === "vip" ? (
                    <span className="flex flex-col leading-tight">
                      {hasBaseDiscount ? <span className="text-[9px] opacity-80 line-through">{baseOriginalUnlockPrice} credits</span> : null}
                      <span>{`${currentLang === "en" ? "VIP Unlock" : "VIP mở khóa"} ${track.unlockPrice} credits`}</span>
                    </span>
                  ) : (currentLang === "en" ? "Free" : "Miễn phí")}
                </span>
              </div>

              <h1 className="text-2xl font-black leading-tight text-slate-900 sm:text-[2rem] dark:text-zinc-100">{track.title}</h1>

              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 md:gap-x-8">
                <p className="flex min-w-0 items-center gap-1 text-slate-700 dark:text-zinc-300">
                  <span className="shrink-0 text-slate-500 dark:text-zinc-400">{t("author")}:</span>
                  <span className="truncate font-semibold text-slate-900 dark:text-zinc-100">{track.artist}</span>
                </p>

                <p className="flex min-w-0 items-center gap-1 text-slate-700 dark:text-zinc-300">
                  <span className="shrink-0 text-slate-500 dark:text-zinc-400">{t("lastUpdated")}:</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">
                    {track.updatedAt ? dateFormatter.format(new Date(track.updatedAt)) : "-"}
                  </span>
                </p>

                <p className="flex min-w-0 items-center gap-1 text-slate-700 dark:text-zinc-300">
                  <span className="shrink-0 text-slate-500 dark:text-zinc-400">{t("duration")}:</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">{formatMusicDuration(track.audioDuration)}</span>
                </p>
              </div>

              {track.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {track.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/music?tag=${encodeURIComponent(tag)}`}
                      className="rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-600 transition hover:bg-pink-100 dark:bg-pink-950/30 dark:text-pink-300"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              ) : null}

              {track.introEnabled !== false && track.description ? (
                <p className="text-sm leading-7 text-slate-600 dark:text-zinc-300">{track.description}</p>
              ) : null}
            </div>

            <div className="mt-5">
              <WaveformTimeline
                bars={waveformBars}
                progress={playbackProgress}
                currentTime={playbackTime}
                duration={playbackDuration}
                isAnimating={playing}
                disabled={!isActive || playbackDuration <= 0 || isTrackLocked}
                onSeek={handleWaveSeek}
              />
            </div>

            <div className="mt-4 flex items-center justify-start gap-6 border-y border-slate-100 py-2 text-xs text-slate-500 dark:border-[#2b2b2b] dark:text-zinc-400 sm:gap-8">
              <span className="flex flex-col items-center gap-0.5">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-zinc-100">
                  <Headphones className="h-3.5 w-3.5" /> {formatCompactCount(track.playCount)}
                </span>
                <span className="text-[10px]">{t("plays")}</span>
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-zinc-100">
                  <Heart className="h-3.5 w-3.5" /> {formatCompactCount(track.likeCount)}
                </span>
                <span className="text-[10px]">{t("likes")}</span>
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-zinc-100">
                  <MessageCircle className="h-3.5 w-3.5" /> {formatCompactCount(track.commentCount)}
                </span>
                <span className="text-[10px]">{t("comments")}</span>
              </span>
            </div>

            {accessState.accessType === "vip" && accessState.unlockPrice > 0 ? (
              <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/80 p-3.5 dark:border-orange-900/40 dark:bg-orange-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-orange-700 dark:text-orange-300">
                      {isTrackLocked
                        ? t("vipLocked")
                        : t("vipUnlocked")}
                    </p>
                    <p className="text-xs font-medium text-orange-600/90 dark:text-orange-200/90">
                      {isTrackLocked
                        ? t("unlockPriceLabel", { credits: accessState.unlockPrice })
                        : t("unlockSourceLabel", { source: formatUnlockSource(accessState.unlockSource) })}
                    </p>
                  </div>

                  {isTrackLocked ? (
                    <button
                      onClick={() => {
                        if (!accessToken) {
                          setAccessNotice({
                            tone: "info",
                            text: t("loginToUnlockTrack"),
                          });
                          promptLogin();
                          return;
                        }

                        setShowUnlockConfirmModal(true);
                      }}
                      disabled={isUnlocking || isCheckingAccess}
                      className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600 disabled:opacity-60"
                    >
                      {isUnlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {accessToken
                        ? t("unlockCtaWithPrice", { credits: accessState.unlockPrice })
                        : t("loginToUnlockCta")}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <LockOpen className="h-3 w-3" />
                      {t("unlocked")}
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {accessNotice ? (
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                  accessNotice.tone === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : accessNotice.tone === "error"
                      ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
                      : "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/20 dark:text-zinc-300"
                }`}
              >
                {accessNotice.text}
              </div>
            ) : null}

            <div className="mt-auto pt-5">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={() => handlePlayTrack(track)}
                  disabled={isCheckingAccess || isUnlocking}
                  className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-pink-600 disabled:opacity-60"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isTrackLocked
                    ? (currentLang === "en" ? "Locked" : "Đang khóa")
                    : playing
                      ? t("pauseNow")
                      : t("playNow")}
                </button>

                <MusicLikeButton
                  musicId={track.id}
                  initialLiked={isLiked}
                  likeCount={track.likeCount}
                  showCount={false}
                  label={t("like")}
                  className="h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#242526] dark:text-zinc-200 dark:hover:bg-[#303133]"
                  onLikeChanged={(liked, newCount) => {
                    setIsLiked(liked);
                    setTrack((prev) => (prev ? { ...prev, likeCount: newCount } : prev));
                  }}
                />

                <ShareActionButton
                  title={track.title}
                  text={`${track.title} - ${track.artist}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#242526] dark:text-zinc-200 dark:hover:bg-[#303133]"
                  iconClassName="h-3.5 w-3.5"
                  label={t("share")}
                />

                {track.contentType !== "playlist" ? (
                  <AddToPlaylistButton
                    musicId={track.id}
                    musicTitle={track.title}
                    label={t("addToPlaylist")}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {track.contentType === "playlist" ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717]">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-[#2b2b2b]">
            <h2 className="text-sm font-black text-slate-500 dark:text-zinc-400">
              {t("playlistTracksTitle")}
            </h2>
          </div>
          <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-2">
            {track.playlistTracks.map((child, index) => {
              const queue = toPlaylistQueue(track);
              const target = queue[index];
              const isCurrent = target ? currentTrack?.id === target.id : false;
              const isChildPlaying = isCurrent && isPlaying;
              const fallbackChildAccessType = child.accessType === "vip" ? "vip" : "free";
              const fallbackChildUnlockPrice = Math.max(0, Math.floor(child.unlockPrice || 0));
              const childAccessState = playlistTrackAccess[child.id] || {
                accessType: fallbackChildAccessType,
                unlockPrice: fallbackChildUnlockPrice,
                unlocked: !(fallbackChildAccessType === "vip" && fallbackChildUnlockPrice > 0),
                unlockSource: fallbackChildAccessType === "vip" && fallbackChildUnlockPrice > 0 ? null : "free",
              };
              const isChildLocked = childAccessState.accessType === "vip"
                && childAccessState.unlockPrice > 0
                && !childAccessState.unlocked;
              const childOriginalUnlockPrice = typeof child.originalUnlockPrice === "number"
                ? Math.max(0, Math.floor(child.originalUnlockPrice))
                : 0;
              const childHasDiscount = childOriginalUnlockPrice > childAccessState.unlockPrice;
              const isChildUnlockedVip = childAccessState.accessType === "vip"
                && childAccessState.unlockPrice > 0
                && childAccessState.unlocked;

              return (
                <div key={`${track.id}-${child.id}-${index}`} className="relative rounded-lg border border-slate-100 p-3 transition hover:border-pink-300 dark:border-[#2f2f2f] dark:hover:border-pink-800/50">
                  {isChildLocked ? (
                    <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
                      <Lock className="h-3 w-3" />
                      <span className="flex flex-col leading-tight">
                        {childHasDiscount ? <span className="text-[9px] opacity-80 line-through">{childOriginalUnlockPrice} cr</span> : null}
                        <span>{childAccessState.unlockPrice} cr</span>
                      </span>
                    </span>
                  ) : isChildUnlockedVip ? (
                    <span className="pointer-events-none absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/95 text-white shadow-sm">
                      <LockOpen className="h-3.5 w-3.5" />
                    </span>
                  ) : null}

                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="mt-1 shrink-0 text-xs font-bold text-slate-400 dark:text-zinc-500">{index + 1}</span>
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-[#252525]">
                      <Image
                        src={child.thumbnailUrl || track.thumbnailUrl || "/thumbnaildefault.jpg"}
                        alt={child.title}
                        width={96}
                        height={96}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link href={`/music/${child.slug}`} className="block truncate text-sm font-bold text-slate-800 hover:text-pink-600 dark:text-zinc-100">
                        {child.title}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{child.artist}</p>
                      
                      <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" /> {formatMusicDuration(child.audioDuration)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Headphones className="h-3 w-3" /> {formatCompactCount(child.playCount)}
                        </span>
                        <button
                          className="inline-flex items-center gap-1 transition hover:text-pink-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Heart className="h-3 w-3" /> {formatCompactCount(child.likeCount)}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handlePlayPlaylistChild(track, index, childAccessState)}
                      className={`mt-1 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                        isChildLocked
                          ? "bg-slate-200 text-slate-500 dark:bg-[#2a2a2a] dark:text-zinc-500"
                          : "bg-pink-500 text-white hover:bg-pink-600"
                      }`}
                    >
                      {isChildLocked
                        ? <Lock className="h-3.5 w-3.5" />
                        : isChildPlaying
                          ? <Pause className="h-3.5 w-3.5" />
                          : <Play className="ml-0.5 h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Comments + Related */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Comments */}
        <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-[#2c2c2c] dark:bg-[#171717]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-500 dark:text-zinc-400">
              {t("commentsTitle")} <span className="text-pink-500">({commentsTotal})</span>
            </h2>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCommentSort("newest")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
                  commentSort === "newest"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300"
                    : "text-slate-500 hover:text-pink-600 dark:text-zinc-400"
                }`}
              >
                <ArrowDown className="h-3 w-3" /> {t("newest")}
              </button>
              <button
                onClick={() => setCommentSort("oldest")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
                  commentSort === "oldest"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300"
                    : "text-slate-500 hover:text-pink-600 dark:text-zinc-400"
                }`}
              >
                <ArrowUp className="h-3 w-3" /> {t("oldest")}
              </button>
            </div>
          </div>

          {/* Comment input */}
          {accessToken ? (
            <div className="flex gap-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-[#2b2b2b]">
                {user?.avatarUrl ? (
                  <Image src={user.avatarUrl} alt={user.name || ""} width={72} height={72} unoptimized className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-500">
                    {(user?.name || "U").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-1 gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t("commentPlaceholder")}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-pink-400 dark:border-[#333] dark:bg-[#191919] dark:text-zinc-200"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmitComment();
                    }
                  }}
                />
                <button
                  onClick={() => void handleSubmitComment()}
                  disabled={isSubmittingComment || !newComment.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-pink-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-pink-600 disabled:opacity-60"
                >
                  {isSubmittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ) : null}

          {/* Comment list */}
          <div className="space-y-3">
            {comments.length > 0 ? (
              comments.map((comment) => renderCommentItem(comment))
            ) : isLoadingComments ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">{t("loadingComments")}</p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-zinc-400">{t("emptyComments")}</p>
            )}
          </div>

          {commentsPage < commentsLastPage ? (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => void loadComments(commentsPage + 1, false)}
                disabled={isLoadingComments}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-pink-300 hover:text-pink-600 disabled:opacity-60 dark:border-[#3a3a3a] dark:text-zinc-300"
              >
                {isLoadingComments ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t("loadMoreComments")}
              </button>
            </div>
          ) : null}
        </article>

        {/* Related tracks */}
        <aside className="space-y-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-500 dark:text-zinc-400">
                  {t("relatedTitle")}
                </h3>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
                  {t("relatedSubtitle")}
                </p>
              </div>
              <Link href="/music" className="text-[11px] font-bold text-pink-500 hover:underline">
                {t("viewAll")}
              </Link>
            </div>

            <div className="space-y-2">
              {relatedTracks.length > 0 ? (
                relatedTracks.map((item) => {
                  const isRelActive = isMusicTrackActive(item, currentTrack);
                  const isRelPlaying = isRelActive && isPlaying;
                  const targetTracks = item.contentType === "playlist" ? toPlaylistQueue(item) : [toSingleQueueTrack(item)];
                  const targetId = item.contentType === "playlist" ? `playlist:${item.id}` : item.id;
                  const fallbackRelatedAccessType = item.accessType === "vip" ? "vip" : "free";
                  const fallbackRelatedUnlockPrice = Math.max(0, Math.floor(item.unlockPrice || 0));
                  const relatedAccessState = relatedTrackAccess[item.id] || {
                    accessType: fallbackRelatedAccessType,
                    unlockPrice: fallbackRelatedUnlockPrice,
                    unlocked: !(fallbackRelatedAccessType === "vip" && fallbackRelatedUnlockPrice > 0),
                    unlockSource: fallbackRelatedAccessType === "vip" && fallbackRelatedUnlockPrice > 0 ? null : "free",
                  };
                  const isRelatedLocked = relatedAccessState.accessType === "vip"
                    && relatedAccessState.unlockPrice > 0
                    && !relatedAccessState.unlocked;
                  const relatedOriginalUnlockPrice = typeof item.originalUnlockPrice === "number"
                    ? Math.max(0, Math.floor(item.originalUnlockPrice))
                    : 0;
                  const relatedHasDiscount = relatedOriginalUnlockPrice > relatedAccessState.unlockPrice;
                  const isRelatedUnlockedVip = relatedAccessState.accessType === "vip"
                    && relatedAccessState.unlockPrice > 0
                    && relatedAccessState.unlocked;

                  return (
                    <div key={item.id} className="group relative rounded-2xl border border-slate-200 p-2.5 transition hover:border-pink-300 dark:border-[#2f2f2f] dark:hover:border-pink-800/50">
                      {isRelatedLocked ? (
                        <span className="pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
                          <Lock className="h-3 w-3" />
                          <span className="flex flex-col leading-tight">
                            {relatedHasDiscount ? <span className="text-[9px] opacity-80 line-through">{relatedOriginalUnlockPrice} cr</span> : null}
                            <span>{relatedAccessState.unlockPrice} cr</span>
                          </span>
                        </span>
                      ) : isRelatedUnlockedVip ? (
                        <span className="pointer-events-none absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/95 text-white shadow-sm">
                          <LockOpen className="h-3.5 w-3.5" />
                        </span>
                      ) : null}

                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#242424]">
                          <Image
                            src={item.thumbnailUrl || "/thumbnaildefault.jpg"}
                            alt={item.title}
                            width={96}
                            height={96}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                          <button
                            onClick={() => handlePlayTrack(item)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
                          >
                            {isRelPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link href={`/music/${item.slug}`} className="block line-clamp-2 text-sm font-bold leading-snug text-slate-800 hover:text-pink-600 dark:text-zinc-100">
                            {item.title}
                          </Link>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-zinc-400">{item.artist}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-0.5"><Headphones className="h-3 w-3" /> {formatCompactCount(item.playCount)}</span>
                            <span className="inline-flex items-center gap-0.5"><Heart className="h-3 w-3" /> {formatCompactCount(item.likeCount)}</span>
                            <span className="inline-flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {formatCompactCount(item.commentCount)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:absolute sm:right-2.5 sm:top-1/2 sm:-translate-y-1/2 sm:opacity-0 sm:transition sm:duration-200 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <MusicLikeButton musicId={item.id} initialLiked={false} likeCount={item.likeCount} compact />
                          <PlayNextButton
                            targetId={targetId}
                            tracks={targetTracks}
                            resolveTracks={item.contentType === "playlist" ? () => resolvePlaylistQueue(item) : undefined}
                            compact
                          />
                          {item.contentType !== "playlist" ? (
                            <AddToPlaylistButton musicId={item.id} musicTitle={item.title} compact />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 dark:text-zinc-400">{t("noRelated")}</p>
              )}
            </div>
          </article>
        </aside>
      </section>

      {showUnlockConfirmModal && isTrackLocked ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("closeUnlockConfirmAria")}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (isUnlocking) return;
              setShowUnlockConfirmModal(false);
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#353535] dark:bg-[#1b1b1b]">
            <button
              type="button"
              onClick={() => {
                if (isUnlocking) return;
                setShowUnlockConfirmModal(false);
              }}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-[#2b2b2b]"
              disabled={isUnlocking}
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
                {t("confirmUnlockTitle")}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                {t("confirmUnlockBody", {
                  credits: accessState.unlockPrice,
                  title: track.title,
                })}
              </p>
              {track.contentType === "playlist" ? (
                <p className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-300">
                  {t("confirmUnlockPlaylistHint")}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnlockConfirmModal(false)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-[#414141] dark:text-zinc-200 dark:hover:bg-[#282828]"
                disabled={isUnlocking}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmUnlock()}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600 disabled:opacity-60"
                disabled={isUnlocking || isCheckingAccess}
              >
                {isUnlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                {t("confirmPayment")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPlaylistUnlockChoiceModal && playlistUnlockTarget && track.contentType === "playlist" ? (
        <div className="fixed inset-0 z-[121] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("closeUnlockOptionsAria")}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (isUnlocking) return;
              closePlaylistUnlockFlow();
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#353535] dark:bg-[#1b1b1b]">
            <button
              type="button"
              onClick={() => {
                if (isUnlocking) return;
                closePlaylistUnlockFlow();
              }}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-[#2b2b2b]"
              disabled={isUnlocking}
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
                {t("chooseUnlockOptionTitle")}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                {t("chooseUnlockOptionDescription", { title: playlistUnlockTarget.title })}
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => setSelectedPlaylistUnlockMode("track")}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition dark:border-[#414141] ${
                  selectedPlaylistUnlockMode === "track"
                    ? "border-orange-400 bg-orange-50 dark:border-orange-700/70 dark:bg-orange-950/20"
                    : "border-slate-300 hover:border-orange-300 hover:bg-orange-50 dark:hover:border-orange-700/50 dark:hover:bg-orange-950/20"
                }`}
                disabled={isUnlocking || isCheckingAccess}
              >
                <p className="text-sm font-black text-slate-900 dark:text-zinc-100">
                  {t("unlockThisTrackOptionTitle")}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                  {t("unlockThisTrackOptionBody", { credits: playlistUnlockTarget.unlockPrice })}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlaylistUnlockMode("playlist")}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition dark:border-[#414141] ${
                  selectedPlaylistUnlockMode === "playlist"
                    ? "border-pink-400 bg-pink-50 dark:border-pink-700/70 dark:bg-pink-950/20"
                    : "border-slate-300 hover:border-pink-300 hover:bg-pink-50 dark:hover:border-pink-700/50 dark:hover:bg-pink-950/20"
                }`}
                disabled={isUnlocking || isCheckingAccess || !(accessState.accessType === "vip" && accessState.unlockPrice > 0)}
              >
                <p className="text-sm font-black text-slate-900 dark:text-zinc-100">
                  {t("unlockWholePlaylistOptionTitle")}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                  {accessState.accessType === "vip" && accessState.unlockPrice > 0
                    ? t("unlockWholePlaylistOptionBody", { credits: accessState.unlockPrice })
                    : t("playlistUnlockUnavailable")}
                </p>
              </button>

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => closePlaylistUnlockFlow()}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-[#414141] dark:text-zinc-200 dark:hover:bg-[#282828]"
                  disabled={isUnlocking}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={moveToPlaylistUnlockPaymentConfirm}
                  className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600 disabled:opacity-60"
                  disabled={isUnlocking || isCheckingAccess || (selectedPlaylistUnlockMode === "playlist" && !(accessState.accessType === "vip" && accessState.unlockPrice > 0))}
                >
                  {t("continueToPayment")}
                </button>
              </div>
            </div>

            {isUnlocking ? (
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("processingUnlock")}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showPlaylistUnlockPaymentConfirmModal && playlistUnlockTarget && track.contentType === "playlist" ? (
        <div className="fixed inset-0 z-[122] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("closeUnlockConfirmAria")}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (isUnlocking) return;
              closePlaylistUnlockFlow();
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#353535] dark:bg-[#1b1b1b]">
            <button
              type="button"
              onClick={() => {
                if (isUnlocking) return;
                closePlaylistUnlockFlow();
              }}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-[#2b2b2b]"
              disabled={isUnlocking}
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
                {t("confirmPaymentTitle")}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                {selectedPlaylistUnlockMode === "playlist"
                  ? t("confirmPaymentPlaylistBody", {
                    credits: accessState.unlockPrice,
                    title: track.title,
                  })
                  : t("confirmPaymentTrackBody", {
                    credits: playlistUnlockTarget.unlockPrice,
                    title: playlistUnlockTarget.title,
                  })}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closePlaylistUnlockFlow()}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-[#414141] dark:text-zinc-200 dark:hover:bg-[#282828]"
                disabled={isUnlocking}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleUnlockPlaylistChild(selectedPlaylistUnlockMode)}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600 disabled:opacity-60"
                disabled={isUnlocking || isCheckingAccess}
              >
                {isUnlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                {t("confirmPayment")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showInsufficientCreditsModal ? (
        <div className="fixed inset-0 z-[123] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("close")}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (isUnlocking) return;
              setShowInsufficientCreditsModal(false);
            }}
          />

          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#353535] dark:bg-[#1b1b1b]">
            <button
              type="button"
              onClick={() => {
                if (isUnlocking) return;
                setShowInsufficientCreditsModal(false);
              }}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-[#2b2b2b]"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
                {t("insufficientCreditsTitle")}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                {t("insufficientCreditsBody", { credits: requiredCreditsForTopup })}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                {t("currentCreditsLine", { credits: currentUserCredits })}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
              {t("insufficientCreditsHint")}
            </div>

            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                {t("recommendedPackagesTitle")}
              </p>

              {isLoadingTopupPackages ? (
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("loadingRecommendedPackages")}
                </div>
              ) : recommendedTopupPackages.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {recommendedTopupPackages.map((pkg) => (
                    <div
                      key={pkg.code}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#3a3a3a] dark:bg-[#222]"
                    >
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">{getTopupPackageLabel(pkg)}</p>
                      <p className="mt-0.5 text-xs font-semibold text-pink-600 dark:text-pink-300">{pkg.credits} credits</p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">{getTopupPackagePrice(pkg)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                  {t("recommendedPackagesEmpty")}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInsufficientCreditsModal(false)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-[#414141] dark:text-zinc-200 dark:hover:bg-[#282828]"
              >
                {t("cancel")}
              </button>
              <Link
                href="/topup"
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600"
                onClick={() => setShowInsufficientCreditsModal(false)}
              >
                {t("goToTopup")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
