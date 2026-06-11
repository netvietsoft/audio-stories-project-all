"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AdminLanguage } from "@/hooks/useAdminLanguages";
import { localeCookieName } from "@/i18n";

interface AdminLanguageDropdownProps {
  languages: AdminLanguage[];
  value: string;
  onChange: (nextKey: string) => void;
  className?: string;
  selectClassName?: string;
  disabled?: boolean;
}

export default function AdminLanguageDropdown({
  languages,
  value,
  onChange,
  className = "",
  selectClassName = "",
  disabled = false,
}: AdminLanguageDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleLanguageChange = (nextKey: string) => {
    onChange(nextKey);

    // Also update the URL and cookie sync
    const segments = pathname.split("/");
    if (segments[1] === "vi" || segments[1] === "en") {
      segments[1] = nextKey;
      const newPathname = segments.join("/");
      const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";

      document.cookie = `${localeCookieName}=${nextKey}; path=/; max-age=31536000`;
      router.push(`${newPathname}${queryString}`);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => handleLanguageChange(event.target.value)}
        className={`w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-bold text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${selectClassName}`}
      >
        {languages.map((language) => (
          <option key={language.key} value={language.key}>
            {language.name} ({language.key.toUpperCase()})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
