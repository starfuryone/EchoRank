// Inline markup for Knowledge Hub prose: **bold**, `code`, [label](href).
//
// This is NOT a markdown parser and must not grow into one. The content pack
// uses exactly these three inline constructs; block structure was resolved when
// the pack was converted into src/lib/learn-content.ts, so nothing here has to
// deal with nesting, emphasis, images or HTML.
//
// It returns React nodes rather than an HTML string on purpose: no
// dangerouslySetInnerHTML anywhere in this feature, so a stray "<" in authored
// copy is text, not markup.

import Link from "next/link";
import type { ReactNode } from "react";

/** Path prefixes that live under /[locale]. Anything else is used verbatim. */
const LOCALIZED_PREFIXES = [
  "/learn",
  "/resources",
  "/guide",
  "/ai-visibility",
  // Both are locale-prefixed marketing routes. A bare "/pricing" in prose still
  // resolves — the proxy 308s it to /en/pricing — but it costs a redirect hop
  // and silently drops a French reader into the English page.
  "/pricing",
  "/legal",
];

/**
 * "/help/<slug>" — the PUBLIC help articles, which are locale-prefixed.
 *
 * Deliberately a slash-terminated prefix rather than an entry in the list
 * above: "/help" with no slug is the auth-gated in-app hub at
 * src/app/(dashboard)/help, and rewriting that to "/en/help" would point every
 * in-product help link at a 404.
 */
const HELP_ARTICLE_PREFIX = "/help/";

/** Locale-prefix an in-app marketing path; leave external and app URLs alone. */
export function resolveHref(href: string, locale: string): string {
  if (!href.startsWith("/")) return href;
  const localized =
    href.startsWith(HELP_ARTICLE_PREFIX) ||
    LOCALIZED_PREFIXES.some(
      (p) => href === p || href.startsWith(`${p}/`) || href.startsWith(`${p}#`),
    );
  return localized ? `/${locale}${href}` : href;
}

// One alternation, so the tokens cannot overlap and the split stays lossless.
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/**
 * Render one authored string.
 *
 * `keyPrefix` disambiguates the fragment keys — two paragraphs may legitimately
 * contain the same bold word.
 */
export function inline(text: string, locale: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    const link = LINK.exec(part);
    if (link) {
      const [, label, rawHref] = link;
      const href = resolveHref(rawHref, locale);
      // Caddy-served pages and off-site URLs are plain anchors: <Link> would
      // prefetch a route that does not exist in this app's router.
      return href.startsWith("http") ? (
        <a key={key} href={href}>
          {label}
        </a>
      ) : (
        <Link key={key} href={href}>
          {label}
        </Link>
      );
    }

    return part;
  });
}

/**
 * The same string with its markup removed.
 *
 * Structured data and meta descriptions are plain text — emitting "**Bold**"
 * into a FAQPage answer publishes the asterisks to the search result.
 */
export function plainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
