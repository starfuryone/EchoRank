import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const SITE_URL = "https://echorank360.com";

// Locale-prefixed marketing routes. Each is emitted once per locale with a
// full set of hreflang alternates pointing at its four siblings plus
// x-default (English), matching the canonical/alternates the pages themselves
// declare in generateMetadata.
const LOCALIZED_ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1.0 },          // /{locale}
  { path: "/about", priority: 0.7 },
  { path: "/guide", priority: 0.7 },
  { path: "/guide-visibilite-ia", priority: 0.7 },
];

// Unlocalized routes (single URL, no alternates).
const PLAIN_ROUTES: { url: string; priority: number }[] = [
  { url: `${SITE_URL}/login`, priority: 0.7 },
  { url: `${SITE_URL}/register`, priority: 0.7 },
  // Static HTML served by Caddy, outside the Next app. One language, so no
  // alternates.
  { url: `${SITE_URL}/extension/howto-ai-visibility.html`, priority: 0.7 },
];

const languagesFor = (path: string): Record<string, string> =>
  Object.fromEntries([
    ...SUPPORTED_LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]),
    ["x-default", `${SITE_URL}/en${path}`],
  ]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const localized = LOCALIZED_ROUTES.flatMap(({ path, priority }) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority,
      alternates: { languages: languagesFor(path) },
    })),
  );

  const plain = PLAIN_ROUTES.map(({ url, priority }) => ({
    url,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority,
  }));

  return [...localized, ...plain];
}
