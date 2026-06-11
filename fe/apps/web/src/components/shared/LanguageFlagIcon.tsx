"use client";

import { useMemo, useState } from "react";

type LanguageFlagIconProps = {
  countryCode: string;
  className?: string;
  title?: string;
};

export default function LanguageFlagIcon({
  countryCode,
  className = "h-4 w-5",
  title,
}: LanguageFlagIconProps) {
  const normalizedCode = useMemo(() => countryCode.trim().toLowerCase(), [countryCode]);
  const [hasError, setHasError] = useState(false);

  const isValidCountryCode = /^[a-z]{2}$/.test(normalizedCode);
  const src = isValidCountryCode ? `https://flagcdn.com/${normalizedCode}.svg` : "";

  if (!isValidCountryCode || hasError) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-[3px] bg-gray-200 text-[9px] font-bold uppercase text-gray-600 dark:bg-[#3a3b3c] dark:text-gray-200`}
        aria-hidden
      >
        {(normalizedCode || "na").toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={title || `${normalizedCode.toUpperCase()} flag`}
      title={title}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`${className} rounded-[3px] object-cover`}
      onError={() => setHasError(true)}
    />
  );
}
