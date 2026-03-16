"use client";

import { ChevronDown } from "lucide-react";

import type { AdminLanguage } from "@/hooks/useAdminLanguages";

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
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
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
