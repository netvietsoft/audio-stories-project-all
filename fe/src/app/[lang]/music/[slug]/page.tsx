"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { registerMusicPlayback, fetchMusicLikeStatus } from "@/lib/music/music-interactions";
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
import { useUserStore } from "@/stores/user-store";
import type { MusicApiItem, MusicTrack } from "@/types/music";

type MusicDetailResponse = {
  data: MusicApiItem;
};

type RelatedResponse = {
  data: MusicApiItem[];
};

export default function MusicDetailPage() {
  const params = useParams<{ lang?: string; slug?: string }>();
  const musicSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentLang = Array.isArray(params?.lang) ? params?.lang[0] : params?.lang;
  const t = useTranslations("MusicDetailPage");

  const user = useUserStore((state) => state.user);
  const accessToken = useUserStore((state) => state.accessToken);
  const isAdmin = user?.roles?.includes("admin") || false;

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);

  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedTracks, setRelatedTracks] = useState<MusicTrack[]>([]);
  const [isLiked, setIsLiked] = useState(false);

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
    if (!track?.id || !accessToken) return;
    let active = true;

    void fetchMusicLikeStatus(track.id)
      .then((liked) => {
        if (active) setIsLiked(liked);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [accessToken, track?.id]);

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
    const playlistQueue = item.contentType === "playlist" ? toPlaylistQueue(item) : [];
    const isCurrentMatch =
      item.contentType === "single"
        ? currentTrack?.id === item.id
        : playlistQueue.some((row) => row.id === currentTrack?.id);

    if (isCurrentMatch) {
      togglePlay(!isPlaying);
      return;
    }

    if (item.contentType === "playlist") {
      if (!playlistQueue.length) return;
      const firstTrack = playlistQueue[0];
      if (!firstTrack) return;
      playTrack(firstTrack, playlistQueue);
      return;
    }

    playTrack(toSingleQueueTrack(item), [toSingleQueueTrack(item)]);
  };

  const handlePlayPlaylistChild = (parent: MusicTrack, index: number) => {
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

  // ─── Render ───────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6 pb-40">
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-[#1e1e1e]" />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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

  const isActive = isMusicTrackActive(track, currentTrack);
  const playing = isActive && isPlaying;

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
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6 dark:border-[#2c2c2c] dark:bg-[#171717]">
        <div className="mx-auto grid max-w-3xl grid-cols-[122px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[138px_minmax(0,1fr)] md:max-w-5xl md:grid-cols-[200px_minmax(0,1fr)] md:items-stretch md:gap-6">
          <div className="w-[122px] shrink-0 sm:w-[138px] md:w-[200px] md:self-stretch">
            <div className="relative w-full overflow-hidden rounded-lg shadow-xl aspect-[2/3] md:h-full md:aspect-auto">
              <Image
                src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
                alt={track.title}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="space-y-2 text-sm md:max-w-xl">
              <h1 className="text-lg font-bold leading-tight text-slate-900 md:text-[1.7rem] dark:text-zinc-100">{track.title}</h1>

              <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2 md:gap-x-8">
                <p className="flex min-w-0 items-center gap-1 text-sm leading-tight text-slate-700 dark:text-zinc-300">
                  <span className="shrink-0 text-slate-500 dark:text-zinc-400">{t("author")}:</span>
                  <span className="truncate font-semibold text-slate-900 dark:text-zinc-100">{track.artist}</span>
                </p>

                <p className="flex min-w-0 items-center gap-1 text-sm leading-tight text-slate-700 dark:text-zinc-300">
                  <span className="shrink-0 text-slate-500 dark:text-zinc-400">{t("status")}:</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700 dark:bg-pink-950/30 dark:text-pink-300">
                    {track.contentType === "playlist" ? <ListMusic className="h-3 w-3" /> : null}
                    {track.contentType === "playlist" ? "Playlist" : "Single"}
                  </span>
                </p>

                <p className="flex min-w-0 items-center gap-1 text-sm leading-tight text-slate-700 dark:text-zinc-300">
                  <span className="shrink-0 text-slate-500 dark:text-zinc-400">{t("lastUpdated")}:</span>
                  <span className="font-medium text-slate-900 dark:text-zinc-100">
                    {track.updatedAt ? dateFormatter.format(new Date(track.updatedAt)) : "-"}
                  </span>
                </p>

                <p className="flex min-w-0 items-center gap-1 text-sm leading-tight text-slate-700 dark:text-zinc-300">
                  <span className="shrink-0 text-slate-500 dark:text-zinc-400">{t("duration")}:</span>
                  <span className="font-medium text-slate-900 dark:text-zinc-100">{formatMusicDuration(track.audioDuration)}</span>
                </p>
              </div>

              {track.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
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

              <div className="hidden md:block md:space-y-3">
                {track.description ? (
                  <p className="pt-1 text-sm leading-7 text-slate-600 dark:text-zinc-300">{track.description}</p>
                ) : null}

                <div className="flex items-center justify-start gap-6 border-y border-slate-100 py-2 text-xs text-slate-500 dark:border-[#2b2b2b] dark:text-zinc-400 sm:gap-8">
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

                <div className="mt-2 flex flex-wrap items-center justify-start gap-2 sm:gap-3">
                  <button
                    onClick={() => handlePlayTrack(track)}
                    className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-600"
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? t("pauseNow") : t("playNow")}
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

                  {track.contentType === "single" ? (
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
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {track.description ? (
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm leading-7 text-slate-600 dark:text-zinc-300">{track.description}</p>
            </div>
          ) : null}

          <div className="mx-auto flex max-w-3xl items-center justify-center gap-6 border-y border-slate-100 py-2 text-xs text-slate-500 dark:border-[#2b2b2b] dark:text-zinc-400 sm:gap-8">
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

          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              onClick={() => handlePlayTrack(track)}
              className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-600"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? t("pauseNow") : t("playNow")}
            </button>

            <MusicLikeButton
              musicId={track.id}
              initialLiked={isLiked}
              likeCount={track.likeCount}
              compact
              showCount={false}
              className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#242526] dark:text-zinc-200 dark:hover:bg-[#303133]"
              onLikeChanged={(liked, newCount) => {
                setIsLiked(liked);
                setTrack((prev) => (prev ? { ...prev, likeCount: newCount } : prev));
              }}
            />

            <ShareActionButton
              title={track.title}
              text={`${track.title} - ${track.artist}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#242526] dark:text-zinc-200 dark:hover:bg-[#303133]"
              iconClassName="h-3.5 w-3.5"
              ariaLabel={t("share")}
            />

            {track.contentType === "single" ? (
              <AddToPlaylistButton
                musicId={track.id}
                musicTitle={track.title}
                compact
              />
            ) : null}
          </div>
        </div>
      </section>

      {track.contentType === "playlist" ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717]">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-[#2b2b2b]">
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
              Danh sách bài hát
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#2b2b2b]">
            {track.playlistTracks.map((child, index) => {
              const queue = toPlaylistQueue(track);
              const target = queue[index];
              const isCurrent = target ? currentTrack?.id === target.id : false;
              const isChildPlaying = isCurrent && isPlaying;

              return (
                <div key={`${track.id}-${child.id}-${index}`} className="grid grid-cols-[48px_auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-4 py-3 sm:px-6 sm:gap-3">
                  <span className="text-center text-xs font-bold text-slate-400 dark:text-zinc-500">{index + 1}</span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-[#252525]">
                    <Image
                      src={child.thumbnailUrl || track.thumbnailUrl || "/thumbnaildefault.jpg"}
                      alt={child.title}
                      width={80}
                      height={80}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <Link href={`/music/${child.slug}`} className="block truncate text-sm font-bold text-slate-800 hover:text-pink-600 dark:text-zinc-100">
                      {child.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{child.artist}</p>
                  </div>

                  <p className="text-right text-xs font-semibold text-slate-500 dark:text-zinc-400">{formatMusicDuration(child.audioDuration)}</p>

                  <button
                    onClick={() => handlePlayPlaylistChild(track, index)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white transition hover:bg-pink-600"
                  >
                    {isChildPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Comments + Related */}
      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Comments */}
        <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-[#2c2c2c] dark:bg-[#171717]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
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
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
                {t("relatedTitle")}
              </h3>
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

                  return (
                    <div key={item.id} className="group rounded-2xl border border-slate-200 p-2.5 transition hover:border-pink-300 dark:border-[#2f2f2f] dark:hover:border-pink-800/50">
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
                          <Link href={`/music/${item.slug}`} className="block truncate text-sm font-bold text-slate-800 hover:text-pink-600 dark:text-zinc-100">
                            {item.title}
                          </Link>
                          <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{item.artist}</p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-0.5"><Headphones className="h-3 w-3" /> {formatCompactCount(item.playCount)}</span>
                            <span className="inline-flex items-center gap-0.5"><Heart className="h-3 w-3" /> {formatCompactCount(item.likeCount)}</span>
                            <span className="inline-flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {formatCompactCount(item.commentCount)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                          <MusicLikeButton musicId={item.id} initialLiked={false} likeCount={item.likeCount} compact />
                          <PlayNextButton targetId={item.id} tracks={targetTracks} compact />
                          {item.contentType === "single" ? (
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
    </div>
  );
}
