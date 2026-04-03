"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Mail, Save } from "lucide-react";

import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";

export default function ProfileSettingsPage() {
  const t = useTranslations("ProfileSettingsPage");
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);

  const [allowEmailNoti, setAllowEmailNoti] = useState(true);
  const [allowBellNoti, setAllowBellNoti] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setAllowEmailNoti(user.allowEmailNoti ?? true);
    setAllowBellNoti(user.allowBellNoti ?? true);
  }, [user]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiClient.patch("/auth/me", {
        allow_email_noti: allowEmailNoti,
        allow_bell_noti: allowBellNoti,
      });

      if (user) {
        setUser({
          ...user,
          allowEmailNoti,
          allowBellNoti,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("title")}</h1>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-pink-600" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{t("emailTitle")}</p>
                <p className="text-sm text-gray-500">{t("emailDesc")}</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={allowEmailNoti}
              onChange={(event) => setAllowEmailNoti(event.target.checked)}
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{t("bellTitle")}</p>
                <p className="text-sm text-gray-500">{t("bellDesc")}</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={allowBellNoti}
              onChange={(event) => setAllowBellNoti(event.target.checked)}
              className="h-5 w-5"
            />
          </label>
        </div>

        <button
          onClick={() => void saveSettings()}
          disabled={saving}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {t("save")}
        </button>
      </div>
    </div>
  );
}
