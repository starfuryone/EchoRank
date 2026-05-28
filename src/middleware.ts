import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { csrfProtection } from "@/lib/csrf-protection";
import { isSupportedLocale, resolveTarget, type Locale } from "@/lib/i18n/config";

const LOCALE_COOKIE = "echorank_locale";

// Paths that never require auth. The localized homepages (/, /en, /fr, …) are
// public and handled by the locale logic below.
const publicPaths = ["/login", "/register", "/api/auth", "/api/feedback", "/f/"];

/** First path segment, e.g. "/fr/x" -> "fr". */
function firstSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

/**
 * Resolve the homepage locale + currency for a request. A valid
 * `echorank_locale` cookie (set by the nav toggle) wins over geo detection,
 * per GDPR user-choice.
 */
function resolveHomepage(req: Parameters<Parameters<typeof auth>[0]>[0]) {
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(cookieLocale)) {
    // Cookie fixes the language; currency still follows geo when compatible.
    const geo = resolveTarget(
      req.headers.get("cf-ipcountry"),
      req.headers.get("cf-region-code"),
      req.headers.get("accept-language"),
    );
    return { locale: cookieLocale as Locale, currency: geo.currency };
  }
  return resolveTarget(
    req.headers.get("cf-ipcountry"),
    req.headers.get("cf-region-code"),
    req.headers.get("accept-language"),
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // ── Origin validation for mutating API requests ──────────────────────
  // Exclude /api/webhooks/ since those come from external services (e.g. Stripe)
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhooks/") &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS"
  ) {
    const csrfResult = csrfProtection(req);
    if (csrfResult) return csrfResult;
  }

  // ── Localized marketing homepage ──────────────────────────────────────
  // Root "/" is rewritten to the resolved locale; the geo-resolved currency is
  // forwarded so the page can show the right prices without putting currency
  // in the URL.
  if (pathname === "/") {
    const { locale, currency } = resolveHomepage(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}`;
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-echorank-currency", currency);
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // Explicit "/{locale}" homepage: public. Forward the geo currency, and
  // persist the locale as the user's explicit choice (this is the path the
  // nav switcher navigates to), so subsequent "/" visits honor it.
  const seg = firstSegment(pathname);
  if (isSupportedLocale(seg)) {
    const { currency } = resolveHomepage(req);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-echorank-currency", currency);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.cookies.set(LOCALE_COOKIE, seg, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return res;
  }

  const isPublic = publicPaths.some((path) => pathname.startsWith(path));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
