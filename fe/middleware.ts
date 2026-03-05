import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_TOKEN_KEY,
  AUTH_HOME_PATH,
  AUTH_LOGIN_PATH,
  AUTH_PROTECTED_PREFIXES,
} from "./src/constants/auth";

const authRoutes = [AUTH_LOGIN_PATH, "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = Boolean(request.cookies.get(ACCESS_TOKEN_KEY)?.value);

  const isProtectedRoute = AUTH_PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !hasAccessToken) {
    const loginUrl = new URL(AUTH_LOGIN_PATH, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && hasAccessToken) {
    return NextResponse.redirect(new URL(AUTH_HOME_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
