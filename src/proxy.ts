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
// /api/public/v1/ is the tenant public API + MCP server: public by design,
// authenticated per-request with hashed bearer API keys (src/lib/api-keys.ts,
// paid-plan-gated + per-key rate limit) — the browser session never applies.
// CSRF origin checks don't interfere: v1 data routes are GET-only, and the
// MCP POST endpoint is called by non-browser clients that authenticate via
// the Authorization header, never via cookies.
const publicPaths = ["/login", "/register", "/api/auth", "/api/feedback", "/f/", "/api/extension/import", "/api/public/v1/"];

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
//
// /api/av/keywords backs the free keyword-scan widget on the same landing
// page: anonymous by design, Redis-rate-limited per IP in the route itself
// (2/24h, cf-connecting-ip required). Exact-match for the same reason as
// /api/av/audit — nothing under /api/av/keywords/* inherits anonymity.
// /api/billing/checkout is listed here so it can REFUSE anonymous callers
// itself, not so it can serve them. Checkout requires an account; the route
// returns 401 and the pricing card sends the visitor to /register?plan=… ,
// which resumes checkout after signup.
//
// Without this entry the auth check below redirects the POST to /login, and a
// redirect is followed by fetch() and arrives as HTML with status 200 — which
// the caller cannot tell apart from success, so the button would appear to do
// nothing. Verified empirically: the sibling path /api/billing/other returns
// 307 while this one reaches the route.
//
// CSRF is unaffected (the origin check above runs first and does not consult
// this list). Exact-match, so nothing added later under /api/billing/ inherits
// the exemption.
// /api/webhooks is the Stripe delivery endpoint. It carries no session cookie
// — Stripe is not a browser — so the auth check below was redirecting every
// signed delivery to /login. Together with the CSRF prefix that never matched
// the un-suffixed path, that made the endpoint unreachable by design. It went
// unnoticed because no checkout existed to generate an event.
//
// This is not an open door: the route verifies the Stripe signature against
// STRIPE_WEBHOOK_SECRET before it reads anything, and refuses outright when
// that secret is absent.
const publicExactPaths = new Set([
  "/api/av/audit",
  "/api/av/audit/report",
  "/api/av/keywords",
  "/api/billing/checkout",
  "/api/webhooks",
]);

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
    // Both forms: the Stripe endpoint IS /api/webhooks with no trailing
    // segment, and the prefix test alone never matched it — so every signed
    // Stripe delivery was rejected 403 for a missing Origin before signature
    // verification ever ran. Stripe sends no Origin header and never will.
    pathname !== "/api/webhooks" &&
    !pathname.startsWith("/api/webhooks/") &&
    !pathname.startsWith("/api/extension/import") &&
    // Bearer-key-authenticated public API/MCP: cookies are never consulted,
    // so origin checks add nothing and would block non-browser clients.
    !pathname.startsWith("/api/public/v1/") &&
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
