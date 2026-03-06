"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Heart,
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
import StoryCard from "@/components/shared/StoryCard";
import { useAudioStore } from "@/stores/audio-store";

type ChapterItem = {
  id: string;
  title: string;
  chapterNumber: number;
  content: string | null;
  r2AudioUrl: string | null;
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
  return "Đang cập nhật";
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

export default function StoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug;
  const chapterIdFromQuery = searchParams?.get("chapterId");
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [relatedStories, setRelatedStories] = useState<StoryListItem[]>([]);
  const [trendingStories, setTrendingStories] = useState<StoryListItem[]>([]);
  const [popularStories, setPopularStories] = useState<StoryListItem[]>([]);
  const [newestStories, setNewestStories] = useState<StoryListItem[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("45");
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
  const playNextStore = useAudioStore((state) => state.playNext);
  const playPrevStore = useAudioStore((state) => state.playPrev);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const seekTo = useAudioStore((state) => state.seekTo);
  const setVolume = useAudioStore((state) => state.setVolume);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  useEffect(() => {
    if (!slug) return;

    const fetchDetail = async () => {
      try {
        const [detailRes, homeRes, popularRes] = await Promise.all([
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

        const detail = detailRes.data;
        setStory(detail);
        const initialChapter =
          chapterIdFromQuery && detail.chapters.some((chapter) => chapter.id === chapterIdFromQuery)
            ? chapterIdFromQuery
            : detail.chapters?.[0]?.id || null;
        setSelectedChapterId(initialChapter);

        setTrendingStories(homeRes.data.trending?.slice(0, 5) || []);
        setNewestStories(homeRes.data.newest?.slice(0, 5) || []);
        setPopularStories(popularRes.data.data || []);

        const firstCategoryId = detail.categories?.[0]?.category?.id;

        if (firstCategoryId) {
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
        } else {
          setRelatedStories((homeRes.data.featured || []).filter((item) => item.slug !== detail.slug).slice(0, 3));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [chapterIdFromQuery, slug]);

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

      const mappedQueue = selectedStory.chapters.map((item) => ({
        id: item.id,
        title: `Chương ${item.chapterNumber}: ${item.title}`,
        storySlug: selectedStory.slug,
        author: selectedStory.author?.name,
        audioUrl: item.r2AudioUrl || "",
        coverUrl: selectedStory.thumbnailUrl || undefined,
      }));

      const track = {
        id: chapter.id,
        title: `Chương ${chapter.chapterNumber}: ${chapter.title}`,
        storySlug: selectedStory.slug,
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
    [playTrack, setQueue, setTrack, togglePlay],
  );

  const playByIndex = useCallback(
    (index: number, autoPlay = true) => {
      if (!story || index < 0 || index >= story.chapters.length) return;
      const chapter = story.chapters[index];
      if (!chapter) return;
      void playChapter(chapter, story, autoPlay);
    },
    [playChapter, story],
  );

  const playNext = useCallback(() => {
    if (!story || !story.chapters.length) return;

    if (repeatMode === "one" && selectedChapter) {
      void playChapter(selectedChapter, story);
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

    playNextStore();
  }, [activeChapterIndex, isShuffle, playByIndex, playChapter, playNextStore, repeatMode, selectedChapter, story]);

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

    playPrevStore();
  }, [activeChapterIndex, isShuffle, playByIndex, playPrevStore, story]);

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
          text: "Nghe truyện này cùng mình nhé",
          url,
        });
        return;
      } catch {
        // ignore canceled share
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Đã sao chép liên kết truyện");
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
              <p className="text-xs text-gray-500 dark:text-gray-400">{Number(item.totalViews || 0).toLocaleString("vi-VN")} lượt xem</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải chi tiết truyện...</p>;
  }

  if (!story) {
    return <p className="text-sm text-red-600">Không tìm thấy truyện.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{story.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
            <span>Tác giả: <b>{story.author?.name || "Đang cập nhật"}</b></span>
            <span>{formatStatus(story.status)}</span>
            <span>Cập nhật: {formatDate(story.updatedAt)}</span>
            <span>{Number(story.totalViews || 0).toLocaleString("vi-VN")} lượt nghe</span>
            <span>⭐ {Number(story.averageRating || 0).toFixed(1)} ({story.ratingCount || 0})</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => setIsFavorite((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                isFavorite
                  ? "border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
              Thêm vào mục yêu thích
            </button>

            <button
              onClick={onShare}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Giới thiệu truyện</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">
            {story.description || "Truyện đang cập nhật phần giới thiệu."}
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Audio Player</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-[170px_1fr]">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className={`relative h-28 w-28 overflow-hidden rounded-full border-4 border-blue-200 dark:border-blue-900 ${isPlaying ? "animate-spin [animation-duration:10s]" : ""}`}>
                <img
                  src={story.thumbnailUrl || "https://placehold.co/300x300?text=No+Cover"}
                  alt={story.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="line-clamp-2 text-center text-xs text-gray-500 dark:text-gray-400">
                {selectedChapter ? `Chương ${selectedChapter.chapterNumber}` : "Chưa chọn chương"}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selectedChapter ? `Chương ${selectedChapter.chapterNumber}: ${selectedChapter.title}` : "Chưa có chương"}
              </p>

              <div>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => {
                    const nextTime = Number(event.target.value);
                    seekTo(nextTime);
                  }}
                  className="w-full accent-blue-600"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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

                <button onClick={playPrev} className="rounded-full border border-gray-300 p-2 text-gray-600">
                  <SkipBack className="h-4 w-4" />
                </button>

                <button onClick={() => seekBy(-10)} className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600">
                  -10s
                </button>

                <button
                  onClick={() => {
                    if (!selectedChapter || !hasPlayableAudio) return;
                    if (currentTrack?.id !== selectedChapter.id) {
                      void playChapter(selectedChapter, story);
                      return;
                    }
                    togglePlay(!isPlaying);
                  }}
                  disabled={!hasPlayableAudio}
                  className="rounded-full bg-blue-600 p-3 text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>

                <button onClick={() => seekBy(10)} className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600">
                  +10s
                </button>

                <button onClick={playNext} className="rounded-full border border-gray-300 p-2 text-gray-600">
                  <SkipForward className="h-4 w-4" />
                </button>

                <button onClick={() => toggleMute()} className="rounded-full border border-gray-300 p-2 text-gray-600">
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-24 accent-blue-600"
                />

                <div className="relative">
                  <button
                    onClick={() => setShowSettings((prev) => !prev)}
                    className="rounded-full border border-gray-300 p-2 text-gray-600"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>

                  {showSettings && (
                    <div className="absolute right-0 top-11 z-10 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tốc độ phát</p>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {[0.75, 1, 1.25, 1.5].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => setPlaybackRate(rate)}
                            className={`rounded-md px-2 py-1 text-xs ${playbackRate === rate ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>

                      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Hẹn giờ tắt</p>
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
                        <button
                          onClick={() => setSleepTimer(null)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 dark:border-red-800 dark:text-red-300"
                        >
                          Tắt hẹn giờ
                        </button>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input
                          type="number"
                          min={1}
                          value={customMinutes}
                          onChange={(event) => setCustomMinutes(event.target.value)}
                          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                          placeholder="Tự đặt phút"
                        />
                        <button
                          onClick={() => {
                            const value = Number(customMinutes);
                            if (value > 0) setSleepTimer(value);
                          }}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                        >
                          Đặt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!hasPlayableAudio && (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Chương hiện tại chưa có file audio để phát.
                </p>
              )}

              {sleepMinutesLeft ? (
                <p className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300">
                  <Timer className="h-3.5 w-3.5" /> Còn khoảng {sleepMinutesLeft} phút sẽ tự tắt
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Đọc truyện chữ</h2>
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-8 text-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
            {selectedChapter?.content || "Chương này chưa có bản truyện chữ."}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Có thể bạn sẽ thích</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedStories.map((item) => (
              <StoryCard key={item.id} story={item} />
            ))}
          </div>
          {!relatedStories.length && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chưa có truyện liên quan.</p>}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Đánh giá và bình luận</h2>
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Khu vực đánh giá và bình luận sẽ được cập nhật ở phiên bản tiếp theo.
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
            <span className="inline-flex items-center gap-2"><ListMusic className="h-4 w-4" /> Danh sách chương</span>
            <span className="text-xs text-gray-500">{chapterCount} chương</span>
          </h2>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {story.chapters.map((chapter, index) => {
              const isActive = chapter.id === selectedChapterId || (!selectedChapterId && index === 0);
              const unlockLabel = getUnlockLabel(chapter);
              return (
                <button
                  key={chapter.id}
                  onClick={() => void playChapter(chapter, story)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-blue-500 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {isActive && isPlaying ? <Play className="mr-1 inline h-3.5 w-3.5 text-blue-600" /> : `${chapter.chapterNumber}.`} Chương {chapter.chapterNumber}: {chapter.title}
                    </p>
                    <span className="text-[11px] text-gray-500">{formatDuration(chapter.audioDuration)}</span>
                  </div>

                  {chapter.accessType !== "free" ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                      <Lock className="h-3 w-3" /> {unlockLabel}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {rankingBlock("Truyện trending", trendingStories)}
        {rankingBlock("Truyện phổ biến", popularStories)}
        {rankingBlock("Truyện mới đăng", newestStories)}
      </aside>
    </div>
  );
}
