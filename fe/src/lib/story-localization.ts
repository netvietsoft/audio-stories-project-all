export const getLocalizedValue = (
  locale: string,
  vi?: string | null,
  en?: string | null,
  fallback?: string | null,
) => {
  if (locale === "en") return en || vi || fallback || "";
  return vi || en || fallback || "";
};

export const getRequestedLocaleValue = (
  locale: string,
  vi?: string | null,
  en?: string | null,
  fallback?: string | null,
) => {
  const requested = locale === "en" ? en : vi;
  if (requested && requested.trim()) return requested;

  const hasDedicatedTranslations = Boolean((vi && vi.trim()) || (en && en.trim()));
  if (!hasDedicatedTranslations) return fallback || "";

  return "";
};

export const getLocaleLabel = (locale: string) => (locale === "en" ? "English" : "tiếng Việt");