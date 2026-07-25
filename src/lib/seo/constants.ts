// Single source of truth for every SEO-facing constant.
//
// Nothing here may be duplicated in a page file. If a page needs a title, a
// description or an OG image, it goes through buildMetadata() — see README.md.

export const SITE_URL = "https://echorank360.com";
export const SITE_NAME = "Echorank360";
export const LEGAL_NAME = "ChatLogic Insights Ltd";

export const LOCALES = ["en", "en-CA", "fr", "fr-CA", "de-CH"] as const;
export type SeoLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: SeoLocale = "en";

export function isSeoLocale(value: unknown): value is SeoLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Coerce anything to a known locale. Unknown input degrades to English. */
export function normalizeLocale(value: unknown): SeoLocale {
  return isSeoLocale(value) ? value : DEFAULT_LOCALE;
}

// Open Graph wants language_TERRITORY, not the BCP-47 tag we route on.
export const OG_LOCALE: Record<SeoLocale, string> = {
  en: "en_US",
  "en-CA": "en_CA",
  fr: "fr_FR",
  "fr-CA": "fr_CA",
  "de-CH": "de_CH",
};

export const OG_IMAGE_PATH = "/og-home.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const LOGO_PATH = "/echorank-logo.svg";

/** Absolute URL for any site-relative path. */
export const abs = (path: string): string =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

// Brand-level descriptions: the AI-visibility positioning, localized. These are
// the fallback description for any page that doesn't supply its own, and the
// description used in Organization / WebSite structured data.
//
// Deliberately NOT the retired "Collect customer feedback, generate more
// authentic reviews..." reputation copy.
export const BRAND_DESCRIPTION: Record<SeoLocale, string> = {
  en: "When customers ask ChatGPT, Google AI or Perplexity who to hire, is your business the answer? Measure your AI Visibility Score, track recommendations daily, and get a prioritized roadmap to become the business AI recommends.",
  "en-CA":
    "When customers ask ChatGPT, Google AI or Perplexity who to hire, is your business the answer? Measure your AI Visibility Score, track recommendations daily, and get a prioritized roadmap to become the business AI recommends.",
  fr: "Quand vos clients demandent à ChatGPT, Google AI ou Perplexity qui embaucher, votre entreprise est-elle la réponse? Mesurez votre score de visibilité IA, suivez les recommandations chaque jour et obtenez une feuille de route priorisée pour devenir l'entreprise que l'IA recommande.",
  "fr-CA":
    "Quand vos clients demandent à ChatGPT, Google AI ou Perplexity qui embaucher, votre entreprise est-elle la réponse? Mesurez votre score de visibilité IA, suivez les recommandations chaque jour et obtenez une feuille de route priorisée pour devenir l'entreprise que l'IA recommande.",
  "de-CH":
    "Wenn Kundinnen und Kunden ChatGPT, Google AI oder Perplexity fragen, wen sie beauftragen sollen — ist Ihr Unternehmen die Antwort? Messen Sie Ihren KI-Sichtbarkeits-Score, verfolgen Sie Empfehlungen täglich und erhalten Sie einen priorisierten Fahrplan, um das Unternehmen zu werden, das die KI empfiehlt.",
};

/** Brand-level title per locale (used by the homepage and as a last resort). */
export const BRAND_TITLE: Record<SeoLocale, string> = {
  en: "Echorank360 — AI Visibility Management Platform",
  "en-CA": "Echorank360 — AI Visibility Management Platform",
  fr: "Echorank360 — Plateforme de visibilité IA",
  "fr-CA": "Echorank360 — Plateforme de visibilité IA",
  "de-CH": "Echorank360 — Plattform für KI-Sichtbarkeit",
};

// Subscription plans, USD list price. Mirrors the pricing section on the
// homepage; used to build SoftwareApplication offers.
export const PLANS: { name: string; price: string }[] = [
  { name: "Starter", price: "49" },
  { name: "Growth", price: "149" },
  { name: "Agency", price: "349" },
  { name: "Enterprise", price: "999" },
];
export const PRICE_CURRENCY = "USD";
