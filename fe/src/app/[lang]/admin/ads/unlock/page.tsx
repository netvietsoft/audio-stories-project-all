"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import Link from "@/components/shared/LocalizedLink";
import Image from "next/image";

export default function AdminAdsUnlockPage() {
  const t = useTranslations("Admin.AdsUnlock");
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reappearMinutes, setReappearMinutes] = useState<number>(15);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const resp = await apiClient.get('/ads', { params: { routeType: 2, lang: 'all' } });
      setAds(resp.data.data || resp.data || []);
    } catch (e) {
      console.error(e);
      setAds([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSettings() {
    try {
      const r1 = await apiClient.get('/settings/unlock_ad_reappearance_minutes');
      setReappearMinutes(Number(r1?.data?.value ?? r1?.data) || 15);
    } catch (e) {
      setReappearMinutes(15);
    }

    try {
      const r2 = await apiClient.get('/settings/unlock_ad_countdown_seconds');
      setCountdownSeconds(Number(r2?.data?.value ?? r2?.data) || 5);
    } catch (e) {
      setCountdownSeconds(5);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await Promise.all([
        apiClient.patch('/settings/unlock_ad_reappearance_minutes', {
          value: Number(reappearMinutes) || 15,
        }),
        apiClient.patch('/settings/unlock_ad_countdown_seconds', {
          value: Number(countdownSeconds) || 5,
        }),
      ]);
      // optionally refetch
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="text-lg font-bold">{t("settingsTitle")}</h2>
        <p className="text-sm text-gray-500">{t("settingsDesc")}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="rounded-2xl bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("adsListTitle")}</h2>
          <div className="flex items-center gap-2">
            <Link href="/admin/ads/unlock/new">
              <button className="rounded-md bg-amber-500 px-3 py-1 text-white">Thêm quảng cáo mở khóa</button>
            </Link>
            <Link href="/admin/ads">
              <button className="rounded-md border px-3 py-1">{t("manageInline")}</button>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? <p>{t("loading")}</p> : ads.length === 0 ? <p>{t("noAds")}</p> : ads.map((ad) => (
            <div key={ad.id} className="rounded-lg border p-3 flex items-start gap-3">
              <div className="w-20 h-20 relative rounded overflow-hidden bg-gray-100">
                {ad.imageUrl ? <Image src={ad.imageUrl} alt={ad.title} fill className="object-cover" /> : null}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{ad.title}</div>
                <div className="text-sm text-gray-500">{ad.partnerName}</div>
                <div className="mt-2">
                  <a href={ad.targetUrl} target="_blank" rel="noreferrer" className="text-pink-600">{t("preview")}</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
