"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  Clock3,
  Headphones,
  Heart,
  Loader2,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";

import AddToPlaylistModal from "@/components/music/AddToPlaylistModal";
import Link from "@/components/shared/LocalizedLink";
import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

type MusicApiItem = Omit<MusicTrack, "tags"> & {
  tags: unknown;
};

type MusicDetailResponse = {
  data: MusicApiItem;
};

type MusicListResponse = {
  data: MusicApiItem[];
};

type LikeStatusResponse = {
  data: {
    liked: boolean;
  };
};

type LikeActionResponse = {
  data: {
    liked: boolean;
    likeCount: number;
  };
};

type MusicComment = {
  id: string;
  musicId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type CommentsResponse = {
  data: MusicComment[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
};

type CommentMutationResponse = {
  data: MusicComment;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const formatCount = (value?: number) => {
  if (!value || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const normalizeTrack = (item: MusicApiItem): MusicTrack => ({
  ...item,
  tags: normalizeTags(item.tags),
  playCount: item.playCount || 0,
  likeCount: item.likeCount || 0,
  commentCount: item.commentCount || 0,
});

export default function MusicDetailPage() {
  const params = useParams<{ lang?: string; id?: string }>();
  const musicId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const t = useTranslations("MusicDetailPage");
  const locale = useLocale();

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);

  const accessToken = useUserStore((state) => state.accessToken);
  const user = useUserStore((state) => state.user);
  const isAdmin = useMemo(
    () => (Array.isArray(user?.roles) ? user?.roles.some((role) => role.toUpperCase() === "ADMIN") : false),
    [user?.roles],
  );

  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [relatedTracks, setRelatedTracks] = useState<MusicTrack[]>([]);
  const [isLoadingTrack, setIsLoadingTrack] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  const [comments, setComments] = useState<MusicComment[]>([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsLastPage, setCommentsLastPage] = useState(1);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);
  const [playlistTargetTrack, setPlaylistTargetTrack] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const lastPlayPingRef = useRef<Map<string, number>>(new Map());

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const queueForStore = useMemo(() => {
    if (!track) return [];

    const map = new Map<string, MusicTrack>();
    map.set(track.id, track);
    relatedTracks.forEach((item) => map.set(item.id, item));

    return Array.from(map.values()).map((item) => ({
      id: item.id,
      title: item.title,
      author: item.artist,
      audioUrl: item.audioUrl,
      coverUrl: item.thumbnailUrl || "/thumbnaildefault.jpg",
    }));
  }, [relatedTracks, track]);

  const loadComments = useCallback(
    async (page: number, append: boolean) => {
      if (!musicId) return;

      setIsLoadingComments(true);

      try {
        const response = await apiClient.get<CommentsResponse>(`/music/${musicId}/comments`, {
          params: {
            page,
            limit: 8,
          },
        });

        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        const nextPage = response.data?.meta?.page || page;
        const nextLastPage = Math.max(1, response.data?.meta?.lastPage || 1);

        setComments((prev) => (append ? [...prev, ...rows] : rows));
        setCommentsPage(nextPage);
        setCommentsLastPage(nextLastPage);
      } catch {
        if (!append) {
          setComments([]);
          setCommentsPage(1);
          setCommentsLastPage(1);
        }
      } finally {
        setIsLoadingComments(false);
      }
    },
    [musicId],
  );

  useEffect(() => {
    if (!musicId) {
      setTrack(null);
      setRelatedTracks([]);
      setIsLoadingTrack(false);
      setLoadError(t("loadFailed"));
      return;
    }

    let cancelled = false;

    const loadTrack = async () => {
      setIsLoadingTrack(true);
      setLoadError(null);

      try {
        const detailResponse = await apiClient.get<MusicDetailResponse>(`/music/${musicId}`);
        const rawTrack = detailResponse.data?.data;

        if (!rawTrack) {
          throw new Error("No data");
        }

        const mainTrack = normalizeTrack(rawTrack);
        if (cancelled) return;

        setTrack(mainTrack);

        const relatedParams = mainTrack.tags.length
          ? { page: 1, limit: 10, tag: mainTrack.tags[0] }
          : { page: 1, limit: 10, search: mainTrack.artist };

        try {
          const relatedResponse = await apiClient.get<MusicListResponse>("/music", {
            params: relatedParams,
          });

          if (!cancelled) {
            const rows = Array.isArray(relatedResponse.data?.data) ? relatedResponse.data.data : [];
            setRelatedTracks(
              rows
                .map((item) => normalizeTrack(item))
                .filter((item) => item.id !== mainTrack.id)
                .slice(0, 8),
            );
          }
        } catch {
          if (!cancelled) {
            setRelatedTracks([]);
          }
        }
      } catch {
        if (!cancelled) {
          setTrack(null);
          setRelatedTracks([]);
          setLoadError(t("loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTrack(false);
        }
      }
    };

    void loadTrack();
    void loadComments(1, false);

    return () => {
      cancelled = true;
    };
  }, [loadComments, musicId, t]);

  useEffect(() => {
    if (!musicId || !accessToken) {
      setIsLiked(false);
      return;
    }

    let cancelled = false;

    const loadLikeStatus = async () => {
      try {
        const response = await apiClient.get<LikeStatusResponse>(`/music/interactions/${musicId}/liked`);
        if (!cancelled) {
          setIsLiked(Boolean(response.data?.data?.liked));
        }
      } catch {
        if (!cancelled) {
          setIsLiked(false);
        }
      }
    };

    void loadLikeStatus();

    return () => {
      cancelled = true;
    };
  }, [accessToken, musicId]);

  const registerPlayback = async (targetMusicId: string) => {
    const now = Date.now();
    const lastPing = lastPlayPingRef.current.get(targetMusicId) || 0;

    if (now - lastPing < 45_000) {
      return;
    }

    lastPlayPingRef.current.set(targetMusicId, now);

    setTrack((prev) =>
      prev && prev.id === targetMusicId
        ? {
            ...prev,
            playCount: prev.playCount + 1,
          }
        : prev,
    );

    setRelatedTracks((prev) =>
      prev.map((item) =>
        item.id === targetMusicId
          ? {
              ...item,
              playCount: item.playCount + 1,
            }
          : item,
      ),
    );

    try {
      await apiClient.post(`/music/${targetMusicId}/play`);
      if (accessToken) {
        await apiClient.post(`/music/interactions/${targetMusicId}/history`);
      }
    } catch {
      // Keep playback responsive even if tracking fails.
    }
  };

  const handlePlayTrack = (target: MusicTrack) => {
    if (currentTrack?.id === target.id) {
      togglePlay(!isPlaying);
      return;
    }

    playTrack(
      {
        id: target.id,
        title: target.title,
        author: target.artist,
        audioUrl: target.audioUrl,
        coverUrl: target.thumbnailUrl || "/thumbnaildefault.jpg",
      },
      queueForStore,
    );

    void registerPlayback(target.id);
  };

  const handleToggleLike = async () => {
    if (!track) return;

    if (!accessToken) {
      window.alert(t("loginToLike"));
      return;
    }

    setIsLikeLoading(true);

    try {
      if (isLiked) {
        const response = await apiClient.delete<LikeActionResponse>(`/music/interactions/${track.id}/like`);
        const likeCount = response.data?.data?.likeCount;

        setIsLiked(false);
        setTrack((prev) =>
          prev
            ? {
                ...prev,
                likeCount: typeof likeCount === "number" ? likeCount : Math.max(0, prev.likeCount - 1),
              }
            : prev,
        );
      } else {
        const response = await apiClient.post<LikeActionResponse>(`/music/interactions/${track.id}/like`);
        const likeCount = response.data?.data?.likeCount;

        setIsLiked(true);
        setTrack((prev) =>
          prev
            ? {
                ...prev,
                likeCount: typeof likeCount === "number" ? likeCount : prev.likeCount + 1,
              }
            : prev,
        );
      }
    } catch {
      // Ignore to keep page stable.
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleCreateComment = async () => {
    if (!track) return;

    if (!accessToken) {
      window.alert(t("loginToUseComment"));
      return;
    }

    const content = newComment.trim();
    if (!content) return;

    setIsSubmittingComment(true);

    try {
      const response = await apiClient.post<CommentMutationResponse>(`/music/${track.id}/comments`, {
        content,
      });

      const created = response.data?.data;
      if (created) {
        setComments((prev) => [created, ...prev]);
        setNewComment("");
        setTrack((prev) =>
          prev
            ? {
                ...prev,
                commentCount: prev.commentCount + 1,
              }
            : prev,
        );
      }
    } catch {
      // Ignore to keep page stable.
    } finally {
      setIsSubmittingComment(false);
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
    const content = editingCommentContent.trim();
    if (!content) return;

    setPendingCommentId(commentId);

    try {
      const response = await apiClient.patch<CommentMutationResponse>(`/music/comments/${commentId}`, {
        content,
      });

      const updated = response.data?.data;
      if (updated) {
        setComments((prev) => prev.map((item) => (item.id === commentId ? updated : item)));
      }

      setEditingCommentId(null);
      setEditingCommentContent("");
    } catch {
      // Ignore to keep page stable.
    } finally {
      setPendingCommentId(null);
    }
  };

  const deleteComment = async (comment: MusicComment) => {
    const confirmed = window.confirm(t("deleteConfirm"));
    if (!confirmed) return;

    setPendingCommentId(comment.id);

    try {
      await apiClient.delete(`/music/comments/${comment.id}`);
      setComments((prev) => prev.filter((item) => item.id !== comment.id));
      setTrack((prev) =>
        prev
          ? {
              ...prev,
              commentCount: Math.max(0, prev.commentCount - 1),
            }
          : prev,
      );
    } catch {
      // Ignore to keep page stable.
    } finally {
      setPendingCommentId(null);
    }
  };

  const loadMoreComments = () => {
    if (isLoadingComments || commentsPage >= commentsLastPage) return;
    void loadComments(commentsPage + 1, true);
  };

  const isCurrentTrackPlaying = Boolean(track && currentTrack?.id === track.id && isPlaying);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 pb-40">
      <Link
        href="/music"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-orange-300 hover:text-orange-600 dark:border-[#2c2c2c] dark:bg-[#171717] dark:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToList")}
      </Link>

      {isLoadingTrack ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717]">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
          </div>
        </section>
      ) : loadError || !track ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {loadError || t("loadFailed")}
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717]">
            <div className="grid gap-0 lg:grid-cols-[340px_1fr]">
              <div className="relative min-h-[280px] bg-slate-100 dark:bg-[#232323]">
                <Image
                  src={track.thumbnailUrl || "/thumbnaildefault.jpg"}
                  alt={track.title}
                  width={760}
                  height={760}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex flex-col justify-between p-6 sm:p-8">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">{t("detailLabel")}</p>
                  <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 dark:text-zinc-100 sm:text-4xl">
                    {track.title}
                  </h1>
                  <p className="mt-2 text-base font-semibold text-slate-500 dark:text-zinc-400">{track.artist}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {track.tags.length ? (
                      track.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/music?tag=${encodeURIComponent(tag)}`}
                          className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-200 dark:bg-orange-950/30 dark:text-orange-300"
                        >
                          #{tag}
                        </Link>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500 dark:text-zinc-400">{t("noTags")}</span>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => handlePlayTrack(track)}
                      className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600"
                    >
                      {isCurrentTrackPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isCurrentTrackPlaying ? t("pauseNow") : t("playNow")}
                    </button>

                    <button
                      onClick={() =>
                        setPlaylistTargetTrack({
                          id: track.id,
                          title: track.title,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-pink-300 bg-pink-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-pink-700 transition hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300"
                    >
                      <Plus className="h-4 w-4" /> {t("addToPlaylist")}
                    </button>

                    <button
                      onClick={handleToggleLike}
                      disabled={isLikeLoading}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                        isLiked
                          ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300"
                          : "border-slate-300 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-zinc-300"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                      {isLiked ? t("unlike") : t("like")}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-slate-100 p-3 text-sm font-semibold text-slate-700 dark:bg-[#222] dark:text-zinc-200">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">{t("duration")}</p>
                      <p className="mt-1">{formatDuration(track.audioDuration)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-3 text-sm font-semibold text-slate-700 dark:bg-[#222] dark:text-zinc-200">
                      <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                        <Headphones className="h-3.5 w-3.5" /> {t("plays")}
                      </p>
                      <p className="mt-1">{formatCount(track.playCount)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-3 text-sm font-semibold text-slate-700 dark:bg-[#222] dark:text-zinc-200">
                      <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                        <Heart className="h-3.5 w-3.5" /> {t("like")}
                      </p>
                      <p className="mt-1">{formatCount(track.likeCount)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-3 text-sm font-semibold text-slate-700 dark:bg-[#222] dark:text-zinc-200">
                      <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                        <MessageCircle className="h-3.5 w-3.5" /> {t("comments")}
                      </p>
                      <p className="mt-1">{formatCount(track.commentCount)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,65%)_minmax(300px,35%)]">
            <div className="space-y-6">
              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717] sm:p-6">
                <h2 className="mb-3 text-lg font-black text-slate-900 dark:text-zinc-100">{t("description")}</h2>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-zinc-300">
                  {track.description?.trim() || t("noDescription")}
                </p>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717] sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-black text-slate-900 dark:text-zinc-100">{t("commentsTitle")}</h2>
                  {!accessToken ? <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("loginToComment")}</p> : null}
                </div>

                <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-[#2f2f2f] dark:bg-[#131313]">
                  <textarea
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    placeholder={t("commentPlaceholder")}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 dark:border-[#333] dark:bg-[#191919] dark:text-zinc-200"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={handleCreateComment}
                      disabled={isSubmittingComment}
                      className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600 disabled:opacity-60"
                    >
                      {isSubmittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {t("sendComment")}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {comments.length ? (
                    comments.map((comment) => {
                      const canManage = Boolean(isAdmin || (user?.id && user.id === comment.userId));
                      const isEditing = editingCommentId === comment.id;

                      return (
                        <div key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#2f2f2f] dark:bg-[#141414]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-[#2b2b2b]">
                                {comment.user.avatarUrl ? (
                                  <Image
                                    src={comment.user.avatarUrl}
                                    alt={comment.user.displayName}
                                    width={80}
                                    height={80}
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
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                                  {dateFormatter.format(new Date(comment.createdAt))}
                                </p>
                              </div>
                            </div>

                            {canManage ? (
                              <div className="flex items-center gap-1.5">
                                {!isEditing ? (
                                  <button
                                    onClick={() => startEditComment(comment)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#242424]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}

                                <button
                                  onClick={() => void deleteComment(comment)}
                                  disabled={pendingCommentId === comment.id}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-50 disabled:opacity-60 dark:hover:bg-rose-950/30"
                                >
                                  {pendingCommentId === comment.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : null}
                          </div>

                          {isEditing ? (
                            <div className="mt-3">
                              <textarea
                                value={editingCommentContent}
                                onChange={(event) => setEditingCommentContent(event.target.value)}
                                rows={3}
                                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-orange-400 dark:border-[#333] dark:bg-[#191919] dark:text-zinc-200"
                              />
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                  onClick={cancelEditComment}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-[#3a3a3a] dark:text-zinc-300"
                                >
                                  <X className="h-3.5 w-3.5" /> {t("cancel")}
                                </button>
                                <button
                                  onClick={() => void saveEditedComment(comment.id)}
                                  disabled={pendingCommentId === comment.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-600 disabled:opacity-60"
                                >
                                  {pendingCommentId === comment.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  {t("save")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-zinc-300">{comment.content}</p>
                          )}
                        </div>
                      );
                    })
                  ) : isLoadingComments ? (
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{t("loadingComments")}</p>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{t("emptyComments")}</p>
                  )}
                </div>

                {commentsPage < commentsLastPage ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={loadMoreComments}
                      disabled={isLoadingComments}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-60 dark:border-[#3a3a3a] dark:text-zinc-300"
                    >
                      {isLoadingComments ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {t("loadMoreComments")}
                    </button>
                  </div>
                ) : null}
              </article>
            </div>

            <aside className="space-y-4">
              <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2c2c2c] dark:bg-[#171717]">
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
                  {t("relatedTitle")}
                </h3>

                <div className="space-y-2">
                  {relatedTracks.length ? (
                    relatedTracks.map((item) => {
                      const isActive = currentTrack?.id === item.id;

                      return (
                        <div key={item.id} className="rounded-2xl border border-slate-200 p-2.5 dark:border-[#2f2f2f]">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#242424]">
                              <Image
                                src={item.thumbnailUrl || "/thumbnaildefault.jpg"}
                                alt={item.title}
                                width={96}
                                height={96}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link href={`/music/${item.id}`} className="block truncate text-sm font-bold text-slate-800 hover:text-orange-600 dark:text-zinc-100">
                                {item.title}
                              </Link>
                              <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{item.artist}</p>
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                                <Clock3 className="h-3 w-3" /> {formatDuration(item.audioDuration)}
                              </p>
                            </div>
                            <button
                              onClick={() => handlePlayTrack(item)}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                                isActive && isPlaying
                                  ? "bg-orange-500 text-white"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#252525] dark:text-zinc-200"
                              }`}
                            >
                              {isActive && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() =>
                                setPlaylistTargetTrack({
                                  id: item.id,
                                  title: item.title,
                                })
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-pink-300 bg-pink-50 text-pink-700 transition hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-950/20 dark:text-pink-300"
                              aria-label={t("addToPlaylist")}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
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
        </>
      )}

      <AddToPlaylistModal
        isOpen={Boolean(playlistTargetTrack)}
        musicId={playlistTargetTrack?.id || null}
        musicTitle={playlistTargetTrack?.title}
        onClose={() => setPlaylistTargetTrack(null)}
      />
    </div>
  );
}
