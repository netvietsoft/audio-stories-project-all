"use client";

type HistoryItem = {
    id: string;
    lastListenedAt: string;
};

type HistoryResponse = {
    data: HistoryItem[];
    meta?: {
        total: number;
    };
};

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Award, BookOpen, Calendar, Clock, CreditCard, Heart, Mail, Shield, User } from "lucide-react";

import AvatarUpload from "@/components/profile/AvatarUpload";
import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";

type FavoritesResponse = {
    data: unknown[];
    meta?: {
        total: number;
    };
};

export default function ProfilePage() {
    const router = useRouter();
    const params = useParams<{ lang?: string }>();
    const currentLang = params?.lang === "en" ? "en" : "vi";
    const locale = useLocale();
    const t = useTranslations("ProfilePage");
    const user = useUserStore((state) => state.user);
    const isAuthHydrated = useUserStore((state) => state.isHydrated);
    const [mounted, setMounted] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [favoriteTotal, setFavoriteTotal] = useState(0);
    const [listenedTotal, setListenedTotal] = useState(0);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || !isAuthHydrated) return;
        if (!user) {
            router.push(`/${currentLang}`);
        }
    }, [currentLang, isAuthHydrated, mounted, router, user]);

    useEffect(() => {
        if (!mounted || !isAuthHydrated || !user) return;

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

                setHistoryItems(historyRes.data.data || []);
                setFavoriteTotal(favoriteRes.data.meta?.total ?? (favoriteRes.data.data || []).length);
                setListenedTotal(historyRes.data.meta?.total ?? (historyRes.data.data || []).length);
            } finally {
                setIsLoadingData(false);
            }
        };

        void fetchRealProfileData();
    }, [isAuthHydrated, mounted, user]);

    const activeDays = useMemo(() => {
        return new Set(historyItems.map((item) => new Date(item.lastListenedAt).toDateString())).size;
    }, [historyItems]);

    if (!mounted || !user) return null;

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#232325]">
                <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">{t("personalProfile")}</h1>
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
                    <div className="relative group">
                        <div className="h-28 w-28 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl dark:border-zinc-950 md:h-36 md:w-36">
                            <img
                                src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.id}`}
                                alt="Avatar"
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <AvatarUpload />
                    </div>

                    <div className="text-center sm:text-left">
                        <h2 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-gray-900 dark:text-white sm:justify-start">
                            {user.name || t("userFallback")}
                            <Award className="h-6 w-6 text-amber-500" />
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                            <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-pink-700 dark:bg-pink-900/40 dark:text-pink-400">
                                {user.roles?.[0] || t("member")}
                            </span>
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                                <Clock className="h-4 w-4 text-pink-500" /> {t("joinedSystem")}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#232325]">
                <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{t("accountInfo")}</h2>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <User className="h-5 w-5 text-pink-500" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">{t("accountName")}</p>
                            <p className="mt-1 font-bold text-gray-700 dark:text-gray-200">{user.name || "N/A"}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <Mail className="h-5 w-5 text-indigo-500" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">{t("emailAddress")}</p>
                            <p className="mt-1 break-all font-bold text-gray-700 dark:text-gray-200">{user.email}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <Shield className="h-5 w-5 text-gray-400" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">{t("rank")}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs font-bold text-gray-500 dark:bg-zinc-800">
                                    {t("level", { level: user.vipTier || 0 })}
                                </span>
                                {user.vipExpirationDate ? (
                                    <span className="text-[11px] text-gray-400">
                                        {t("expiresAt", { date: new Date(user.vipExpirationDate).toLocaleDateString(locale === "en" ? "en-US" : "vi-VN") })}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <CreditCard className="h-5 w-5 text-amber-500" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">{t("creditsWallet")}</p>
                            <p className="mt-1 text-lg font-extrabold text-green-700 dark:text-green-400">
                                {Number(user.credits ?? 0).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#232325]">
                <h3 className="mb-5 flex items-center gap-2 border-b border-gray-200 pb-3 text-lg font-bold text-gray-900 dark:border-zinc-800 dark:text-white">
                    <Award className="h-5 w-5 text-amber-500" /> {t("personalAchievements")}
                </h3>
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                            <BookOpen className="h-4 w-4" /> {t("audiosListened")}
                        </span>
                        <span className="font-extrabold text-pink-600 dark:text-pink-400">{listenedTotal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                            <Heart className="h-4 w-4" /> {t("favoriteStories")}
                        </span>
                        <span className="font-extrabold text-red-500">{favoriteTotal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                            <Calendar className="h-4 w-4" /> {t("activeDays")}
                        </span>
                        <span className="font-mono font-extrabold text-green-500">{activeDays}</span>
                    </div>
                </div>
                {isLoadingData ? <p className="mt-4 text-xs text-gray-400">{t("syncingData")}</p> : null}
            </div>
        </div>
    );
}
