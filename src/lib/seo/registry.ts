// The sitemap registry. A new public page registers here ONCE and appears in
// sitemap.xml with correct hreflang alternates. Nothing else needs editing.
//
// See README.md.

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
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/ai-visibility", priority: 0.8, changeFrequency: "weekly" },
  { path: "/guide", priority: 0.7, changeFrequency: "monthly" },
  { path: "/guide-visibilite-ia", priority: 0.7, changeFrequency: "monthly" },
  { path: "/how-to", priority: 0.6, changeFrequency: "monthly" },
  { path: "/live-monitoring", priority: 0.6, changeFrequency: "monthly" },
  { path: "/act-on-signals", priority: 0.6, changeFrequency: "monthly" },
  { path: "/customer-feedback", priority: 0.6, changeFrequency: "monthly" },
  { path: "/reputation-engine", priority: 0.6, changeFrequency: "monthly" },
  { path: "/reputation-risk", priority: 0.6, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/disclaimer", priority: 0.3, changeFrequency: "yearly" },
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
