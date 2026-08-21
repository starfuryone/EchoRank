// /blog/rss.xml — the feed. Latest 20 published EN articles, absolute URLs.
//
// NOT locale-prefixed, and it does not need to be: a feed reader has no locale
// chrome to render, and five feeds carrying the same English bodies would be
// four duplicates. If translated bodies ever justify a French feed it becomes
// /blog/rss.fr.xml, not a locale segment.
//
// NO PROXY ENTRY IS REQUIRED, and that is worth stating because every other
// public path in this app needs one. The proxy's matcher is
// "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)" — a path containing a
// DOT is excluded from the middleware outright, so this route never reaches the
// auth gate. The sibling at /api/public/attribution.js relies on the same rule.

import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo/constants";
import { BLOG_BASE, BLOG_AUTHOR } from "@/lib/blog/constants";
import { getAllArticles } from "@/lib/blog/loader";

/**
 * Rendered once at build time, not per request.
 *
 * Without this a route handler defaults to dynamic, which would mean the
 * production server reading content/blog/ off disk on every fetch of the feed.
 * The content only changes when a deploy changes it, so the build is the right
 * moment to render it — and it keeps the loader's filesystem access entirely
 * inside `next build`, which is what its header claims.
 */
export const dynamic = "force-static";

/** How many items the feed carries. A feed is the recent past, not an archive. */
const FEED_LIMIT = 20;

/**
 * Escape for XML text and attribute content.
 *
 * Titles and excerpts are authored prose that legitimately contains "&" and
 * quotes, and an unescaped ampersand makes the whole document unparseable — a
 * feed reader shows nothing at all rather than one broken item.
 */
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** "2026-08-05" -> RFC 822, which is what RSS 2.0 pubDate requires. */
function rfc822(iso: string): string {
  return new Date(`${iso}T09:00:00Z`).toUTCString();
}

export function GET() {
  // The EN set: the feed is one language, so it reads the English articles
  // directly rather than going through the fr fallback.
  const items = getAllArticles("en").slice(0, FEED_LIMIT);
  const self = `${SITE_URL}${BLOG_BASE}/rss.xml`;

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Echorank Blog</title>
    <link>${SITE_URL}/en${BLOG_BASE}</link>
    <description>Practical writing on GEO, AI search visibility and what to measure.</description>
    <language>en</language>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
${items
  .map((a) => {
    const url = `${SITE_URL}/en${BLOG_BASE}/${a.slug}`;
    return `    <item>
      <title>${xml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xml(a.excerpt)}</description>
      <category>${xml(a.category)}</category>
      <author>${xml(`${BLOG_AUTHOR.email} (${BLOG_AUTHOR.name})`)}</author>
      <pubDate>${rfc822(a.publishedAt)}</pubDate>
    </item>`;
  })
  .join("\n")}
  </channel>
</rss>
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Modest on purpose. Cloudflare's Purge Everything is part of every
      // deploy anyway, and a feed that caches for a day is a feed that
      // announces a new article a day late.
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    },
  });
}
