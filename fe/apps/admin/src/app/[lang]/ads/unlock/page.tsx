"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTranslations } from "next-intl";
import { Loader2, Megaphone, Pencil, Trash2 } from "lucide-react";
import Link from "@/components/shared/LocalizedLink";

import { adminApiClient as apiClient, ADMIN_ACCESS_TOKEN_KEY } from "@/lib/api/admin-api-client";
import { unwrapList, unwrapData } from "@/lib/api/unwrap";
import { useDebounce } from "@/hooks/useDebounce";
import { useAdminStore } from "@/stores/admin-store";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

type UnlockAdItem = {
  id: string;
  title: string;
  partnerName: string;
  imageUrl?: string | null;
  language?: "vi" | "en" | "all" | string;
  isGlobal?: boolean;
  clickCount?: number;
  isActive: boolean;
  createdAt?: string;
};

export default function AdminAdsUnlockPage() {
  const t = useTranslations("Admin.AdsUnlock");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ lang?: string }>();

  const selectedLanguage = searchParams.get("language") || "all";
  const selectedPartner = searchParams.get("partnerName") || "all";
  const selectedStatus = searchParams.get("isActive") || "all";
  const selectedSort = searchParams.get("sort") || "click_desc";
  const searchTitle = searchParams.get("title") || "";

  const [ads, setAds] = useState<UnlockAdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Array<{ key: string; name: string }>>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState(searchTitle);
  const debouncedTitle = useDebounce(searchInput, 400);

  const [reappearMinutes, setReappearMinutes] = useState<number>(15);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(5);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUnauthorized = () => {
    useAdminStore.getState().clearAuth();
    if (typeof window !== "undefined") {
      localStorage.removeItem("adminLoggedIn");
      localStorage.removeItem("userEmail");
      localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    }
    const lang = params?.lang === "en" ? "en" : "vi";
    router.push(`/${lang}/login`);
  };

  const setFilterParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  useEffect(() => {
    setSearchInput(searchTitle);
  }, [searchTitle]);

  useEffect(() => {
    const current = (searchParams.get("title") || "").trim();
    const nextTitle = debouncedTitle.trim();
    if (current === nextTitle) return;
    const next = new URLSearchParams(searchParams.toString());
    if (nextTitle) {
      next.set("title", nextTitle);
    } else {
      next.delete("title");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [debouncedTitle, pathname, router, searchParams]);

  async function fetchData() {
    setLoading(true);
    try {
      const sortBy = selectedSort.startsWith("click_") ? "clickCount" : undefined;
      const sortOrder = selectedSort.endsWith("_asc") ? "asc" : "desc";
      const resp = await apiClient.get("/ads", {
        params: {
          routeType: 2,
          ...(searchTitle.trim() ? { title: searchTitle.trim() } : {}),
          ...(selectedPartner !== "all" ? { partnerName: selectedPartner } : {}),
          ...(selectedLanguage !== "all" ? { language: selectedLanguage } : {}),
          ...(selectedStatus !== "all" ? { isActive: selectedStatus } : {}),
          ...(sortBy ? { sortBy, sortOrder } : {}),
        },
      });
      setAds(unwrapList<UnlockAdItem>(resp.data));
    } catch (e) {
      if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
        handleUnauthorized();
      } else {
        console.error(e);
      }
      setAds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, [searchTitle, selectedLanguage, selectedPartner, selectedStatus, selectedSort]);

  useEffect(() => {
    const fetchFiltersData = async () => {
      try {
        const [partnersResponse, languagesResponse] = await Promise.all([
          apiClient.get("/ads/partners", { params: { routeType: 2 } }),
          apiClient.get("/languages", { params: { all: "true", active: "true" } }),
        ]);
        setPartners(unwrapList<string>(partnersResponse.data));
        const rows = unwrapList<{ key?: string; name?: string }>(languagesResponse.data);
        setLanguages(
          rows
            .map((row: { key?: string; name?: string }) => ({
              key: row.key || "",
              name: row.name || row.key || "",
            }))
            .filter((row: { key: string; name: string }) => Boolean(row.key)),
        );
      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          handleUnauthorized();
        } else {
          console.error("Failed to fetch unlock ads filter data:", error);
        }
        setPartners([]);
        setLanguages([]);
      }
    };

    void fetchFiltersData();
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const r1 = await apiClient.get("/settings/unlock_ad_reappearance_minutes");
      setReappearMinutes(Number(unwrapData<{ value?: number }>(r1?.data)?.value) || 15);
    } catch {
      setReappearMinutes(15);
    }

    try {
      const r2 = await apiClient.get("/settings/unlock_ad_countdown_seconds");
      setCountdownSeconds(Number(unwrapData<{ value?: number }>(r2?.data)?.value) || 5);
    } catch {
      setCountdownSeconds(5);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await Promise.all([
        apiClient.patch("/settings/unlock_ad_reappearance_minutes", {
          value: Number(reappearMinutes) || 15,
        }),
        apiClient.patch("/settings/unlock_ad_countdown_seconds", {
          value: Number(countdownSeconds) || 5,
        }),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(t("deleteConfirm", { title }))) return;

    setDeletingId(id);
    try {
      await apiClient.delete(`/ads/${id}`);
      setAds((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
      alert(t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="text-lg font-bold">{t("settingsTitle")}</h2>
        <p className="text-sm text-gray-500">{t("settingsDesc")}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col">
            <span className="text-sm font-semibold">{t("reappearMinutes")}</span>
            <input type="number" min={1} value={reappearMinutes} onChange={(e) => setReappearMinutes(Number(e.target.value))} className="mt-1 rounded-md border p-2" />
          </label>
          <label className="flex flex-col">
            <span className="text-sm font-semibold">{t("countdownSeconds")}</span>
            <input type="number" min={0} value={countdownSeconds} onChange={(e) => setCountdownSeconds(Number(e.target.value))} className="mt-1 rounded-md border p-2" />
          </label>
        </div>
        <div className="mt-3">
          <button onClick={saveSettings} disabled={saving} className="rounded-md bg-pink-600 px-4 py-2 text-white">{saving ? t("saving") : t("save")}</button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-200">
              <Megaphone className="h-6 w-6 text-white" />
            </span>
            {t("adsListTitle")}
          </h1>
          <p className="mt-2 font-medium text-slate-500">Danh sách campaign quảng cáo mở khóa chương bằng quảng cáo.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/ads/unlock/new" className="rounded-md bg-amber-500 px-3 py-2 text-white">{t("addAd")}</Link>
          <Link href="/ads" className="rounded-md border px-3 py-2">{t("manageInline")}</Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1">
          <div className="min-w-[280px] flex-1">
            <label htmlFor="unlock-ads-search-title" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
              Tìm theo tiêu đề
            </label>
            <input
              id="unlock-ads-search-title"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nhập tiêu đề quảng cáo..."
              className="admin-input h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-slate-700"
            />
          </div>

          <div className="min-w-[190px] flex-shrink-0">
            <label htmlFor="unlock-ads-partner-filter" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
              Đối tác
            </label>
            <select
              id="unlock-ads-partner-filter"
              value={selectedPartner}
              onChange={(event) => setFilterParam("partnerName", event.target.value)}
              className="admin-input h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold text-slate-700"
            >
              <option value="all">Tất cả</option>
              {partners.map((partner) => (
                <option key={partner} value={partner}>{partner}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[170px] flex-shrink-0">
            <label htmlFor="unlock-ads-language-filter" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
              Ngôn ngữ
            </label>
            <select
              id="unlock-ads-language-filter"
              value={selectedLanguage}
              onChange={(event) => setFilterParam("language", event.target.value)}
              className="admin-input h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold text-slate-700"
            >
              <option value="all">Tất cả</option>
              {languages.map((language) => (
                <option key={language.key} value={language.key}>{language.name}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[170px] flex-shrink-0">
            <label htmlFor="unlock-ads-status-filter" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
              Trạng thái
            </label>
            <select
              id="unlock-ads-status-filter"
              value={selectedStatus}
              onChange={(event) => setFilterParam("isActive", event.target.value)}
              className="admin-input h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold text-slate-700"
            >
              <option value="all">Tất cả</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-shrink-0">
          <label htmlFor="unlock-ads-sort-filter" className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
            Sắp xếp click
          </label>
          <select
            id="unlock-ads-sort-filter"
            value={selectedSort}
            onChange={(event) => setFilterParam("sort", event.target.value)}
            className="admin-input h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="click_desc">Click giảm dần</option>
            <option value="click_asc">Click tăng dần</option>
          </select>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Ảnh</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Tiêu đề</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Đối tác</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Ngôn ngữ</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-400">Lượt Click</th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Ngày tạo</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-400">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" />
                  </td>
                </tr>
              ) : ads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm font-medium text-slate-500">{t("noAds")}</td>
                </tr>
              ) : (
                ads.map((ad) => (
                  <tr key={ad.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {ad.imageUrl ? (
                          <img src={ad.imageUrl} alt={ad.title} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{ad.title}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{ad.partnerName}</td>
                    <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                      {ad.isGlobal ? "ALL" : (ad.language === "vi" ? "VI" : ad.language === "en" ? "EN" : "ALL")}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-slate-800">{Number(ad.clickCount ?? 0).toLocaleString("vi-VN")}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${ad.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {ad.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">
                      {ad.createdAt ? new Date(ad.createdAt).toLocaleDateString("vi-VN") : "--"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/ads/unlock/${ad.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
                          <Pencil className="h-3.5 w-3.5" />
                          {t("edit")}
                        </Link>
                        <button
                          onClick={() => void handleDelete(ad.id, ad.title)}
                          disabled={deletingId === ad.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === ad.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {t("delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
