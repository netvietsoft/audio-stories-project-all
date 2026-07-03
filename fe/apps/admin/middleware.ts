import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_TOKEN_COOKIE } from "@audio-stories/shared/auth";
import { localeCookieName } from "@audio-stories/shared/i18n";
import {
  detectLocaleFromHeaders,
  getLocaleFromRequest,
  localePrefixMatcher,
  shouldSkipMiddlewarePath,
  stripLocale,
} from "@audio-stories/shared/middleware";

function redirectPreservingSearch(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipMiddlewarePath(pathname)) return NextResponse.next();

  if (pathname === "/admin") {
    const response = redirectPreservingSearch(request, "/vi");
    response.cookies.set(localeCookieName, "vi", { path: "/" });
    return response;
  }

  const oldAdminMatch = pathname.match(/^\/(vi|en)\/admin(?:\/(.*))?$/);
  if (oldAdminMatch) {
    const locale = oldAdminMatch[1];
    const rest = oldAdminMatch[2];
    const cleanPath = rest ? `/${locale}/${rest}` : `/${locale}`;
    const response = redirectPreservingSearch(request, cleanPath);
    response.cookies.set(localeCookieName, locale, { path: "/" });
    return response;
  }

  const prefixedLocale = pathname.match(localePrefixMatcher)?.[1];
  const locale = getLocaleFromRequest(request, prefixedLocale);

  if (!prefixedLocale) {
    const detectedLocale = detectLocaleFromHeaders(request);
    const redirectedUrl = request.nextUrl.clone();
    const cleanPathname = pathname === "/" ? "" : pathname;
    redirectedUrl.pathname = `/${detectedLocale}${cleanPathname}`;
    const response = NextResponse.redirect(redirectedUrl);
    response.cookies.set(localeCookieName, detectedLocale, { path: "/" });
    return response;
  }

  const normalizedPathname = stripLocale(pathname);
  const isLoginRoute = normalizedPathname === "/login" || normalizedPathname.startsWith("/login/");
  const hasRefreshToken = Boolean(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value);

  if (!isLoginRoute && !hasRefreshToken) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("reason", "unauthorized");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(localeCookieName, locale, { path: "/" });
    return response;
  }

  const response = NextResponse.next();
  response.cookies.set(localeCookieName, locale, { path: "/" });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json).*)"],
};
