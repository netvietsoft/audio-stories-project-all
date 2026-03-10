"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    User,
    Mail,
    Shield,
    Calendar,
    CreditCard,
    Settings,
    ChevronRight,
    Award,
    Clock,
    Heart,
    BookOpen,
    History,
    PlayCircle,
    Sparkles,
    Trash2,
} from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useAudioStore } from "@/stores/audio-store";
import { useUserStore } from "@/stores/user-store";
import AvatarUpload from "@/components/profile/AvatarUpload";

type FavoriteStory = {
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    status: "ongoing" | "completed";
    totalViews: number;
    totalChapters?: number;
    chapterCount?: number | string;
    _count?: { chapters?: number };
    author?: { name: string };
};

const getFavoriteChapterTotal = (story: FavoriteStory) => {
    const values = [
        story._count?.chapters,
        story.chapterCount,
        story.totalChapters,
    ];

    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return 0;
};

type FavoritesResponse = {
    data: FavoriteStory[];
    meta?: {
        total: number;
    };
};

type HistoryItem = {
    id: string;
    progressSeconds: number;
    lastListenedAt: string;
    story: {
        id: string;
        slug: string;
        title: string;
        thumbnailUrl: string | null;
        author?: { name: string };
    };
    chapter: {
        id: string;
        chapterNumber: number;
        title: string;
        audioDuration: number | null;
        r2AudioUrl: string | null;
    };
};

type HistoryResponse = {
    data: HistoryItem[];
    meta?: {
        total: number;
    };
};

type PanelType = "favorites" | "history" | "activity";

