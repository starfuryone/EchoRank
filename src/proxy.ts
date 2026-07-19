import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { csrfProtection } from "@/lib/csrf-protection";
import { isSupportedLocale, resolveTarget, type Locale } from "@/lib/i18n/config";
// Import the registry directly, not the "@/lib/seo" barrel — the barrel
// re-exports JsonLd.tsx, and pulling React into the middleware bundle is a
// needless edge-runtime cost.
import { KNOWN_MARKETING_PATHS } from "@/lib/seo/registry";

const LOCALE_COOKIE = "echorank_locale";

// Path *prefixes* that never require auth. The localized homepages (/, /en,
// /fr, …) are public and handled by the locale logic below.
const publicPaths = ["/login", "/register", "/api/auth", "/api/feedback", "/f/", "/api/extension/import"];

// Exactly-public paths — matched whole, never by prefix.
//
// /api/av/audit backs the free audit widget on the AI Visibility landing page:
// anonymous by design, rate-limited per IP in the route itself (1/24h). It is
// listed here rather than in publicPaths so that a route added later at
// /api/av/audit/rerun, /api/av/audit-admin or /api/av/results does NOT inherit
// anonymous access by prefix. Opening a new one must be a deliberate edit.
//
// /api/av/audit/report renders a PDF from the audit result the anonymous widget
// already holds (no re-audit, not rate-limited). Same anonymous-by-design intent
// as /api/av/audit, so it is opted in here as a deliberate exact-match entry.
//
// CSRF is unaffected either way: the origin check above runs before this list.
const publicExactPaths = new Set(["/api/av/audit", "/api/av/audit/report"]);

/** First path segment, e.g. "/fr/x" -> "fr". */
function firstSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

/** "/xx/legal/terms" -> "/legal/terms". "/about" -> "". */
function dropFirstSegment(pathname: string): string {
  const rest = pathname.split("/").slice(2).join("/");
  return rest ? `/${rest}` : "";
}

/** "/about/" -> "/about". Leaves "/" alone. */
function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
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

  // ── Internal service-to-service bypass (sidecar, workers, cron) ──────
  // Secret is re-validated in the route handlers; this only skips the
  // browser-session redirect + CSRF for non-browser callers.
  if (
    pathname.startsWith("/api/") &&
    process.env.INTERNAL_API_SECRET &&
    req.headers.get("x-internal-secret") === process.env.INTERNAL_API_SECRET
  ) {
    return NextResponse.next();
  }

  // Public marketing page: AI visibility landing (all locales)
  if (/^\/(en|en-CA|fr|fr-CA|de-CH)\/(about|ai-visibility|reputation-risk|customer-feedback|reputation-engine|how-to|live-monitoring|act-on-signals|guide|guide-visibilite-ia|legal\/(privacy|terms|disclaimer))\/?$/.test(pathname)) {
    return NextResponse.next();
  }

  // ── Origin validation for mutating API requests ──────────────────────
  // Exclude /api/webhooks/ since those come from external services (e.g. Stripe)
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhooks/") &&
    !pathname.startsWith("/api/extension/import") &&
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

  // ── Locale guard for marketing pages ─────────────────────────────────
  // Canonicalize marketing URLs that carry no locale ("/about") or a bogus one
  // ("/xx/about") onto the English locale with a 308, so the same content is
  // never reachable under an unbounded set of prefixes.
  //
  // Deliberately scoped to paths in the SEO registry. The catch-all branch
  // below is the AUTH GATE — every real app route (/dashboard, /customers,
  // /settings, …) also has a non-locale first segment and falls through there.
  // Redirecting on "unknown first segment" alone would rewrite /customers to
  // /en/customers and break the authenticated app.
  {
    const marketingTarget = KNOWN_MARKETING_PATHS.includes(stripTrailingSlash(pathname))
      ? stripTrailingSlash(pathname) // "/about"
      : KNOWN_MARKETING_PATHS.includes(stripTrailingSlash(dropFirstSegment(pathname)))
        ? stripTrailingSlash(dropFirstSegment(pathname)) // "/xx/about"
        : null;
    if (marketingTarget) {
      const url = req.nextUrl.clone();
      url.pathname = `/en${marketingTarget}`;
      return NextResponse.redirect(url, 308);
    }
  }

  const isPublic =
    publicExactPaths.has(pathname) ||
    publicPaths.some((path) => pathname.startsWith(path));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Authenticated app routes ──────────────────────────────────────────
  // Expose the pathname to server components: the (dashboard) layout needs it
  // to enforce per-plan route access, and a layout can't read it otherwise.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
