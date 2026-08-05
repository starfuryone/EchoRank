// src/lib/site-crawler/checks.ts
//
// Parse one HTML page into the fields we keep, then derive its issues.
//
// THE BODY IS NEVER RETURNED. parsePage() takes HTML and hands back extracted
// fields plus a SHA-256 of the normalized main content; the caller discards the
// string. contentHash exists so duplicate detection works without storing the
// text that would let anyone reconstruct the page from our database.
//
// Both functions are pure — no network, no database, no clock — which is what
// makes the rule-per-fixture tests in tests/site-crawler-checks.test.ts cheap
// enough to write one per rule.

import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import {
  META_DESC_MAX_LENGTH,
  THIN_CONTENT_WORDS,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from "./constants";
import { isInScope, looksLikeNonHtml, normalizeCrawlUrl } from "./url";

/** The closed set of findings. Asserted in tests so a typo cannot ship. */
export const ISSUE_TYPES = [
  "HTTP_4XX",
  "HTTP_5XX",
  "TITLE_MISSING",
  "H1_MISSING",
  "NOINDEX",
  "TITLE_TOO_LONG",
  "TITLE_TOO_SHORT",
  "META_DESC_MISSING",
  "META_DESC_TOO_LONG",
  "MULTIPLE_H1",
  "CANONICAL_MISMATCH",
  "REDIRECT_CHAIN",
  "THIN_CONTENT",
  "BLOCKED_BY_ROBOTS",
  "CANONICAL_MISSING",
  "DUPLICATE_CONTENT",
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type Severity = "ERROR" | "WARNING" | "NOTICE";

export const ISSUE_SEVERITY: Record<IssueType, Severity> = {
  HTTP_4XX: "ERROR",
  HTTP_5XX: "ERROR",
  TITLE_MISSING: "ERROR",
  H1_MISSING: "ERROR",
  NOINDEX: "ERROR",
  TITLE_TOO_LONG: "WARNING",
  TITLE_TOO_SHORT: "WARNING",
  META_DESC_MISSING: "WARNING",
  META_DESC_TOO_LONG: "WARNING",
  MULTIPLE_H1: "WARNING",
  CANONICAL_MISMATCH: "WARNING",
  REDIRECT_CHAIN: "WARNING",
  THIN_CONTENT: "WARNING",
  BLOCKED_BY_ROBOTS: "NOTICE",
  CANONICAL_MISSING: "NOTICE",
  DUPLICATE_CONTENT: "NOTICE",
};

export interface ParsedPage {
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescLength: number | null;
  h1Count: number;
  canonical: string | null;
  metaRobots: string | null;
  wordCount: number;
  contentHash: string;
  /** In-scope, fetchable links found on the page, normalized and deduped. */
  links: string[];
  /** Count of in-scope links, including nofollow ones. */
  internalLinks: number;
  /** In-scope links marked rel=nofollow: recorded, never enqueued. */
  nofollowLinks: string[];
}

/**
 * Extract the fields we keep from one HTML document.
 *
 * `pageUrl` is the FINAL url after redirects — links resolve against it, and so
 * does the canonical comparison, because a canonical pointing at the
 * pre-redirect URL is a real finding.
 */
export function parsePage(html: string, pageUrl: string, rootUrl: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = firstNonEmpty($("head > title").first().text(), $("title").first().text());
  const metaDescription = attrOf($, 'meta[name="description" i]', "content");
  const canonicalRaw = attrOf($, 'link[rel="canonical" i]', "href");
  const metaRobots = attrOf($, 'meta[name="robots" i]', "content");

  const canonical = canonicalRaw
    ? (normalizeCrawlUrl(canonicalRaw, pageUrl) ?? canonicalRaw.trim())
    : null;

  const h1Count = $("h1").length;

  // Strip what is not prose before counting or hashing: script/style text is
  // not content, and counting it would hide thin pages behind their bundles.
  const $content = cheerio.load(html);
  $content("script, style, noscript, template, svg").remove();
  const text = normalizeWhitespace($content("body").text() || $content.root().text());
  const wordCount = text ? text.split(" ").filter(Boolean).length : 0;
  const contentHash = createHash("sha256").update(text).digest("hex");

  const seen = new Set<string>();
  const links: string[] = [];
  const nofollowLinks: string[] = [];
  let internalLinks = 0;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const normalized = normalizeCrawlUrl(href, pageUrl);
    if (!normalized) return;
    if (!isInScope(normalized, rootUrl)) return;

    internalLinks += 1;
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    if (rel.split(/\s+/).includes("nofollow")) {
      nofollowLinks.push(normalized);
      return;
    }
    // Obvious non-HTML by extension is skipped before it costs a request.
    if (looksLikeNonHtml(new URL(normalized).pathname)) return;
    links.push(normalized);
  });

  return {
    title: title || null,
    titleLength: title ? title.length : null,
    metaDescription: metaDescription || null,
    metaDescLength: metaDescription ? metaDescription.length : null,
    h1Count,
    canonical,
    metaRobots: metaRobots || null,
    wordCount,
    contentHash,
    links,
    internalLinks,
    nofollowLinks,
  };
}

