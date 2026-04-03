"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api/api-client";

type HallMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  vipTier: number;
  credits: number;
  totalUnlockedStories: number;
};

export default function HallOfFamePage() {
  const t = useTranslations("HallPage");
  const [members, setMembers] = useState<HallMember[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await apiClient.get<{ data: HallMember[] }>("/stories/hall-of-fame", {
        params: { limit: 20 },
      });
      setMembers(res.data.data || []);
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {members.slice(0, 3).map((member, idx) => (
          <div key={member.id} className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 dark:border-[#303133] dark:from-[#242526] dark:to-[#242526]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">{t("top", { rank: idx + 1 })}</p>
            <div className="mt-3 flex items-center gap-3">
              <img
                src={member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.displayName}`}
                alt={member.displayName}
                className="h-14 w-14 rounded-full"
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{member.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">VIP {member.vipTier}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#303133] dark:bg-[#242526]">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t("fullRanking")}</h2>
        <div className="mt-3 space-y-2">
          {members.map((member, idx) => (
            <div key={member.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-[#303133] dark:bg-[#212121]">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-500">#{idx + 1}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{member.displayName}</span>
              </div>
              <span className="text-xs text-slate-500">{t("vipUnlocked", { tier: member.vipTier, count: member.totalUnlockedStories })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
