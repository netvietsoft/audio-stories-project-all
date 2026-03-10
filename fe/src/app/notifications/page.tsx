"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";

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
      <div className="flex items-center justify-between">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
          <BellRing className="h-6 w-6 text-amber-500" /> Thong bao
        </h1>
        <button
          onClick={() => void markAllRead()}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Danh dau da doc tat ca
        </button>
      </div>

      <div className="space-y-3">
        {loading ? <p className="text-sm text-gray-500">Dang tai...</p> : null}
        {!loading && !items.length ? <p className="text-sm text-gray-500">Chua co thong bao.</p> : null}
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border p-4 ${item.isRead ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" : "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-900/20"}`}
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.body}</p>
            <p className="mt-2 text-xs text-gray-500">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
