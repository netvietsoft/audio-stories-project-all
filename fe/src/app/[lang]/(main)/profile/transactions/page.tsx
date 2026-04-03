"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type TransactionRow = {
  id: string;
  source: "payment" | "credit";
  createdAt: string;
  amount: number;
  status: string;
  content: string;
};

type TransactionsResponse = {
  data: TransactionRow[];
  meta?: {
    page: number;
    lastPage: number;
  };
};

import { apiClient } from "@/lib/api/api-client";

export default function ProfileTransactionsPage() {
  const t = useTranslations("ProfileTransactionsPage");
  const locale = useLocale();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiClient.get<TransactionsResponse>("/transactions/my", {
          params: { page: 1, limit: 30 },
        });
        setRows(response.data.data || []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">{t("title")}</h1>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/40">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t("date")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("content")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("amount")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">{t("loading")}</td>
                </tr>
              ) : rows.length ? (
                rows.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</td>
                    <td className="px-4 py-3">{item.content}</td>
                    <td className="px-4 py-3 font-semibold">{Number(item.amount).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}</td>
                    <td className="px-4 py-3">{item.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">{t("empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