const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return "00:00";
    const mm = Math.floor(seconds / 60);
    const ss = Math.floor(seconds % 60);
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const timeAgo = (input: string) => {
    const diff = Date.now() - new Date(input).getTime();
    if (Number.isNaN(diff) || diff < 0) return "Vừa xong";
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Vừa xong";
    if (min < 60) return `${min} phút trước`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} giờ trước`;
    const day = Math.floor(hour / 24);
    if (day < 30) return `${day} ngày trước`;
    return new Date(input).toLocaleDateString("vi-VN");
};

export default function ProfilePage() {
    const router = useRouter();
    const { user } = useUserStore();
    const [mounted, setMounted] = useState(false);
    const [activePanel, setActivePanel] = useState<PanelType>("activity");
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [favorites, setFavorites] = useState<FavoriteStory[]>([]);
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [favoriteTotal, setFavoriteTotal] = useState(0);
    const [listenedTotal, setListenedTotal] = useState(0);
    const [isMutating, setIsMutating] = useState(false);

    const playTrack = useAudioStore((state) => state.playTrack);
    const seekTo = useAudioStore((state) => state.seekTo);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !user) {
            router.push("/login");
        }
    }, [mounted, user, router]);

    useEffect(() => {
        if (!mounted || !user) return;

        const fetchRealProfileData = async () => {
            setIsLoadingData(true);
            try {
                const [favoriteRes, historyRes] = await Promise.all([
                    apiClient.get<FavoritesResponse>("/favorites", {
                        params: {
                            page: 1,
                            limit: 30,
                            sort: "latest",
                        },
                    }),
                    apiClient.get<HistoryResponse>("/history", {
                        params: {
                            page: 1,
                            limit: 100,
                        },
                    }),
                ]);

                setFavorites(favoriteRes.data.data || []);
                setHistoryItems(historyRes.data.data || []);
                setFavoriteTotal(favoriteRes.data.meta?.total ?? (favoriteRes.data.data || []).length);
                setListenedTotal(historyRes.data.meta?.total ?? (historyRes.data.data || []).length);
            } finally {
                setIsLoadingData(false);
            }
        };

        void fetchRealProfileData();
    }, [mounted, user]);

    const activeDays = useMemo(() => {
        return new Set(historyItems.map((item) => new Date(item.lastListenedAt).toDateString())).size;
    }, [historyItems]);

    const recentActivities = useMemo(
        () =>
            historyItems.slice(0, 8).map((item) => ({
                id: item.id,
                text: `Đã nghe chương ${item.chapter.chapterNumber}: ${item.chapter.title} (${item.story.title})`,
                time: timeAgo(item.lastListenedAt),
                rawTime: item.lastListenedAt,
            })),
        [historyItems],
    );

    const resumeFromHistory = (item: HistoryItem) => {
        const href = `/story/${item.story.slug}/chuong-${item.chapter.chapterNumber}`;
        if (item.chapter.r2AudioUrl) {
            playTrack(
                {
                    id: item.chapter.id,
                    chapterId: item.chapter.id,
                    storyId: item.story.id,
                    storySlug: item.story.slug,
                    chapterNumber: item.chapter.chapterNumber,
                    title: `Chương ${item.chapter.chapterNumber}: ${item.chapter.title}`,
                    author: item.story.author?.name,
                    audioUrl: item.chapter.r2AudioUrl,
                    coverUrl: item.story.thumbnailUrl || undefined,
                },
                [],
            );
            seekTo(item.progressSeconds || 0);
        }
        router.push(href);
    };

    const removeFavoriteItem = async (storyId: string) => {
        setIsMutating(true);
        try {
            await apiClient.post("/favorites/toggle", { storyId });
            setFavorites((prev) => prev.filter((item) => item.id !== storyId));
            setFavoriteTotal((prev) => Math.max(0, prev - 1));
        } finally {
            setIsMutating(false);
        }
    };

    const clearAllFavorites = async () => {
        if (!favorites.length) return;
        setIsMutating(true);
        try {
            await Promise.all(favorites.map((story) => apiClient.post("/favorites/toggle", { storyId: story.id })));
            setFavorites([]);
            setFavoriteTotal(0);
        } finally {
            setIsMutating(false);
        }
    };

    const removeHistoryItem = async (historyId: string) => {
        setIsMutating(true);
        try {
            await apiClient.delete(`/history/${historyId}`);
            setHistoryItems((prev) => prev.filter((item) => item.id !== historyId));
            setListenedTotal((prev) => Math.max(0, prev - 1));
        } finally {
            setIsMutating(false);
        }
    };

    const clearAllHistory = async () => {
        if (!historyItems.length) return;
        setIsMutating(true);
        try {
            await apiClient.delete("/history");
            setHistoryItems([]);
            setListenedTotal(0);
        } finally {
            setIsMutating(false);
        }
    };

    if (!mounted || !user) return null;

    return (
        <div className="max-w-7xl mx-auto pb-20">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Hồ sơ hiện tại</h2>
                    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
                        <div className="relative group">
                            <div className="h-28 w-28 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl dark:border-gray-900 md:h-36 md:w-36">
                                <img
                                    src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.id}`}
                                    alt="Avatar"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <AvatarUpload />
                        </div>

                        <div className="text-center sm:text-left">
                            <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-gray-900 dark:text-white sm:justify-start">
                                {user.name || "Người dùng"}
                                <Award className="h-6 w-6 text-amber-500" />
                            </h1>
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                                    {user.roles?.[0] || "Thành viên"}
                                </span>
                                <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <Clock className="h-4 w-4 text-blue-500" /> Tham gia hệ thống
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Thông tin tài khoản</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="ml-1 text-xs font-extrabold uppercase tracking-widest text-gray-400">Tên tài khoản</label>
                            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                                <User className="h-5 w-5 text-blue-500" />
                                <span className="font-bold text-gray-700 dark:text-gray-200">{user.name || "N/A"}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="ml-1 text-xs font-extrabold uppercase tracking-widest text-gray-400">Địa chỉ email</label>
                            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                                <Mail className="h-5 w-5 text-indigo-500" />
                                <span className="break-all font-bold text-gray-700 dark:text-gray-200">{user.email}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="ml-1 text-xs font-extrabold uppercase tracking-widest text-gray-400">Xếp hạng</label>
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-gray-400" />
                                    <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs font-bold text-gray-500 dark:bg-gray-800">
                                        Level {user.vipTier || 0}
                                    </span>
                                </div>
                                {user.vipExpirationDate ? (
                                    <p className="mt-1 text-[11px] text-gray-400">
                                        Hết hạn: {new Date(user.vipExpirationDate).toLocaleDateString("vi-VN")}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="ml-1 text-xs font-extrabold uppercase tracking-widest text-gray-400">Ví credits</label>
                            <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-3 dark:border-amber-900/30 dark:bg-green-900/10">
                                <CreditCard className="h-5 w-5 text-amber-500" />
                                <span className="text-lg font-extrabold text-green-700 dark:text-green-400">
                                    {Number(user.credits ?? 0).toLocaleString("vi-VN")}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="space-y-6">
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                        <h3 className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">
                            <Award className="h-5 w-5 text-amber-500" /> Thành tích cá nhân
                        </h3>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <BookOpen className="h-4 w-4" /> Audio đã nghe
                                </span>
                                <span className="font-extrabold text-blue-600 dark:text-blue-400">{listenedTotal}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <Heart className="h-4 w-4" /> Truyện yêu thích
                                </span>
                                <span className="font-extrabold text-red-500">{favoriteTotal}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                                    <Calendar className="h-4 w-4" /> Ngày hoạt động
                                </span>
                                <span className="font-mono font-extrabold text-green-500">{activeDays}</span>
                            </div>
                        </div>
                        {isLoadingData ? (
                            <p className="mt-4 text-xs text-gray-400">Đang đồng bộ dữ liệu thật...</p>
                        ) : null}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                        <div className="border-b border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                            <p className="px-2 text-xs font-bold uppercase tracking-widest text-gray-400">Quản lý</p>
                        </div>
                        <button
                            onClick={() => router.push("/profile/settings")}
                            className="group flex w-full items-center gap-3 border-b border-gray-100 px-6 py-4 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            <Settings className="h-5 w-5 text-gray-400 transition-transform group-hover:rotate-45" />
                            <span className="font-semibold">Cài đặt bảo mật</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-gray-300" />
                        </button>
                        <button
                            onClick={() => router.push("/topup")}
                            className="group flex w-full items-center gap-3 border-b border-gray-100 px-6 py-4 text-blue-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-blue-900/10"
                        >
                            <CreditCard className="h-5 w-5" />
                            <span className="font-semibold">Nạp credits</span>
                            <ChevronRight className="ml-auto h-4 w-4" />
                        </button>
                        <button
                            onClick={() => router.push("/profile/transactions")}
                            className="group flex w-full items-center gap-3 border-b border-gray-100 px-6 py-4 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            <CreditCard className="h-5 w-5 text-green-500" />
                            <span className="font-semibold">Lich su giao dich</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-gray-300" />
                        </button>
                        <button
                            onClick={() => setActivePanel("favorites")}
                            className="group flex w-full items-center gap-3 border-b border-gray-100 px-6 py-4 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            <Heart className="h-5 w-5 text-red-500" />
                            <span className="font-semibold">Truyện yêu thích</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-gray-300" />
                        </button>
                        <button
                            onClick={() => setActivePanel("history")}
                            className="group flex w-full items-center gap-3 border-b border-gray-100 px-6 py-4 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            <History className="h-5 w-5 text-blue-500" />
                            <span className="font-semibold">Lịch sử nghe</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-gray-300" />
                        </button>
                        <button
                            onClick={() => setActivePanel("activity")}
                            className="group flex w-full items-center gap-3 px-6 py-4 text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            <Sparkles className="h-5 w-5 text-purple-500" />
                            <span className="font-semibold">Hoạt động gần đây</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-gray-300" />
                        </button>
                    </div>
                </div>

                <div className="md:col-span-2 space-y-8">
                    <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {activePanel === "activity" && "Hoạt động gần đây"}
                                {activePanel === "favorites" && "Truyện yêu thích"}
                                {activePanel === "history" && "Lịch sử nghe"}
                            </h2>
                            {activePanel === "favorites" ? (
                                <button
                                    disabled={isMutating || favorites.length === 0}
                                    onClick={() => void clearAllFavorites()}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Xóa toàn bộ
                                </button>
                            ) : null}
                            {activePanel !== "favorites" ? (
                                <button
                                    disabled={isMutating || historyItems.length === 0}
                                    onClick={() => void clearAllHistory()}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Xóa toàn bộ
                                </button>
                            ) : null}
                        </div>

                        {activePanel === "activity" && recentActivities.length > 0 ? (
                            <div className="space-y-4">
                                {recentActivities.map((item) => {
                                    const history = historyItems.find((entry) => entry.id === item.id);
                                    return (
                                    <div key={item.id} className="group flex items-center gap-4 rounded-2xl border border-transparent p-4 transition-all hover:border-gray-100 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-700/50">
                                        <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-900/20">
                                            <BookOpen className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="line-clamp-1 text-base font-bold text-gray-800 dark:text-gray-100">{item.text}</p>
                                            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{item.time}</p>
                                        </div>
                                        {history ? (
                                            <button
                                                disabled={isMutating}
                                                onClick={() => void removeHistoryItem(history.id)}
                                                className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Xóa
                                            </button>
                                        ) : null}
                                    </div>
                                );})}
                            </div>
                        ) : null}

                        {activePanel === "favorites" ? (
                            favorites.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    {favorites.map((story) => {
                                        const chapterTotal = getFavoriteChapterTotal(story);

                                        return (
                                            <div
                                                key={story.id}
                                                className="group flex gap-4 rounded-2xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
                                            >
                                                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 sm:h-32 sm:w-24">
                                                    <Link href={`/story/${story.slug}`}>
                                                        <img
                                                            src={story.thumbnailUrl || "https://placehold.co/240x360?text=No+Cover"}
                                                            alt={story.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </Link>
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <Link href={`/story/${story.slug}`} className="min-w-0">
                                                            <p className="line-clamp-2 text-base font-bold text-gray-900 dark:text-gray-100">{story.title}</p>
                                                        </Link>
                                                        <button
                                                            disabled={isMutating}
                                                            onClick={() => void removeFavoriteItem(story.id)}
                                                            className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" /> Xóa
                                                        </button>
                                                    </div>
                                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                                        Tác giả: <b>{story.author?.name || "Đang cập nhật"}</b>
                                                    </p>
                                                    <div className="mt-2 space-y-1 text-xs">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-gray-500 dark:text-gray-400">{chapterTotal} chương</span>
                                                            <span className="text-gray-400 dark:text-gray-500">-</span>
                                                            <span className="rounded bg-blue-100 px-2 py-1 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                                {story.status === "completed" ? "Full" : "Đang ra"}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-500 dark:text-gray-400">
                                                            {Number(story.totalViews || 0).toLocaleString("vi-VN")} lượt nghe
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    Bạn chưa có truyện yêu thích nào.
                                </p>
                            )
                        ) : null}

                        {activePanel === "history" ? (
                            historyItems.length > 0 ? (
                                <div className="space-y-3">
                                    {historyItems.map((item) => {
                                        const duration = item.chapter.audioDuration || 0;
                                        const progress = duration > 0 ? Math.min(100, Math.floor((item.progressSeconds / duration) * 100)) : 0;
                                        return (
                                            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                                <div className="flex gap-4">
                                                    <Link href={`/story/${item.story.slug}`} className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                                                        <img
                                                            src={item.story.thumbnailUrl || "https://placehold.co/140x200?text=No+Cover"}
                                                            alt={item.story.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </Link>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{item.story.title}</p>
                                                            <button
                                                                disabled={isMutating}
                                                                onClick={() => void removeHistoryItem(item.id)}
                                                                className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" /> Xóa
                                                            </button>
                                                        </div>
                                                        <p className="mt-1 line-clamp-1 text-sm text-gray-600 dark:text-gray-300">
                                                            Chương {item.chapter.chapterNumber}: {item.chapter.title}
                                                        </p>
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            Đã nghe {formatDuration(item.progressSeconds)} / {formatDuration(item.chapter.audioDuration)}
                                                        </p>
                                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                                                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                                                        </div>
                                                        <div className="mt-3">
                                                            <button
                                                                onClick={() => resumeFromHistory(item)}
                                                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                                                            >
                                                                <PlayCircle className="h-4 w-4" /> Nghe tiếp
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    Chưa có lịch sử nghe.
                                </p>
                            )
                        ) : null}

                        {activePanel === "activity" && recentActivities.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                Chưa có dữ liệu hoạt động gần đây.
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
