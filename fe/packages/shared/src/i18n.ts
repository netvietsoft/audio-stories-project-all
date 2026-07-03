// ★ NGUỒN DUY NHẤT cấu hình locale cho cả web + admin (họ re-export qua @/i18n).
// Thêm/bớt ngôn ngữ hiển thị → sửa `locales` Ở ĐÂY (nhớ thêm messages/<code>.json ở mỗi app).
export const locales = ["vi", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "vi";
export const localeCookieName = "NEXT_LOCALE";

export function isValidLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
