// Typed schema.org builders. Every node carries a stable @id so that nodes
// emitted on different pages merge into one entity graph rather than competing.
//
// Rule: no invented data. No aggregateRating, no reviewCount, no employee or
// funding figures — we have no verified source for any of them, and fabricated
// structured data is worse than absent structured data.

import {
  BRAND_DESCRIPTION,
  LEGAL_NAME,
  LOGO_PATH,
  PLANS,
  PRICE_CURRENCY,
  SITE_NAME,
  SITE_URL,
  abs,
  normalizeLocale,
  type SeoLocale,
} from "./constants";

export type JsonLdNode = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

export function organization(locale: string = "en"): JsonLdNode {
  const l = normalizeLocale(locale);
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    legalName: LEGAL_NAME,
    url: SITE_URL,
    logo: abs(LOGO_PATH),
    description: BRAND_DESCRIPTION[l],
    // No sameAs: the codebase holds no verified social profile URLs.
  };
}

export function webSite(locale: string = "en"): JsonLdNode {
  const l = normalizeLocale(locale);
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: BRAND_DESCRIPTION[l],
    inLanguage: l,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function softwareApplication(locale: string = "en"): JsonLdNode {
  const l = normalizeLocale(locale);
  return {
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID,
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/${l}`,
    description: BRAND_DESCRIPTION[l],
    publisher: { "@id": ORGANIZATION_ID },
    offers: PLANS.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.price,
      priceCurrency: PRICE_CURRENCY,
      category: "subscription",
    })),
    // Intentionally no aggregateRating — see file header.
  };
}

export interface FaqEntry {
  q: string;
  a: string;
}

/**
 * Build FAQPage markup. Callers must pass the SAME array the page renders
 * visibly — markup describing unrendered questions is a structured-data
 * violation and a manual-action risk.
 */
export function faqPage(questions: readonly FaqEntry[], pageUrl: string): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: questions.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export interface VideoObjectInput {
  name: string;
  description: string;
  /** Site-relative or absolute poster image. */
  thumbnailUrl: string;
  /** Site-relative or absolute video file URL. */
  contentUrl: string;
  /** ISO date (YYYY-MM-DD). Derive from the file's mtime — never invent. */
  uploadDate: string;
  /** Page the video is embedded on; used for a stable @id. */
  pageUrl: string;
  inLanguage?: string;
}

/** VideoObject with only verifiable fields — no duration, views or ratings,
 * because the codebase holds no reliable source for them. */
export function videoObject(input: VideoObjectInput): JsonLdNode {
  return {
    "@type": "VideoObject",
    "@id": `${input.pageUrl}#video`,
    name: input.name,
    description: input.description,
    thumbnailUrl: abs(input.thumbnailUrl),
    contentUrl: abs(input.contentUrl),
    uploadDate: input.uploadDate,
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export interface Crumb {
  name: string;
  url: string;
}

export function breadcrumbList(items: readonly Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** Convenience: the three nodes that belong on every marketing page. */
export function baseGraph(locale: string): JsonLdNode[] {
  return [organization(locale), webSite(locale)];
}

export type { SeoLocale };
