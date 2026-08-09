// src/lib/ai-monitor/onboarding/crawl.ts
//
// The small, polite read of a brand's own website that onboarding runs before
// it asks a model what the business does.
//
// NOT THE SITE CRAWLER. src/lib/site-crawler audits a site: hundreds of URLs,
// a job row, a queue, per-page issue records. This wants a paragraph of context
// from a dozen pages and has to finish while a human watches a spinner. It
// REUSES that module's hard-won pieces — robots handling, the polite fetcher,
// URL normalisation and scoping — and supplies its own budget and page
// selection. Reimplementing robots.txt handling here is exactly the mistake
// that gets a crawler blocked.
//
// ROBOTS IS OBEYED, INCLUDING THE UNFRIENDLY READING. fetchRobots() treats a
// timing-out or 5xx robots.txt as deny-all (see its header). Onboarding
// therefore has a real "we were not allowed to look" outcome, and it must
// degrade to asking the user rather than guessing: a description invented for
// a site we could not read is worse than an empty field, because the user will
// not notice it is wrong until their prompts are all about the wrong industry.
//
// BREADTH BEFORE DEPTH, AND PRIORITISED. A homepage plus /about plus /pricing
// tells a model far more than twelve blog posts. Links are scored before they
// are queued, so the budget is spent on the pages that describe the business.

import * as cheerio from "cheerio";
import { fetchPage, RateLimiter } from "@/lib/site-crawler/fetch";
import { fetchRobots } from "@/lib/site-crawler/robots";
import {
  isInScope,
  looksLikeNonHtml,
  normalizeCrawlUrl,
  validateRootUrl,
} from "@/lib/site-crawler/url";

/** Pages fetched at most. Twelve is roughly a homepage plus its main nav. */
export const MAX_PAGES = 12;
/** Link depth from the root. 2 reaches the nav and one level below it. */
export const MAX_DEPTH = 2;
/** Text kept per page. Enough to characterise it, short enough to send twelve. */
export const MAX_PAGE_CHARS = 4_000;
/** Ceiling across all pages, so the inference prompt stays affordable. */
export const MAX_TOTAL_CHARS = 24_000;
/** Wall clock. Onboarding is interactive; a slow site must not hold it open. */
export const MAX_DURATION_MS = 45_000;

/**
 * Path fragments worth spending the budget on, most valuable first.
 *
 * Matched as substrings of the pathname. Ordered: a site with both /about and
 * /blog gets /about, because "what does this company do" is answered there.
 */
export const PRIORITY_PATHS: readonly string[] = [
  "/about",
  "/product",
  "/solution",
  "/service",
  "/pricing",
  "/platform",
  "/feature",
  "/what-we-do",
  "/who-we-are",
  "/customers",
  "/case-stud",
  "/industries",
  "/compare",
  "/alternatives",
  "/vs-",
];

/** Paths that never describe the business. Skipped even inside the budget. */
export const SKIP_PATHS: readonly string[] = [
  "/privacy",
  "/terms",
  "/legal",
  "/cookie",
  "/login",
  "/signin",
  "/sign-in",
  "/signup",
  "/sign-up",
  "/register",
  "/cart",
  "/checkout",
  "/account",
  "/wp-admin",
  "/wp-json",
  "/feed",
  "/rss",
  "/tag/",
  "/author/",
  "/category/",
];

export interface CrawledPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  /** h1/h2 text, in document order. The site's own framing of itself. */
  headings: string[];
  /** Visible body text, collapsed and clipped to MAX_PAGE_CHARS. */
  text: string;
  /** Depth from the root. 0 is the root itself. */
  depth: number;
}

export type CrawlFailure =
  | "invalid_url"
  | "robots_disallowed"
  | "unreachable"
  | "no_readable_pages";

export interface SiteSnapshot {
  rootUrl: string;
  pages: CrawledPage[];
  /** True when robots.txt refused us — a real answer, not an error. */
  robotsBlocked: boolean;
  /** Set when nothing usable came back. `pages` is then empty. */
  failure: CrawlFailure | null;
  /** Fetches attempted, including ones that produced nothing. */
  fetched: number;
  durationMs: number;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Lower sorts first. The root is always 0; priority paths take their place in
 * PRIORITY_PATHS order; everything else sorts after by depth.
 */
export function linkPriority(url: string, rootUrl: string, depth: number): number {
  const normalizedRoot = normalizeCrawlUrl(rootUrl);
  if (normalizedRoot && url === normalizedRoot) return 0;

  const path = pathOf(url);
  const index = PRIORITY_PATHS.findIndex((fragment) => path.includes(fragment));
  if (index !== -1) return 1 + index;

  // Shallower unknown pages before deeper ones, and both after every known-good
  // path — a nav link two levels down beats a mystery link one level down.
  return 100 + depth * 10 + path.split("/").length;
}

export function shouldSkip(url: string): boolean {
  const path = pathOf(url);
  if (looksLikeNonHtml(path)) return true;
  return SKIP_PATHS.some((fragment) => path.includes(fragment));
}

/** Title, meta description, headings and body text from one HTML document. */
export function extractPageText(html: string): Omit<CrawledPage, "url" | "depth"> {
  const $ = cheerio.load(html);

  // Chrome, boilerplate and code are not description. Removed before the text
  // is read so a site-wide footer does not appear twelve times in the prompt
  // and crowd out what each page actually says.
  $("script, style, noscript, nav, header, footer, svg, form, iframe").remove();

  const title = $("head title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;

  const headings: string[] = [];
  $("h1, h2")
    .slice(0, 12)
    .each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text) headings.push(text);
    });

  const body = ($("main").first().text() || $("body").text() || "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    metaDescription,
    headings,
    text: body.slice(0, MAX_PAGE_CHARS),
  };
}

