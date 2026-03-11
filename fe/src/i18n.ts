export const locales = ["vi", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "vi";
export const localeCookieName = "NEXT_LOCALE";

export const isValidLocale = (value?: string | null): value is AppLocale => {
  return Boolean(value && locales.includes(value as AppLocale));
};
