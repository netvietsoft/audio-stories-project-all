import { NextResponse, type NextRequest } from "next/server";

import { proxy } from "./proxy";
import { defaultLocale } from "./src/i18n";

const localePrefixMatcher = /^\/(vi|en)(?=\/|$)/;

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname.includes(".")
	) {
		return NextResponse.next();
	}

	const hasLocalePrefix = localePrefixMatcher.test(pathname);
	if (!hasLocalePrefix) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
		return NextResponse.redirect(redirectUrl);
	}

	return proxy(request);
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
