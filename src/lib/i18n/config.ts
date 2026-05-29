// ---------------------------------------------------------------------------
// Locale + currency resolution (geo-targeting)
// ---------------------------------------------------------------------------
// Self-contained i18n: no next-intl dependency. The marketing homepage is the
// only localized surface, so a typed message catalog (see content.ts) plus the
// resolver below is sufficient and avoids wiring a framework into this
// customized Next 16.

export const SUPPORTED_LOCALES = [
  "en",
  "en-CA",
  "fr",
  "fr-CA",
  "de-CH",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "CHF";

export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_CURRENCY: Currency = "USD";

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Natural currency for a locale when geo doesn't override it. */
export function defaultCurrencyForLocale(locale: Locale): Currency {
  switch (locale) {
    case "en-CA":
    case "fr-CA":
      return "CAD";
    case "fr":
      return "EUR";
    case "de-CH":
      return "CHF";
    case "en":
    default:
      return "USD";
  }
}

// Countries routed to French/EUR.
const FR_COUNTRIES = new Set([
  "FR",
  "BE",
  "MC",
  "LU", // Western Europe
  "MA",
  "DZ",
  "TN", // Maghreb
  "SN",
  "CI",
  "CM",
  "CD",
  "CG",
  "ML",
  "BF", // Francophone Africa
]);

// Swiss cantons that default to French (Romandie).
const CH_FR_CANTONS = new Set(["GE", "VD", "NE", "JU", "FR", "VS"]);

export interface ResolvedTarget {
  locale: Locale;
  currency: Currency;
}

/**
 * Resolve locale + currency from Cloudflare geo signals and Accept-Language.
 * Mirrors the routing matrix in the reproduction spec.
 */
export function resolveTarget(
  country: string | null | undefined,
  region: string | null | undefined,
  acceptLang: string | null | undefined,
): ResolvedTarget {
  const prefersFr = acceptLang?.toLowerCase().includes("fr") ?? false;

  if (country === "CH") {
    const locale: Locale =
      CH_FR_CANTONS.has(region ?? "") || prefersFr ? "fr" : "de-CH";
    return { locale, currency: "CHF" };
  }

  if (country === "CA" && region === "QC" && prefersFr) {
    return { locale: "fr-CA", currency: "CAD" };
  }

  if (country === "CA") {
    return { locale: "en-CA", currency: "CAD" };
  }

  if (FR_COUNTRIES.has(country ?? "")) {
    return { locale: "fr", currency: "EUR" };
  }

  if (country === "GB") {
    return { locale: "en", currency: "GBP" };
  }

  return { locale: DEFAULT_LOCALE, currency: DEFAULT_CURRENCY };
}
