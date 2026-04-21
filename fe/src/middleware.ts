import { NextResponse, type NextRequest } from "next/server";

import {
    ACCESS_TOKEN_KEY,
    AUTH_HOME_PATH,
    AUTH_LOGIN_PATH,
    AUTH_PROTECTED_PREFIXES,
} from "./constants/auth";
import { defaultLocale, isValidLocale, localeCookieName } from "./i18n";

const authRoutes = [AUTH_LOGIN_PATH, "/register"];

const localePrefixMatcher = /^\/(vi|en)(?=\/|$)/;
const publicFileMatcher = /\.[^/]+$/;

const detectLocaleFromHeaders = (request: NextRequest): "vi" | "en" => {
    const country = request.headers.get("cf-ipcountry");
    if (country) {
        return country.toUpperCase() === "VN" ? "vi" : "en";
    }

    const acceptLanguage = (request.headers.get("accept-language") || "").toLowerCase();
    if (!acceptLanguage) {
        return "vi";
    }

    if (acceptLanguage.includes("vi")) {
        return "vi";
    }

    if (acceptLanguage.includes("en")) {
        return "en";
    }

    return "vi";
};

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip locale/auth middleware for static files in /public and framework assets.
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname === "/sitemap.xml" ||
        pathname === "/robots.txt" ||
        publicFileMatcher.test(pathname)
    ) {
        return NextResponse.next();
    }

    const hasAccessToken = Boolean(request.cookies.get(ACCESS_TOKEN_KEY)?.value);

    const prefixedLocale = pathname.match(localePrefixMatcher)?.[1];
    const localeFromCookie = request.cookies.get(localeCookieName)?.value;
        const locale = isValidLocale(prefixedLocale)
                ? prefixedLocale
                : isValidLocale(localeFromCookie)
                    ? localeFromCookie
                    : defaultLocale;

    if (!prefixedLocale) {
                const detectedLocale = detectLocaleFromHeaders(request);
        const redirectedUrl = request.nextUrl.clone();
        const cleanPathname = pathname === "/" ? "" : pathname;
                redirectedUrl.pathname = `/${detectedLocale}${cleanPathname}`;
        
        const response = NextResponse.redirect(redirectedUrl);
                response.cookies.set(localeCookieName, detectedLocale, { path: "/" });
        return response;
    }

    const normalizedPathname = pathname.replace(localePrefixMatcher, "") || "/";

    const isProtectedRoute = AUTH_PROTECTED_PREFIXES.some((prefix) =>
        normalizedPathname.startsWith(prefix),
    );
    const isAuthRoute = authRoutes.some((route) => normalizedPathname.startsWith(route));
    
    const isAdminRoute = normalizedPathname.startsWith("/admin");
    const hasRefreshToken = Boolean(request.cookies.get("refresh_token")?.value);

    // Bắt toàn bộ các request đi vào /admin và các route con của nó, ngoại trừ /admin/login
    if (isAdminRoute && !normalizedPathname.startsWith("/admin/login")) {
        if (!hasRefreshToken) {
            const loginUrl = new URL(`/${locale}/admin/login`, request.url);
            loginUrl.searchParams.set("reason", "unauthorized");
            const response = NextResponse.redirect(loginUrl);
            response.cookies.set(localeCookieName, locale, { path: "/" });
            return response;
        }
    }

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
