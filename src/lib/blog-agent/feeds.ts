// src/lib/blog-agent/feeds.ts
//
// Turning the sources into a flat list of candidate items.
//
// RSS AND ATOM ARE BOTH HANDLED, because the five live feeds are not all the
// same shape: Search Engine Land and SEJ are RSS 2.0 (<item><pubDate>), Google
// Search Central is Atom (<entry><published><link href=…>). Parsing only one of
// them means silently dropping the most authoritative source in the set.
//
// cheerio in xmlMode does the parsing. It is already a dependency (the site
// crawler uses it), so this costs nothing — the brief's "prefer something
// already in the tree" resolved cleanly.

import * as cheerio from "cheerio";
import { guardedFetch, MAX_FEED_BYTES } from "./fetch";
import { ACTIVE_SOURCES, allowedFeedOrigins, type BlogSource } from "./sources";
import { logger } from "@/infrastructure/observability/logger";

/** One candidate story, whatever source it came from. */
export interface FeedItem {
  title: string;
  url: string;
  /** Source id from the config, for weighting and attribution. */
  sourceId: string;
  sourceName: string;
  /** ISO instant, or null when the feed omits a usable date. */
  publishedAt: string | null;
  summary: string;
}

const HN_ORIGIN = "https://hn.algolia.com";

/**
 * Most recent items kept per source.
 *
 * OpenAI publishes its ENTIRE news history in one feed — 1,143 items on the
 * live run of 2026-08-21, against ten from every other publication. Keeping all
 * of them costs memory and buys nothing: the recency gate discards anything
 * older than a week anyway, so this is the same filter applied before the
 * allocation rather than after it.
 */
const MAX_ITEMS_PER_SOURCE = 40;

/**
 * Newest first, capped. An item with NO date sorts last rather than being
 * dropped — some feeds omit dates, and recencyFactor already handles that case
 * on its own terms.
 */
function newestFirst(items: FeedItem[]): FeedItem[] {
  return [...items]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, MAX_ITEMS_PER_SOURCE);
}

/** Collapse whitespace and strip tags a summary may carry. */
function clean(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** A date we can compare, or null. Never `new Date()` as a fallback — a missing
 *  date must not read as "published this instant" and win the recency score. */
function isoOrNull(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Parse an RSS 2.0 or Atom document into items.
 *
 * Exported and pure so the suite can feed it fixtures of both shapes without a
 * network call — which is the only way to test that the Atom branch works,
 * given the live feeds change hourly.
 */
export function parseFeed(xml: string, source: { id: string; name: string }): FeedItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: FeedItem[] = [];

  // RSS 2.0
  $("item").each((_, el) => {
    const node = $(el);
    const title = clean(node.find("title").first().text());
    const url = clean(node.find("link").first().text());
    if (!title || !url) return;
    items.push({
      title,
      url,
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: isoOrNull(node.find("pubDate").first().text() || node.find("date").first().text()),
      summary: clean(node.find("description").first().text()).slice(0, 600),
    });
  });

  // Atom — the link is an ATTRIBUTE, not text, which is the difference that
  // makes a naive RSS-only parser return entries with an empty url.
  $("entry").each((_, el) => {
    const node = $(el);
    const title = clean(node.find("title").first().text());
    const link =
      node.find('link[rel="alternate"]').first().attr("href") ??
      node.find("link").first().attr("href") ??
      "";
    if (!title || !link) return;
    items.push({
      title,
      url: clean(link),
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: isoOrNull(
        node.find("published").first().text() || node.find("updated").first().text(),
      ),
      summary: clean(
        node.find("summary").first().text() || node.find("content").first().text(),
      ).slice(0, 600),
    });
  });

  return items;
}

interface HnHit {
  title?: string;
  url?: string | null;
  story_text?: string | null;
  created_at?: string;
  points?: number;
  objectID?: string;
}

/**
 * Hacker News via the Algolia search API.
 *
 * `search_by_date` rather than relevance: this is a daily news pipeline, and a
 * three-year-old thread that ranks well for "AI search" is not today's story.
 * A hit with no url is an Ask HN / text post — kept, pointed at the discussion,
 * because the comments are frequently the substance.
 */
export function parseHn(json: string, source: { id: string; name: string }): FeedItem[] {
  let payload: { hits?: HnHit[] };
  try {
    payload = JSON.parse(json) as { hits?: HnHit[] };
  } catch {
    return [];
  }
  return (payload.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      title: clean(h.title!),
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID ?? ""}`,
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: isoOrNull(h.created_at),
      summary: clean(h.story_text ?? "").slice(0, 600),
    }))
    .filter((i) => i.url && !i.url.endsWith("item?id="));
}

/** Fetch one source. A dead source yields [] and a log line, never a throw. */
export async function fetchSource(source: BlogSource): Promise<FeedItem[]> {
  const origins = allowedFeedOrigins();

  if (source.kind === "hn") {
    const url = `${HN_ORIGIN}/api/v1/search_by_date?query=${encodeURIComponent(
      source.query,
    )}&tags=story&hitsPerPage=20`;
    const res = await guardedFetch(url, {
      allowedOrigins: origins,
      accept: "application/json",
      maxBytes: MAX_FEED_BYTES,
    });
    if (!res.ok || !res.body) {
      logger.warn({ source: source.id, reason: res.reason, status: res.status }, "blog-agent: source failed");
      return [];
    }
    return newestFirst(parseHn(res.body, source));
  }

  const res = await guardedFetch(source.url, {
    allowedOrigins: origins,
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    // A feed index is not a page — several of these inline full article bodies.
    maxBytes: MAX_FEED_BYTES,
  });
  if (!res.ok || !res.body) {
    logger.warn({ source: source.id, reason: res.reason, status: res.status }, "blog-agent: source failed");
    return [];
  }
  return newestFirst(parseFeed(res.body, source));
}

/**
 * Every source, in parallel, with failures dropped.
 *
 * Promise.allSettled rather than Promise.all: one publication having a bad
 * morning must not take the whole discover run with it. That is the difference
 * between "three drafts from four sources" and "no drafts today".
 */
export async function fetchAllSources(
  sources: readonly BlogSource[] = ACTIVE_SOURCES,
): Promise<FeedItem[]> {
  const settled = await Promise.allSettled(sources.map((s) => fetchSource(s)));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
