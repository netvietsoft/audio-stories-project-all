"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { BellRing, ArrowLeft } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";

export const dynamic = 'force-dynamic';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  data: NotificationItem[];
};

export default function NotificationsPage() {
  const router = useRouter();
  const t = useTranslations("NotificationsPage");
  const locale = useLocale();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await apiClient.get<NotificationsResponse>("/notifications", {
        params: { page: 1, limit: 50 },
      });
      setItems(response.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markAllRead = async () => {
    await apiClient.patch("/notifications/read-all");
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {/* Back Button for Mobile */}
      <div className="flex items-center gap-4 lg:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center h-10 w-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 transition-all text-slate-600 dark:text-slate-300"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("title")}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="inline-flex items-center gap-3 text-3xl font-black text-gray-900 dark:text-gray-100 max-lg:hidden">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <BellRing className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          {t("title")}
        </h1>
        <h1 className="lg:hidden hidden"></h1> {/* Just for structural sanity if needed, but flex-between handles it */}
        
        {items.some(item => !item.isRead) && (
          <button
            onClick={() => void markAllRead()}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all ml-auto"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : null}
        
        {!loading && !items.length ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <BellRing className="h-10 w-10 text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">{t("empty")}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{t("emptyHint")}</p>
          </div>
        ) : null}
        
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl border-2 p-5 transition-all hover:shadow-md relative ${
              item.isRead 
                ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" 
                : "border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-900/20 shadow-sm"
            }`}
          >
            {!item.isRead && (
              <div className="absolute top-5 left-5">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
              </div>
            )}
            <div className={item.isRead ? "ml-0" : "ml-6"}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className={`font-bold text-base ${item.isRead ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-gray-100"}`}>
                    {item.title}
                  </p>
                  <p className={`mt-2 text-sm leading-relaxed ${item.isRead ? "text-gray-600 dark:text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>
                    {item.body}
                  </p>
                </div>
                {!item.isRead && (
                  <span className="px-2.5 py-1 bg-blue-500 text-white text-xs font-bold rounded-full shrink-0">
                    {t("new")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(item.createdAt).toLocaleString(locale === "en" ? "en-US" : "vi-VN", {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                {item.isRead && (
                  <span className="text-xs text-gray-400 dark:text-gray-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t("read")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
