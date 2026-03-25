"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { localeCookieName } from "@/i18n";

export default function LanguageSwitcher() {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("LanguageSwitcher");
  const currentLang = params?.lang === "en" ? "en" : "vi";

  const switchLocale = (nextLocale: "vi" | "en") => {
    if (nextLocale === currentLang) return;

    const nextPath = `/${nextLocale}`;

    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000`;
    router.push(nextPath);
    router.refresh();
  };

  return (
    <div className="hidden items-center gap-1 rounded-full border border-gray-200 bg-white px-1 py-1 dark:border-gray-700 dark:bg-gray-900 sm:flex">
      <span className="px-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t("label")}</span>
      <button
        onClick={() => switchLocale("vi")}
        className={`rounded-full px-2 py-1 text-xs font-semibold transition ${
          currentLang === "vi"
            ? "bg-blue-600 text-white"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
        type="button"
      >
        VI
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`rounded-full px-2 py-1 text-xs font-semibold transition ${
          currentLang === "en"
            ? "bg-blue-600 text-white"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
        type="button"
      >
        EN
      </button>
    </div>
  );
}
