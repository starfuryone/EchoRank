// The sitemap registry. A new public page registers here ONCE and appears in
// sitemap.xml with correct hreflang alternates. Nothing else needs editing.
//
// See README.md.

import { learnRoutes } from "@/lib/learn-content";
import { freeToolRoutes } from "@/lib/free-tools";
import { solutionRoutes } from "@/lib/solutions-taxonomy";
import { LOCALES, SITE_URL } from "./constants";

export interface LocalizedRoute {
  /** Path after the locale segment, leading slash. "" is the homepage. */
  path: string;
  priority: number;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
}

export interface PlainRoute {
  /** Absolute URL. Used for routes that are not locale-prefixed. */
  url: string;
  priority: number;
  changeFrequency: LocalizedRoute["changeFrequency"];
}

/** Locale-prefixed marketing routes — emitted once per locale, with alternates. */
export const LOCALIZED_ROUTES: LocalizedRoute[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  // Every marketing CTA on the site routes here, so it is the second most
  // important page after the homepage.
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  // The anonymous audit funnel. Every "run the free audit" CTA on the site
  // lands here — nav promo, homepage hero, learn chapters, solutions pages —
  // so it ranks with /pricing rather than with the content pages below.
  { path: "/free-audit", priority: 0.9, changeFrequency: "monthly" },
  // Goal-led entry page; every card links to a route already in this list.
  // The standalone Watcher's own page. Ranks with /pricing rather than the
  // content pages: it is a second purchase path, not an article.
  { path: "/watcher", priority: 0.9, changeFrequency: "monthly" },
  // Prepaid prospect lookups. A third purchase path, alongside /pricing and
  // /watcher, and ranked just below them: it converts an existing Agency
  // customer rather than acquiring one, so it earns less crawl attention than
  // the pages that sell the plan itself.
  { path: "/credits", priority: 0.7, changeFrequency: "monthly" },
  { path: "/use-cases", priority: 0.8, changeFrequency: "monthly" },
  { path: "/technical-geo", priority: 0.6, changeFrequency: "monthly" },
  { path: "/glossary", priority: 0.5, changeFrequency: "monthly" },
  { path: "/methodology", priority: 0.5, changeFrequency: "monthly" },
  { path: "/keyword-research", priority: 0.6, changeFrequency: "monthly" },
  { path: "/link-building-playbook", priority: 0.6, changeFrequency: "monthly" },
  { path: "/ai-discovery-optimization", priority: 0.6, changeFrequency: "monthly" },
  // The public reputation-tools landing. Ranks above the guide pages: the
  // homepage's "classic reputation stack" section links straight here, so it
  // is a product page in the funnel rather than an article.
  { path: "/reputation-tools", priority: 0.7, changeFrequency: "monthly" },
  { path: "/ai-visibility", priority: 0.8, changeFrequency: "weekly" },
  // The public AI Assistant. An acquisition surface rather than an article: a
  // visitor arrives with a question, gets a real answer and a scan of their own
  // site, so it ranks with /free-audit rather than with the content pages.
  { path: "/ai-assistant", priority: 0.9, changeFrequency: "weekly" },
  { path: "/demo", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guide", priority: 0.7, changeFrequency: "monthly" },
  { path: "/resources", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/guides/getting-started", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guides/audit-your-website", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guides/keyword-research", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guides/track-rankings", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guides/ai-visibility", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guide-visibilite-ia", priority: 0.7, changeFrequency: "monthly" },
  { path: "/how-to", priority: 0.6, changeFrequency: "monthly" },
  { path: "/live-monitoring", priority: 0.6, changeFrequency: "monthly" },
  { path: "/act-on-signals", priority: 0.6, changeFrequency: "monthly" },
  { path: "/customer-feedback", priority: 0.6, changeFrequency: "monthly" },
  { path: "/reputation-engine", priority: 0.6, changeFrequency: "monthly" },
  { path: "/reputation-risk", priority: 0.6, changeFrequency: "monthly" },
  { path: "/legal/subscription-agreement", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookies", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/no-financial-advice", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/disclaimer", priority: 0.3, changeFrequency: "yearly" },
  // The Knowledge Hub — DERIVED, not listed. Seventeen paths (hub, ten
  // chapters, five guides, Echopedia) come straight from learn-content.ts, so
  // adding a chapter to the config puts it in the sitemap and nowhere else has
  // to be touched. A hand-kept copy here would drift the moment one did.
  ...learnRoutes().map((path) => ({
    path,
    priority: path === "/learn" ? 0.8 : 0.6,
    changeFrequency: "monthly" as const,
  })),
  // Solutions taxonomy — DERIVED from src/lib/solutions-taxonomy.ts: four
  // category indexes plus 25 item pages, registered by adding to that config.
  ...solutionRoutes().map((path) => ({
    path,
    priority: path.split("/").length === 3 ? 0.7 : 0.6,
    changeFrequency: "monthly" as const,
  })),
  // Free tools — DERIVED from src/lib/free-tools.ts, same as the Knowledge Hub
  // above. Adding a tool to that config puts it in the sitemap and nowhere
  // else has to be edited.
  ...freeToolRoutes().map((path) => ({
    path,
    priority: path === "/free-tools" ? 0.8 : 0.7,
    changeFrequency: "weekly" as const,
  })),
];

/** Single-URL routes with no locale variants. */
export const PLAIN_ROUTES: PlainRoute[] = [
  { url: `${SITE_URL}/login`, priority: 0.5, changeFrequency: "yearly" },
  { url: `${SITE_URL}/register`, priority: 0.7, changeFrequency: "monthly" },
  // Static HTML served by Caddy, outside the Next app. One language only.
  {
    url: `${SITE_URL}/extension/howto-ai-visibility.html`,
    priority: 0.7,
    changeFrequency: "monthly",
  },
];

/**
 * Retired paths that must keep canonicalizing but must NOT be advertised.
 *
 * A removed page whose route still answers with a 301 needs to stay in the
 * proxy's locale guard: without it, the locale-less "/free-tools/reddit-threads"
 * falls through to the auth gate and 307s to /login instead of reaching the
 * redirect. It stays out of LOCALIZED_ROUTES so the sitemap stops listing it.
 */
export const RETIRED_LOCALIZED_PATHS: readonly string[] = [
  // Both removed 2026-08-16, both 301 → /{locale}/free-tools.
  "/free-tools/reddit-threads",
  "/free-tools/ai-search-grader",
];

/** Every locale-prefixed path that exists, used by the proxy locale guard. */
export const KNOWN_MARKETING_PATHS: readonly string[] = [
  ...LOCALIZED_ROUTES.map((r) => r.path).filter((p) => p !== ""),
  ...RETIRED_LOCALIZED_PATHS,
];

export function languagesFor(path: string): Record<string, string> {
  return Object.fromEntries([
    ...LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]),
    ["x-default", `${SITE_URL}/en${path}`],
  ]);
}
