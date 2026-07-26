import type { Metadata } from "next";
import {
  BRAND_DESCRIPTION,
  BRAND_TITLE,
  LOCALES,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  OG_LOCALE,
  SITE_NAME,
  SITE_URL,
  abs,
  normalizeLocale,
  type SeoLocale,
} from "./constants";

export interface BuildMetadataInput {
  /** Route locale segment. Anything unknown degrades to DEFAULT_LOCALE. */
  locale: string;
  /** Path after the locale, leading slash, "" for the homepage. */
  path?: string;
  /** Page title WITHOUT the brand suffix — see brandTitle() below. */
  title?: string;
  description?: string;
  /** Site-relative or absolute. Defaults to the shared OG card. */
  ogImage?: string;
  /** og:type. Long-form guides are "article"; everything else is "website". */
  ogType?: "website" | "article";
  noIndex?: boolean;
}

/**
 * Compose the final <title>, guaranteeing the brand appears exactly once.
 *
 * A page passes its bare title ("Privacy Policy") and gets
 * "Privacy Policy | Echorank360". A title that already carries the brand
 * ("Echorank360 — AI Visibility Management Platform") is used verbatim, so we
 * never produce "… | Echorank360 | Echorank360".
 *
 * This is why buildMetadata always emits title.absolute: the root layout's
 * "%s | Echorank360" template would append a second brand on top of whatever
 * we return here.
 */
export function brandTitle(title: string | undefined, locale: SeoLocale): string {
  const raw = title?.trim();
  if (!raw) return BRAND_TITLE[locale];

  // Strip a trailing brand tail first. Pages historically embedded their own
  // suffix ("Privacy Policy | Echorank", "Reputation Risk Score. Echorank"),
  // which the layout template then doubled. Removing it here means a stale
  // caller can't reintroduce the bug.
  const stripped = raw.replace(/[\s|–—\-.,·]*echorank\s*(?:360)?\s*$/i, "").trim();
  const base = stripped || raw;

  // If the brand still appears (e.g. leading, as in the homepage title), the
  // title is already branded — use it as-is rather than appending again.
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  if (squash(base).includes(squash(SITE_NAME))) return base;

  return `${base} | ${SITE_NAME}`;
}

/** hreflang map: every locale plus x-default → English. */
function languagesFor(path: string): Record<string, string> {
  return Object.fromEntries([
    ...LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]),
    ["x-default", `${SITE_URL}/en${path}`],
  ]);
}

/**
 * The one way to produce page metadata. Do not hand-write Metadata objects or
 * <meta> tags in pages — see src/lib/seo/README.md.
 */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const locale = normalizeLocale(input.locale);
  const path = input.path ?? "";
  const url = `${SITE_URL}/${locale}${path}`;
  const title = brandTitle(input.title, locale);
  const description = input.description?.trim() || BRAND_DESCRIPTION[locale];
  const image = abs(input.ogImage ?? OG_IMAGE_PATH);

  return {
    // absolute → bypasses the root layout template, which would double the brand.
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: languagesFor(path),
    },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: input.ogType ?? "website",
      locale: OG_LOCALE[locale],
      images: [{ url: image, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
