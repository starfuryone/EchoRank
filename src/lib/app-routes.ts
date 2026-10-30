// src/lib/app-routes.ts
//
// The authenticated app's top-level route segments, and the one question the
// proxy asks of them: is "/{locale}/<app-route>" a link someone meant as
// "/<app-route>"?
//
// WHY THIS EXISTS. The app lives at bare paths (/dashboard, /ai, /settings…)
// and the marketing site at /{locale}/…, so "/en/dashboard" and
// "/fr/dashboard" matched the [locale] tree, found no page and 404'd — while
// the nav, emails and muscle memory all produce exactly those URLs. The proxy
// now 308s them onto the bare path.
//
// DEPENDENCY-FREE ON PURPOSE: the proxy imports it into the edge bundle. The
// list is asserted against the (dashboard) folders on disk by
// tests/locale-app-redirect.test.ts, so a new top-level app section that is
// not added here fails the suite instead of 404'ing under a locale.

export const APP_ROUTE_SEGMENTS: readonly string[] = [
  "ai",
  "analytics",
  "assistant",
  "billing",
  "campaigns",
  "customers",
  "dashboard",
  "extension",
  "feedback",
  "help",
  "imports",
  "intelligence",
  "monitoring",
  "notifications",
  "recovery",
  "reputation",
  "review-links",
  "settings",
  "team",
  "templates",
  "visibility",
];

/**
 * Segments the PUBLIC [locale] tree also uses. "/en/help/<slug>" is a real,
 * indexable help article (src/app/[locale]/help/[slug]); only the bare
 * "/en/help" means the in-app hub. These redirect on an exact match only.
 */
const SHARED_WITH_LOCALE_TREE = new Set(["help"]);

/**
 * "/fr/dashboard/x?y" -> "/dashboard/x"; null when the path is not an app
 * route under a locale. The caller has already established that the first
 * segment is a supported locale; this looks only at what follows it.
 */
export function localeAppRedirect(pathname: string): string | null {
  const rest = pathname.replace(/^\/[^/]+/, "");
  const seg = rest.split("/")[1] ?? "";
  if (!APP_ROUTE_SEGMENTS.includes(seg)) return null;
  if (SHARED_WITH_LOCALE_TREE.has(seg) && rest.replace(/\/$/, "") !== `/${seg}`) return null;
  return rest.replace(/\/$/, "") || null;
}
