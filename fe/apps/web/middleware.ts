import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_KEY,
  AUTH_HOME_PATH,
  AUTH_LOGIN_PATH,
  AUTH_PROTECTED_PREFIXES,
} from "@audio-stories/shared/auth";
import { localeCookieName } from "@audio-stories/shared/i18n";
import {
  detectLocaleFromHeaders,
  getLocaleFromRequest,
  localePrefixMatcher,
  shouldSkipMiddlewarePath,
  stripLocale,
} from "@audio-stories/shared/middleware";

const authRoutes = [AUTH_LOGIN_PATH, "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipMiddlewarePath(pathname)) return NextResponse.next();

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
  const hasAccessToken = Boolean(request.cookies.get(ACCESS_TOKEN_KEY)?.value);
  const isProtectedRoute = AUTH_PROTECTED_PREFIXES.some((prefix) => normalizedPathname.startsWith(prefix));
  const isAuthRoute = authRoutes.some((route) => normalizedPathname.startsWith(route));

  if (isProtectedRoute && !hasAccessToken) {
    const loginUrl = new URL(`/${locale}${AUTH_LOGIN_PATH}`, request.url);
    loginUrl.searchParams.set("redirect", normalizedPathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(localeCookieName, locale, { path: "/" });
    return response;
  }

  if (isAuthRoute && hasAccessToken) {
    const response = NextResponse.redirect(new URL(`/${locale}${AUTH_HOME_PATH}`, request.url));
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
