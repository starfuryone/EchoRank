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

/**
 * Whole seconds as an ISO 8601 duration: 248 -> "PT4M8S".
 *
 * Zero-valued components are omitted rather than padded, because "PT0H4M8S" is
 * legal but reads as though an hours figure were measured. A duration of zero
 * is "PT0S" and not the empty "PT", which is invalid.
 */
export function isoDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const parts = [
    hours ? `${hours}H` : "",
    minutes ? `${minutes}M` : "",
    seconds ? `${seconds}S` : "",
  ].join("");

  return parts ? `PT${parts}` : "PT0S";
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
  /**
   * Whole seconds, MEASURED from the file. Omitted when unknown: a guessed
   * runtime is exactly the kind of fabricated field this module refuses.
   */
  durationSeconds?: number;
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
    ...(input.durationSeconds ? { duration: isoDuration(input.durationSeconds) } : {}),
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export interface ArticleInput {
  headline: string;
  description: string;
  /** Absolute URL of the page this node describes. */
  pageUrl: string;
  /** Minutes. Emitted as ISO 8601 duration — a real number from frontmatter. */
  readingTime?: number;
  inLanguage?: string;
}

/**
 * Article node for a knowledge-base page.
 *
 * NO datePublished / dateModified. Google likes both, and we have no verifiable
 * source for either: a file mtime is when the box last touched the file, not
 * when the piece was written, and a build timestamp would re-date every article
 * on every deploy. Per this file's header rule, absent beats invented.
 */
export function article(input: ArticleInput): JsonLdNode {
  return {
    "@type": "Article",
    "@id": `${input.pageUrl}#article`,
    headline: input.headline,
    description: input.description,
    url: input.pageUrl,
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    ...(input.readingTime ? { timeRequired: `PT${input.readingTime}M` } : {}),
    isPartOf: { "@id": WEBSITE_ID },
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export interface BlogPostingInput {
  headline: string;
  description: string;
  /** Absolute URL of the article. */
  pageUrl: string;
  /** Absolute or site-relative hero. */
  image: string;
  /** YYYY-MM-DD, from frontmatter. */
  datePublished: string;
  /** YYYY-MM-DD. Omitted when it is not later than datePublished. */
  dateModified?: string;
  authorName: string;
  inLanguage?: string;
  /** Whole minutes, COMPUTED from the body — see readingTime(). */
  readingTime?: number;
  keywords?: readonly string[];
  articleSection?: string;
}

/**
 * BlogPosting for a public blog article.
 *
 * UNLIKE article() above, this one DOES carry datePublished and dateModified,
 * and that is not a relaxation of this file's no-invented-data rule. A Knowledge
 * Hub page has no authored date anywhere — only a file mtime, which is when the
 * box last touched it — whereas a blog article's frontmatter carries a date a
 * human wrote and the page renders visibly. The rule is that structured data
 * must not state what we cannot source; here we can.
 *
 * dateModified is emitted only when the caller passes one, and the caller is
 * expected to pass it only when it is genuinely later than publication
 * (showsUpdated() in src/lib/blog/constants.ts). Re-dating an untouched article
 * is the same fabrication in a slower form.
 *
 * The author is a Person, not the Organization: a blog with a byline the page
 * shows should say the same thing in its markup.
 */
export function blogPosting(input: BlogPostingInput): JsonLdNode {
  return {
    "@type": "BlogPosting",
    "@id": `${input.pageUrl}#article`,
    headline: input.headline,
    description: input.description,
    url: input.pageUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": input.pageUrl },
    image: abs(input.image),
    datePublished: input.datePublished,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    author: { "@type": "Person", name: input.authorName },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    ...(input.readingTime ? { timeRequired: `PT${input.readingTime}M` } : {}),
    ...(input.keywords?.length ? { keywords: [...input.keywords] } : {}),
    ...(input.articleSection ? { articleSection: input.articleSection } : {}),
  };
}

export interface CoursePart {
  headline: string;
  description: string;
  pageUrl: string;
}

export interface CourseInput {
  name: string;
  description: string;
  /** Absolute URL of the hub page. */
  pageUrl: string;
  parts: readonly CoursePart[];
  inLanguage?: string;
}

/**
 * Course node with one hasPart per chapter.
 *
 * The parts carry the SAME @id the chapter pages emit for their own Article
 * node, so a crawler reading both merges them into one entity instead of two
 * competing descriptions of the same URL.
 *
 * Callers must build `parts` from the chapter config, never from a second list:
 * a hand-kept copy is exactly how the Jul 31 stale-prices incident happened.
 */
export function course(input: CourseInput): JsonLdNode {
  return {
    "@type": "Course",
    "@id": `${input.pageUrl}#course`,
    name: input.name,
    description: input.description,
    url: input.pageUrl,
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    provider: { "@id": ORGANIZATION_ID },
    hasPart: input.parts.map((p) => ({
      "@type": "Article",
      "@id": `${p.pageUrl}#article`,
      headline: p.headline,
      description: p.description,
      url: p.pageUrl,
    })),
  };
}

export interface DefinedTermInput {
  name: string;
  description: string;
  /** Fragment id of the term's anchor on the glossary page. */
  anchor: string;
}

export interface DefinedTermSetInput {
  name: string;
  description: string;
  pageUrl: string;
  terms: readonly DefinedTermInput[];
  inLanguage?: string;
}

/** Glossary. One DefinedTerm per anchor the page actually renders. */
export function definedTermSet(input: DefinedTermSetInput): JsonLdNode {
  const setId = `${input.pageUrl}#glossary`;
  return {
    "@type": "DefinedTermSet",
    "@id": setId,
    name: input.name,
    description: input.description,
    url: input.pageUrl,
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    publisher: { "@id": ORGANIZATION_ID },
    hasDefinedTerm: input.terms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${input.pageUrl}#${t.anchor}`,
      name: t.name,
      description: t.description,
      inDefinedTermSet: { "@id": setId },
    })),
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