export interface IssueInput {
  statusCode: number | null;
  /** Null when the response was not HTML or the fetch failed. */
  parsed: ParsedPage | null;
  finalUrl: string;
  redirectHops: number;
  xRobotsTag: string | null;
  isHtml: boolean;
  /** True when robots.txt disallowed this URL and it was never fetched. */
  blockedByRobots?: boolean;
  /** True when another 200 page in this crawl already had this contentHash. */
  duplicateOf?: string | null;
}

export interface DetectedIssue {
  type: IssueType;
  severity: Severity;
  detail?: string;
}

/**
 * Derive every issue for one crawled page.
 *
 * A page blocked by robots.txt yields exactly one NOTICE and nothing else:
 * we never fetched it, so every content rule below would be reporting on
 * absence rather than on the page.
 */
export function detectIssues(input: IssueInput): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const add = (type: IssueType, detail?: string) =>
    issues.push({ type, severity: ISSUE_SEVERITY[type], ...(detail ? { detail } : {}) });

  if (input.blockedByRobots) {
    add("BLOCKED_BY_ROBOTS", "Disallowed by robots.txt; not fetched.");
    return issues;
  }

  const status = input.statusCode;
  if (status !== null) {
    if (status >= 400 && status < 500) add("HTTP_4XX", `HTTP ${status}`);
    else if (status >= 500) add("HTTP_5XX", `HTTP ${status}`);
  }

  if (input.redirectHops > 1) {
    add("REDIRECT_CHAIN", `${input.redirectHops} redirect hops`);
  }

  // X-Robots-Tag applies whatever the body is, so it is checked before the
  // HTML-only rules below.
  if (input.xRobotsTag?.includes("noindex")) {
    add("NOINDEX", "X-Robots-Tag: noindex");
  }

  const parsed = input.parsed;
  if (!parsed || !input.isHtml) return issues;

  if (parsed.metaRobots?.toLowerCase().includes("noindex")) {
    // Only once, even when the header said it too.
    if (!issues.some((i) => i.type === "NOINDEX")) {
      add("NOINDEX", "meta robots: noindex");
    }
  }

  const ok = status !== null && status >= 200 && status < 300;

  if (!parsed.title) {
    add("TITLE_MISSING");
  } else if (parsed.title.length > TITLE_MAX_LENGTH) {
    add("TITLE_TOO_LONG", `${parsed.title.length} chars`);
  } else if (parsed.title.length < TITLE_MIN_LENGTH) {
    add("TITLE_TOO_SHORT", `${parsed.title.length} chars`);
  }

  if (!parsed.metaDescription) {
    add("META_DESC_MISSING");
  } else if (parsed.metaDescription.length > META_DESC_MAX_LENGTH) {
    add("META_DESC_TOO_LONG", `${parsed.metaDescription.length} chars`);
  }

  if (parsed.h1Count === 0) add("H1_MISSING");
  else if (parsed.h1Count > 1) add("MULTIPLE_H1", `${parsed.h1Count} h1 elements`);

  if (!parsed.canonical) {
    add("CANONICAL_MISSING");
  } else {
    const normalizedFinal = normalizeCrawlUrl(input.finalUrl) ?? input.finalUrl;
    const normalizedCanonical = normalizeCrawlUrl(parsed.canonical) ?? parsed.canonical;
    if (normalizedCanonical !== normalizedFinal) {
      add("CANONICAL_MISMATCH", `canonical → ${parsed.canonical}`);
    }
  }

  // Thin content is only meaningful on a page that actually returned content.
  if (ok && parsed.wordCount < THIN_CONTENT_WORDS) {
    add("THIN_CONTENT", `${parsed.wordCount} words`);
  }

  if (ok && input.duplicateOf) {
    add("DUPLICATE_CONTENT", `same content as ${input.duplicateOf}`);
  }

  return issues;
}

/**
 * The duplicate-content notice, on its own.
 *
 * Separate from detectIssues() because duplication is not a property of the
 * page — it is a property of the CRAWL, known only once the other pages have
 * been written. The runner calls this at write time, after the
 * [crawlJobId, contentHash] lookup.
 */
export function duplicateContentIssue(duplicateOfUrl: string): DetectedIssue {
  return {
    type: "DUPLICATE_CONTENT",
    severity: ISSUE_SEVERITY.DUPLICATE_CONTENT,
    detail: `same content as ${duplicateOfUrl}`,
  };
}

function attrOf(
  $: cheerio.CheerioAPI,
  selector: string,
  attribute: string,
): string | null {
  const value = $(selector).first().attr(attribute);
  return value ? value.trim() : null;
}

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const v of values) {
    const trimmed = (v ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
