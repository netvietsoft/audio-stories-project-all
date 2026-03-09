"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
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
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import FavoriteButton from "@/components/shared/FavoriteButton";
import StoryReader from "@/components/story/StoryReader";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";

type ChapterItem = {
  id: string;
  title: string;
  chapterNumber: number;
  content: string | null;
  r2AudioUrl: string | null;
  youtubeVideoId?: string | null;
  audioDuration: number | null;
  accessType: "free" | "timed" | "vip";
  unlocksAt: string | null;
};

type StoryListItem = {
  id: string;
  slug: string;
  title: string;
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
  slug: string;
  description: string | null;
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
};

type HomeResponse = {
  trending: StoryListItem[];
  newest: StoryListItem[];
  featured: StoryListItem[];
};

type ExploreResponse = {
  data: StoryListItem[];
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const totalSeconds = Math.floor(seconds);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Đang cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Đang cập nhật";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatStatus = (status?: "ongoing" | "completed") => {
  if (status === "completed") return "Hoàn thành";
  if (status === "ongoing") return "Đang ra";
  return "Đang cập nhậts";
};

const getUnlockLabel = (chapter: ChapterItem) => {
  if (chapter.accessType === "free") return null;
  if (chapter.accessType === "vip") return "Dành cho tài khoản VIP";
  if (!chapter.unlocksAt) return "Mở miễn phí sau";

  const msLeft = new Date(chapter.unlocksAt).getTime() - Date.now();
  if (msLeft <= 0) return "Đã mở miễn phí";

  const day = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hour = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  const minute = Math.floor((msLeft / (1000 * 60)) % 60);

  if (day > 0) return `Mở miễn phí sau: ${day}d ${hour}h`;
  if (hour > 0) return `Mở miễn phí sau: ${hour}h ${minute}m`;
  return `Mở miễn phí sau: ${minute}m`;
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

export default function StoryChapterPage() {
  const params = useParams<{ slug: string; chapterSlug: string }>();
  const router = useRouter();
  const slug = params?.slug;
  const chapterSlug = params?.chapterSlug;
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [relatedStories, setRelatedStories] = useState<StoryListItem[]>([]);
  const [trendingStories, setTrendingStories] = useState<StoryListItem[]>([]);
  const [popularStories, setPopularStories] = useState<StoryListItem[]>([]);
  const [newestStories, setNewestStories] = useState<StoryListItem[]>([]);
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

  useEffect(() => {
    if (!slug) return;

    const fetchDetail = async () => {
      try {
        const [detailResult, homeResult, popularResult] = await Promise.allSettled([
          apiClient.get<StoryDetail>(`/stories/${slug}`),
          apiClient.get<HomeResponse>("/stories/home"),
          apiClient.get<ExploreResponse>("/stories/explore", {
            params: {
              page: 1,
              limit: 5,
              sort: "views",
            },
          }),
        ]);

        if (detailResult.status !== "fulfilled") {
          throw detailResult.reason;
        }

        const detailRes = detailResult.value;
        const homeData = homeResult.status === "fulfilled" ? homeResult.value.data : null;
        const popularData = popularResult.status === "fulfilled" ? popularResult.value.data : null;

        const detail = detailRes.data;
        setStory(detail);

        const fromSlug = chapterNumberFromSlug(chapterSlug);
        const pickedBySlug = fromSlug
          ? detail.chapters.find((chapter) => chapter.chapterNumber === fromSlug)
          : null;
        const fallbackChapter = detail.chapters[0] || null;
        const selected = pickedBySlug || fallbackChapter;

        if (selected) {
          setSelectedChapterId(selected.id);
          if (!pickedBySlug && fallbackChapter) {
            router.replace(chapterHref(detail.slug, fallbackChapter.chapterNumber));
          }
        }

        setTrendingStories(homeData?.trending?.slice(0, 5) || []);
        setNewestStories(homeData?.newest?.slice(0, 5) || []);
        setPopularStories(popularData?.data || []);

        const firstCategoryId = detail.categories?.[0]?.category?.id;

        if (firstCategoryId) {
          try {
            const relatedRes = await apiClient.get<ExploreResponse>("/stories/explore", {
              params: {
                page: 1,
                limit: 10,
                categoryId: firstCategoryId,
                sort: "views",
              },
            });

            const filtered = (relatedRes.data.data || []).filter((item) => item.slug !== detail.slug).slice(0, 3);
            setRelatedStories(filtered);
          } catch {
            setRelatedStories((homeData?.featured || []).filter((item) => item.slug !== detail.slug).slice(0, 3));
          }
        } else {
          setRelatedStories((homeData?.featured || []).filter((item) => item.slug !== detail.slug).slice(0, 3));
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu chi tiết truyện:", error);
        setStory(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [chapterSlug, router, slug]);

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

  const chapterCount = useMemo(() => story?.chapters?.length ?? 0, [story?.chapters]);

  const activeChapterIndex = useMemo(() => {
    if (!story || !selectedChapterId) return -1;
    return story.chapters.findIndex((chapter) => chapter.id === selectedChapterId);
  }, [selectedChapterId, story]);

  const selectedChapter = useMemo(() => {
    if (!story) return null;
    return story.chapters.find((chapter) => chapter.id === selectedChapterId) || story.chapters[0] || null;
  }, [selectedChapterId, story]);

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
    if (!selectedChapter) return "Chương nay đang bị khóa.";
    if (selectedChapter.accessType === "vip") {
      return "Chương này dành cho tài khoản VIP.";
    }
    if (selectedChapter.accessType === "timed") {
      return getUnlockLabel(selectedChapter) || "Chương nay sẽ mở trong thời gian tới.";
    }
    return "Chương nay đang bị khóa.";
  }, [selectedChapter]);

  const filteredChapters = useMemo(() => {
    if (!story) return [];
    if (!chapterQuery.trim()) return story.chapters;
    const q = chapterQuery.toLowerCase();
    return story.chapters.filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(q) ||
        String(chapter.chapterNumber).includes(q) ||
        `chương ${chapter.chapterNumber}`.includes(q),
    );
  }, [chapterQuery, story]);

  const hasPlayableAudio = Boolean(selectedChapter?.r2AudioUrl);

  useEffect(() => {
    if (!currentTrack?.id || !story) return;
    const existsInStory = story.chapters.some((chapter) => chapter.id === currentTrack.id);
    if (existsInStory) {
      setSelectedChapterId(currentTrack.id);
    }
  }, [currentTrack?.id, story]);

  const playChapter = useCallback(
    async (chapter: ChapterItem, selectedStory: StoryDetail, autoPlay = true) => {
      setSelectedChapterId(chapter.id);

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

      const mappedQueue = selectedStory.chapters.map((item) => ({
        id: item.id,
        storyId: selectedStory.id,
        chapterId: item.id,
        title: `Chương ${item.chapterNumber}: ${item.title}`,
        storySlug: selectedStory.slug,
        chapterNumber: item.chapterNumber,
        author: selectedStory.author?.name,
        audioUrl: item.r2AudioUrl || "",
        coverUrl: selectedStory.thumbnailUrl || undefined,
      }));

      const track = {
        id: chapter.id,
        storyId: selectedStory.id,
        chapterId: chapter.id,
        title: `Chương ${chapter.chapterNumber}: ${chapter.title}`,
        storySlug: selectedStory.slug,
        chapterNumber: chapter.chapterNumber,
        author: selectedStory.author?.name,
        audioUrl: chapter.r2AudioUrl || "",
        coverUrl: selectedStory.thumbnailUrl || undefined,
      };

      if (!chapter.r2AudioUrl) {
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
    [isVipActive, playTrack, setQueue, setTrack, togglePlay],
  );

  const goToChapter = useCallback(
    (chapter: ChapterItem, autoPlay = false) => {
      if (!story) return;
      setIsChapterMenuOpen(false);
      router.push(chapterHref(story.slug, chapter.chapterNumber));
      void playChapter(chapter, story, autoPlay);
    },
    [playChapter, router, story],
  );

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
  }, [activeChapterIndex, goToChapter, isShuffle, playByIndex, repeatMode, selectedChapter, story]);

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
    seekTo(currentTime + seconds);
  };

  const onShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: story?.title || "AudioTruyen",
          text: "Nghe truyen nay cung minh nhe",
          url,
        });
        return;
      } catch {
        // ignore canceled share
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Da sao chep lien ket truyen");
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
      router.push("/login");
      return;
    }

    if ((user.credits ?? 0) < VIP_UNLOCK_COST) {
      setUnlockError("Credits khong du de mo VIP. Vui long nap them credits.");
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
  };

  const rankingBlock = (title: string, list: StoryListItem[]) => (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="space-y-3">
        {list.slice(0, 5).map((item, index) => (
          <Link key={item.id} href={`/story/${item.slug}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-gray-50 dark:hover:bg-gray-800">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
              <img
                src={item.thumbnailUrl || "https://placehold.co/120x180?text=No+Cover"}
                alt={item.title}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 text-[10px] font-semibold text-white">#{index + 1}</span>
            </div>
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{Number(item.totalViews || 0).toLocaleString("vi-VN")} luot xem</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );

  const suggestionBlock = (title: string, list: StoryListItem[]) => (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="space-y-3">
        {list.slice(0, 5).map((item) => (
          <Link key={item.id} href={`/story/${item.slug}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-gray-50 dark:hover:bg-gray-800">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
              <img
                src={item.thumbnailUrl || "https://placehold.co/120x180?text=No+Cover"}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{Number(item.totalViews || 0).toLocaleString("vi-VN")} luot xem</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Truyện đang tải, bạn đợi xíu nhé!</p>;
  }

  if (!story || !selectedChapter) {
    return <p className="text-sm text-red-600">Không tìm thấy truyện hoặc chương.</p>;
  }

  return (
    <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 px-4 sm:px-6 lg:px-10 2xl:px-14">
      <div className="mx-auto w-full max-w-[1720px] space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_520px] 2xl:grid-cols-[minmax(0,1fr)_560px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{story.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>Tác giả: <b>{story.author?.name || "Đang cập nhật"}</b></span>
              <span>{formatStatus(story.status)}</span>
              <span>Cập nhật: {formatDate(story.updatedAt)}</span>
              <span>{Number(story.totalViews || 0).toLocaleString("vi-VN")} lượt nghe</span>
              <span>{Number(story.averageRating || 0).toFixed(1)} ({story.ratingCount || 0})</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-2 py-1.5 dark:border-gray-700">
                <FavoriteButton storyId={story.id} size="sm" className="bg-transparent text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" />
                <span className="pr-2 text-sm font-medium text-gray-700 dark:text-gray-200">Thêm vào mục yêu thích</span>
              </div>

              <button
                onClick={onShare}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Share2 className="h-4 w-4" />
                Chia sẻ
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Đọc truyện chữ</h2>
            <div className="mt-5">
              <StoryReader
                chapterId={selectedChapter.id}
                content={selectedChapter.content}
                adInterval={700}
                isLocked={chapterIsLocked}
                previewChars={500}
                lockLabel={lockReasonLabel}
                onUnlockRequest={openUnlockModal}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
              <span className="inline-flex items-center gap-2"><ListMusic className="h-4 w-4" /> Chương đang phát
              </span>
              <span className="text-xs text-gray-500">{chapterCount} Chương</span>
            </h2>

            <button
              onClick={() => setIsChapterMenuOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedChapter.title}</p>
                <p className="text-xs text-gray-500">{formatDuration(selectedChapter.audioDuration)}</p>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${isChapterMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {selectedChapter.accessType !== "free" ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300">
                <Lock className="h-3 w-3" /> {getUnlockLabel(selectedChapter)}
              </p>
            ) : null}

            {isChapterMenuOpen ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/70">
                <input
                  value={chapterQuery}
                  onChange={(event) => setChapterQuery(event.target.value)}
                  placeholder="Tim so chuong hoac ten chuong..."
                  className="mb-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                />
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {filteredChapters.map((chapter) => {
                    const isCurrent = chapter.id === selectedChapter.id;
                    return (
                      <button
                        key={chapter.id}
                        onClick={() => goToChapter(chapter, true)}
                        className={`w-full rounded-md px-2 py-2 text-left text-xs transition ${
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span className="line-clamp-1">{chapter.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Audio Player</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className={`relative h-28 w-28 overflow-hidden rounded-full border-4 border-blue-200 dark:border-blue-900 ${isPlaying ? "animate-spin [animation-duration:10s]" : ""}`}>
                  <img
                    src={story.thumbnailUrl || "https://placehold.co/300x300?text=No+Cover"}
                    alt={story.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="line-clamp-2 text-center text-xs text-gray-500 dark:text-gray-400">
                  Chương {selectedChapter.chapterNumber}
                </p>
              </div>

              <div className="space-y-3">
                <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Chương {selectedChapter.chapterNumber}: {selectedChapter.title}
                </p>
                
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  className="w-full accent-blue-600"
                />

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={playPrev} className="rounded-full border border-gray-300 p-2 text-gray-600">
                    <SkipBack className="h-4 w-4" />
                  </button>

                  <button onClick={() => seekBy(-10)} className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600">
                    -10s
                  </button>

                  <button
                    onClick={() => {
                      if (chapterIsLocked) {
                        openUnlockModal();
                        return;
                      }
                      if (!hasPlayableAudio) return;
                      if (currentTrack?.id !== selectedChapter.id && story) {
                        void playChapter(selectedChapter, story);
                        return;
                      }
                      togglePlay(!isPlaying);
                    }}
                    disabled={!hasPlayableAudio}
                    className="rounded-full bg-blue-600 p-3 text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>

                  <button onClick={() => seekBy(10)} className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600">
                    +10s
                  </button>

                  <button onClick={playNext} className="rounded-full border border-gray-300 p-2 text-gray-600">
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => toggleMute()} className="rounded-full border border-gray-300 p-2 text-gray-600">{isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    className="w-24 accent-blue-600"
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
                    className="rounded-full border border-gray-300 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {showSettings ? (
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Toc do phat</p>
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

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Hen gio tat</p>
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
                    <button onClick={() => setSleepTimer(null)} className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 dark:border-red-800 dark:text-red-300">
                      Tat hen gio
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={customMinutes}
                      onChange={(event) => setCustomMinutes(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                      placeholder="Tu dat phut"
                    />
                    <button
                      onClick={() => {
                        const value = Number(customMinutes);
                        if (value > 0) setSleepTimer(value);
                      }}
                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                    >
                      Dat
                    </button>
                  </div>

                  {sleepMinutesLeft ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300">
                      <Timer className="h-3.5 w-3.5" /> Con khoang {sleepMinutesLeft} phut se tu tat
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!hasPlayableAudio ? <p className="text-xs text-amber-600 dark:text-amber-300">Chương hiện tại chưa có file audio để phát.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">YouTube Player</h2>
            {chapterIsLocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="inline-flex items-center gap-1 font-semibold"><Lock className="h-4 w-4" /> Chương này đang bị khóa</p>
                <p className="mt-1">{lockReasonLabel}</p>
                <button
                  onClick={openUnlockModal}
                  className="mt-3 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Mở khóa để xem YouTube
                </button>
              </div>
            ) : selectedChapter.youtubeVideoId ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <iframe
                  title="YouTube audio"
                  className="aspect-video w-full"
                  src={`https://www.youtube.com/embed/${selectedChapter.youtubeVideoId}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800/40 dark:text-gray-300">
                Chưa có video Youtube cho chương này.
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {suggestionBlock("Có thể bạn sẽ thích", relatedStories)}
        {rankingBlock("Truyện trending", trendingStories)}
        {rankingBlock("Truyện phổ biến", popularStories)}
        {rankingBlock("Truyện mới đăng", newestStories)}
      </section>

      {isUnlockModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Mở khóa chương</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{lockReasonLabel}</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Mở VIP {VIP_UNLOCK_DAYS} ngay với <b>{VIP_UNLOCK_COST.toLocaleString("vi-VN")}</b> credits.
            </p>

            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              Số dư hiện tại: <b>{Number(user?.credits ?? 0).toLocaleString("vi-VN")}</b> credits
            </div>

            {unlockError ? <p className="mt-3 text-sm font-medium text-red-600">{unlockError}</p> : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setIsUnlockModalOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Hủy
              </button>
              {showTopupAction ? (
                <button
                  onClick={() => router.push("/profile")}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  <CreditCard className="h-4 w-4" /> Di den trang mua credits
                </button>
              ) : null}
              <button
                onClick={handleBuyVip}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Mua VIP
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
