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
  // Goal-led entry page; every card links to a route already in this list.
  { path: "/use-cases", priority: 0.8, changeFrequency: "monthly" },
  { path: "/ai-visibility", priority: 0.8, changeFrequency: "weekly" },
  { path: "/demo", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guide", priority: 0.7, changeFrequency: "monthly" },
  { path: "/resources", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/guides/getting-started", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guides/audit-your-website", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guides/keyword-research", priority: 0.6, changeFrequency: "monthly" },
  { path: "/guides/track-rankings", priority: 0.6, changeFrequency: "monthly" },
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

/** Every locale-prefixed path that exists, used by the proxy locale guard. */
export const KNOWN_MARKETING_PATHS: readonly string[] = LOCALIZED_ROUTES.map((r) => r.path).filter(
  (p) => p !== "",
);

export function languagesFor(path: string): Record<string, string> {
  return Object.fromEntries([
    ...LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]),
    ["x-default", `${SITE_URL}/en${path}`],
  ]);
}
