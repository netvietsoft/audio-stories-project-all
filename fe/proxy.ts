import { NextResponse, type NextRequest } from "next/server";

import {
    ACCESS_TOKEN_KEY,
    AUTH_HOME_PATH,
    AUTH_LOGIN_PATH,
    AUTH_PROTECTED_PREFIXES,
} from "./src/constants/auth";
import { defaultLocale, isValidLocale, localeCookieName } from "./src/i18n";

const authRoutes = [AUTH_LOGIN_PATH, "/register"];

const localePrefixMatcher = /^\/(vi|en)(?=\/|$)/;

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasAccessToken = Boolean(request.cookies.get(ACCESS_TOKEN_KEY)?.value);

    const prefixedLocale = pathname.match(localePrefixMatcher)?.[1];
    const localeFromCookie = request.cookies.get(localeCookieName)?.value;
    const locale = isValidLocale(prefixedLocale)
        ? prefixedLocale
        : isValidLocale(localeFromCookie)
          ? localeFromCookie
          : defaultLocale;

    const normalizedPathname = prefixedLocale
        ? pathname.replace(localePrefixMatcher, "") || "/"
        : pathname;

    const isProtectedRoute = AUTH_PROTECTED_PREFIXES.some((prefix) =>
        normalizedPathname.startsWith(prefix),
    );
    const isAuthRoute = authRoutes.some((route) => normalizedPathname.startsWith(route));

    if (prefixedLocale) {
        const rewriteUrl = request.nextUrl.clone();
        rewriteUrl.pathname = normalizedPathname;

        const response = NextResponse.rewrite(rewriteUrl);
        response.cookies.set(localeCookieName, locale, { path: "/" });
        return response;
    }

    if (isProtectedRoute && !hasAccessToken) {
        const loginUrl = new URL(AUTH_LOGIN_PATH, request.url);
        loginUrl.searchParams.set("redirect", normalizedPathname);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set(localeCookieName, locale, { path: "/" });
        return response;
    }

    if (isAuthRoute && hasAccessToken) {
        const response = NextResponse.redirect(new URL(AUTH_HOME_PATH, request.url));
        response.cookies.set(localeCookieName, locale, { path: "/" });
        return response;
    }

    const response = NextResponse.next();
    response.cookies.set(localeCookieName, locale, { path: "/" });
    return response;
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
