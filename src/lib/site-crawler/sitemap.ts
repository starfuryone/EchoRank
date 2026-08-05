// src/lib/site-crawler/sitemap.ts
//
// Sitemap discovery and parsing, for orphan detection and seeding.
//
// NORMALIZER PARITY IS LOAD-BEARING. Orphan detection is a set difference
// between "URLs in the sitemap" and "URLs we crawled", so both sides must be
// spelled identically. Every URL here goes through the SAME normalizeCrawlUrl()
// the frontier uses — not a similar one, the same one. A sitemap listing
// https://x.com/a/ against a frontier holding https://x.com/a would otherwise
// report every page on the site as an orphan.
//
// XML IS PARSED WITH A REGEX, DELIBERATELY. A sitemap's grammar is two tags
// deep and this repo has no XML parser; adding one for <loc> extraction would
// be a dependency to keep patched for no gain. The regex reads <loc> elements
// and nothing else, so malformed markup yields fewer URLs rather than a throw —
// which is the correct failure for a file we do not control.

import {
  CRAWLER_USER_AGENT,
  MAX_SITEMAP_BYTES,
  MAX_SITEMAP_FILES,
  MAX_SITEMAP_URLS,
  SITEMAP_TIMEOUT_MS,
} from "./constants";
import { isInScope, normalizeCrawlUrl } from "./url";
import type { RateLimiter } from "./fetch";

/** <loc>…</loc>, the only element either sitemap flavour needs. */
const LOC_RE = /<loc>\s*([^<]+?)\s*<\/loc>/gi;

/** A <sitemapindex> root means the <loc>s are sitemaps, not pages. */
const IS_INDEX_RE = /<sitemapindex[\s>]/i;

export interface SitemapResult {
  /** True when at least one sitemap file was fetched and parsed. */
  found: boolean;
  /** Normalized, in-scope, deduped page URLs. */
  urls: string[];
  /** Sitemap files actually fetched, for the summary. */
  filesFetched: number;
  /** True when a cap stopped us short of the whole sitemap. */
  truncated: boolean;
}

/** Decode the five XML entities that appear in a URL. */
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export interface ParsedSitemap {
  isIndex: boolean;
  locs: string[];
}

/**
 * Pull the <loc> values out of one sitemap document.
 *
 * Never throws. A truncated or malformed file simply yields whatever complete
 * <loc> elements it contained.
 */
export function parseSitemapXml(xml: string): ParsedSitemap {
  const isIndex = IS_INDEX_RE.test(xml);
  const locs: string[] = [];

  LOC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LOC_RE.exec(xml)) !== null) {
    const value = decodeXmlEntities(match[1]!.trim());
    if (value) locs.push(value);
  }

  return { isIndex, locs };
}

/** Fetch one sitemap file, bounded by time and size. Null on any failure. */
async function fetchSitemapFile(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": CRAWLER_USER_AGENT,
        accept: "application/xml,text/xml,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SITEMAP_BYTES) {
        await reader.cancel();
        // Parse what we have rather than discarding it: a 5 MB prefix of a
        // sitemap is still thousands of real URLs.
        break;
      }
      chunks.push(value);
    }

    const joined = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8").decode(joined);
  } catch {
    return null;
  }
}

export interface CollectSitemapArgs {
  rootUrl: string;
  /** Absolute URLs from robots.txt `Sitemap:` lines. May be empty. */
  declared: readonly string[];
  /** Shared with the crawl, so sitemap fetches obey the same 2 req/s. */
  limiter: Pick<RateLimiter, "acquire">;
  /** Injected in tests. Defaults to the real bounded fetch. */
  fetchFile?: (url: string) => Promise<string | null>;
}

/**
 * Collect every page URL the site advertises, following index files.
 *
 * Breadth-first over sitemap files with a hard file cap, so a site that indexes
 * a thousand sitemaps costs us ten fetches rather than a thousand. Falls back
 * to {origin}/sitemap.xml when robots.txt declared none — the conventional
 * location, and the one most sites use without advertising it.
 */
export async function collectSitemapUrls({
  rootUrl,
  declared,
  limiter,
  fetchFile = fetchSitemapFile,
}: CollectSitemapArgs): Promise<SitemapResult> {
  const queue: string[] = [];
  const queued = new Set<string>();

  const enqueue = (candidate: string) => {
    const normalized = normalizeCrawlUrl(candidate);
    if (!normalized || queued.has(normalized)) return;
    // A sitemap on someone else's domain describes someone else's site.
    if (!isInScope(normalized, rootUrl)) return;
    queued.add(normalized);
    queue.push(normalized);
  };

  for (const entry of declared) enqueue(entry);
  if (queue.length === 0) {
    try {
      enqueue(new URL("/sitemap.xml", rootUrl).toString());
    } catch {
      /* an unparseable root cannot have a sitemap either */
    }
  }

  const urls = new Set<string>();
  let filesFetched = 0;
  let found = false;
  let truncated = false;

  while (queue.length > 0) {
    if (filesFetched >= MAX_SITEMAP_FILES) {
      truncated = true;
      break;
    }
    if (urls.size >= MAX_SITEMAP_URLS) {
      truncated = true;
      break;
    }

    const fileUrl = queue.shift()!;
    await limiter.acquire();
    const xml = await fetchFile(fileUrl);
    filesFetched += 1;
    if (!xml) continue;

    found = true;
    const { isIndex, locs } = parseSitemapXml(xml);

    for (const loc of locs) {
      if (isIndex) {
        enqueue(loc);
        continue;
      }
      if (urls.size >= MAX_SITEMAP_URLS) {
        truncated = true;
        break;
      }
      const normalized = normalizeCrawlUrl(loc);
      // Same normalizer as the frontier — see the header note.
      if (normalized && isInScope(normalized, rootUrl)) urls.add(normalized);
    }
  }

  if (queue.length > 0) truncated = true;

  return { found, urls: [...urls], filesFetched, truncated };
}
