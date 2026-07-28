// src/lib/serp/options.ts
//
// The location/language choices the SERP Checker form offers. Kept small and
// typed so the i18n catalogs can be checked for completeness against them
// (same trick as SeoToolId in src/lib/seo-tools.ts): adding a code here
// without a label in all three DashLocale catalogs is a type error.
//
// Codes are DataForSEO location_code / language_code values. The API accepts
// any valid code — this list only bounds what the UI offers.

export const SERP_LOCATION_CODES = [
  2124, // Canada — the default, matching /api/seo/v1/keywords/overview
  2840, // United States
  2826, // United Kingdom
  2250, // France
  2276, // Germany
  2756, // Switzerland
  2036, // Australia
] as const;

export type SerpLocationCode = (typeof SERP_LOCATION_CODES)[number];

export const SERP_LANGUAGE_CODES = ["en", "fr", "de", "es"] as const;

export type SerpLanguageCode = (typeof SERP_LANGUAGE_CODES)[number];

// ─── Request defaults ────────────────────────────────────────────────────────
// Kept in this module (and not in service.ts) so DB-less config tests can
// import them without pulling in the Prisma client.

/** Canada — same default as the keywords/overview route. */
export const DEFAULT_LOCATION_CODE = 2124;
export const DEFAULT_LANGUAGE_CODE = "en";
export const DEFAULT_DEVICE = "desktop" as const;

/** Repeat identical checks inside this window are served from the last one. */
export const SERP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