/** In-scope, crawlable links from one document, normalised and deduped. */
export function extractLinks(html: string, pageUrl: string, rootUrl: string): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const normalized = normalizeCrawlUrl(href, pageUrl);
    if (!normalized) return;
    if (!isInScope(normalized, rootUrl)) return;
    if (shouldSkip(normalized)) return;
    found.add(normalized);
  });

  return [...found];
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  maxDurationMs?: number;
  /** Injectable for tests, so the suite never touches the network. */
  fetchImpl?: typeof fetchPage;
  robotsImpl?: typeof fetchRobots;
  now?: () => number;
}

/**
 * Read enough of a site to describe the business behind it.
 *
 * NEVER THROWS. Every failure is a `failure` code with an empty page list,
 * because this runs inside project creation and a thrown error there would
 * leave a half-created project behind. The caller decides what an empty
 * snapshot means — currently: keep the project, skip inference, ask the user.
 */
export async function crawlSite(
  website: string,
  options: CrawlOptions = {},
): Promise<SiteSnapshot> {
  const maxPages = options.maxPages ?? MAX_PAGES;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const maxDurationMs = options.maxDurationMs ?? MAX_DURATION_MS;
  const doFetch = options.fetchImpl ?? fetchPage;
  const doRobots = options.robotsImpl ?? fetchRobots;
  const clock = options.now ?? Date.now;

  const startedAt = clock();
  const empty = (failure: CrawlFailure, robotsBlocked = false): SiteSnapshot => ({
    rootUrl: website,
    pages: [],
    robotsBlocked,
    failure,
    fetched: 0,
    durationMs: clock() - startedAt,
  });

  const validated = validateRootUrl(website);
  if (!validated.ok || !validated.url) return empty("invalid_url");
  const rootUrl = validated.url;

  const robots = await doRobots(rootUrl);
  if (!robots.allowAll && !robots.isAllowed(rootUrl)) {
    return empty("robots_disallowed", true);
  }

  const limiter = new RateLimiter(2, robots.crawlDelaySeconds * 1000);
  const seen = new Set<string>([rootUrl]);
  const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }];
  const pages: CrawledPage[] = [];
  let fetched = 0;
  let totalChars = 0;

  while (queue.length > 0 && pages.length < maxPages) {
    if (clock() - startedAt > maxDurationMs) break;

    // Re-sorted each pass rather than kept in a heap: the queue is at most a
    // few hundred entries and this keeps the ordering rule in one readable
    // place. Depth is part of the key, so a priority page found at depth 2
    // still beats an unknown page at depth 1.
    queue.sort(
      (a, b) =>
        linkPriority(a.url, rootUrl, a.depth) - linkPriority(b.url, rootUrl, b.depth),
    );
    const next = queue.shift();
    if (!next) break;

    if (!robots.isAllowed(next.url)) continue;

    await limiter.acquire();
    fetched += 1;
    const outcome = await doFetch(next.url);

    if (outcome.error || !outcome.html || (outcome.statusCode ?? 0) >= 400) continue;

    const extracted = extractPageText(outcome.html);
    // A page with neither a description nor body text is a shell — a JS-only
    // app route, or a redirect landing. Counting it against the budget would
    // spend the crawl on nothing.
    if (extracted.text.length < 40 && !extracted.metaDescription) continue;

    const remaining = MAX_TOTAL_CHARS - totalChars;
    if (remaining <= 0) break;
    const clipped = { ...extracted, text: extracted.text.slice(0, remaining) };
    totalChars += clipped.text.length;

    pages.push({ url: outcome.finalUrl, depth: next.depth, ...clipped });

    if (next.depth >= maxDepth) continue;
    for (const link of extractLinks(outcome.html, outcome.finalUrl, rootUrl)) {
      if (seen.has(link)) continue;
      seen.add(link);
      queue.push({ url: link, depth: next.depth + 1 });
    }
  }

  if (pages.length === 0) {
    return {
      ...empty(fetched === 0 ? "unreachable" : "no_readable_pages"),
      fetched,
    };
  }

  return {
    rootUrl,
    pages,
    robotsBlocked: false,
    failure: null,
    fetched,
    durationMs: clock() - startedAt,
  };
}

/**
 * The snapshot as one fenced block for an inference prompt.
 *
 * Fenced and labelled because everything in it was written by someone else and
 * reaches a model verbatim — a page saying "ignore previous instructions" is a
 * thing that exists on the live web, both by accident and on purpose.
 */
export function snapshotToPromptBlock(snapshot: SiteSnapshot): string {
  return snapshot.pages
    .map((page) =>
      [
        `URL: ${page.url}`,
        page.title ? `Title: ${page.title}` : null,
        page.metaDescription ? `Meta description: ${page.metaDescription}` : null,
        page.headings.length > 0 ? `Headings: ${page.headings.join(" | ")}` : null,
        `Text: ${page.text}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}
