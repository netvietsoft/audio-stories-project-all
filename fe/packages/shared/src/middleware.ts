import type { NextRequest } from "next/server";

import { defaultLocale, isValidLocale, localeCookieName, type AppLocale } from "./i18n";

export const localePrefixMatcher = /^\/(vi|en)(?=\/|$)/;
export const publicFileMatcher = /\.[^/]+$/;

export function shouldSkipMiddlewarePath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    publicFileMatcher.test(pathname)
  );
}

export function detectLocaleFromHeaders(request: NextRequest): AppLocale {
  const country = request.headers.get("cf-ipcountry");
  if (country) return country.toUpperCase() === "VN" ? "vi" : "en";

  const acceptLanguage = (request.headers.get("accept-language") || "").toLowerCase();
  if (acceptLanguage.includes("vi")) return "vi";
  if (acceptLanguage.includes("en")) return "en";
  return defaultLocale;
}

export function getLocaleFromRequest(request: NextRequest, prefixedLocale?: string): AppLocale {
  const localeFromCookie = request.cookies.get(localeCookieName)?.value;
  if (isValidLocale(prefixedLocale)) return prefixedLocale;
  if (isValidLocale(localeFromCookie)) return localeFromCookie;
  return defaultLocale;
}

export function stripLocale(pathname: string): string {
  return pathname.replace(localePrefixMatcher, "") || "/";
}
