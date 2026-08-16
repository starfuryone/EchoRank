// src/lib/action-agent/context.ts
//
// Everything a generator is grounded in, gathered before a token is spent.
//
// ALL FIVE GATHERERS ARE TENANT-SCOPED AND ALL FIVE DEGRADE. A tenant with no
// Site Audit, no crawl and no tracked prompts still gets a usable draft from
// the page alone — the prompts say so explicitly rather than silently omitting
// a section and leaving the model to guess what the blank meant. That matters
// because the Fix-with-AI buttons live on surfaces a brand-new tenant reaches
// on day one.
//
// THE PAGE FETCH DOES NOT GO THROUGH THE SIDECAR. /internal/ai-lens drives
// headless chromium, is capped at two renders process-wide, and av-service runs
// a single event loop that its PDF endpoints already block. Spending a browser
// render to read a <title> would put a button click behind a queue that exists
// for a much more expensive question. This uses the site crawler's own fetch —
// manual redirects, a byte cap and a timeout — behind the same SSRF verdict
// Historical uses.

import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { fetchPage, isHtmlContentType } from "@/lib/site-crawler/fetch";
import { normalizeSnapshotUrl } from "@/lib/historical/url";
import { checkDefinition } from "@/lib/site-audit/checks";
import type { IssuesSection } from "@/lib/site-audit/types";

/** Characters of page text handed to a model. Matches remediate.py's 6000. */
const MAX_CONTENT_CHARS = 6000;
/** Tracked prompts fed to the FAQ generator. Ten questions, six to ten answers. */
const MAX_TRACKED_PROMPTS = 10;
/** Site pages listed as link targets. Enough to be useful, short enough to read. */
const MAX_INVENTORY_PAGES = 25;
/** Audit findings quoted into the schema prompt. */
const MAX_AUDIT_FINDINGS = 12;

export class PageUnreachableError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = "PageUnreachableError";
  }
}

export interface PageContext {
  /** The URL after redirects — what the JSON-LD `@id` anchors are built from. */
  url: string;
  title: string;
  metaDescription: string | null;
  h1s: string[];
  /** `@type` values already present in the page's JSON-LD. */
  existingSchemaTypes: string[];
  /** Prose, script/style stripped, truncated. */
  content: string;
}

/** Collect every `@type` in a JSON-LD document, however deeply nested. */
function collectTypes(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const entry of node) collectTypes(entry, into);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") into.add(type);
  else if (Array.isArray(type)) {
    for (const entry of type) if (typeof entry === "string") into.add(entry);
  }
  for (const value of Object.values(record)) collectTypes(value, into);
}

/**
 * Read one live page.
 *
 * A JSON-LD block that does not parse is SKIPPED, not thrown on: a broken
 * existing block is one of the strongest reasons to generate a replacement, so
 * failing here would refuse to help exactly the pages that need it most.
 */
export async function gatherPageContext(rawUrl: string): Promise<PageContext> {
  const normalized = normalizeSnapshotUrl(rawUrl);
  if (!normalized.ok || !normalized.url) {
    throw new PageUnreachableError("That is not a public web address we can read.");
  }

  const outcome = await fetchPage(normalized.url);
  if (outcome.error || !outcome.html || !isHtmlContentType(outcome.contentType)) {
    throw new PageUnreachableError(
      outcome.statusCode
        ? `That page answered ${outcome.statusCode} and returned no readable HTML.`
        : "That page could not be reached.",
    );
  }

  const $ = cheerio.load(outcome.html);

  const title = ($("head > title").first().text() || $("title").first().text() || "").trim();
  const metaDescription = ($('meta[name="description" i]').attr("content") ?? "").trim();

  const h1s: string[] = [];
  $("h1").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (text) h1s.push(text);
  });

  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    try {
      collectTypes(JSON.parse(raw), types);
    } catch {
      // See the doc comment: an unparseable block is a finding, not a failure.
    }
  });

  const $text = cheerio.load(outcome.html);
  $text("script, style, noscript, template, svg").remove();
  const content = ($text("body").text() || $text.root().text())
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CONTENT_CHARS);

  if (!content) {
    throw new PageUnreachableError("That page returned no readable text.");
  }

  return {
    url: outcome.finalUrl || normalized.url,
    title,
    metaDescription: metaDescription || null,
    h1s: h1s.slice(0, 10),
    existingSchemaTypes: [...types].sort(),
    content,
  };
}

/**
 * Failing checks from this tenant's most recent completed Site Audit.
 *
 * MATCHED ON THE REGISTRABLE HOST, not the full URL: an audit is per domain and
 * the page being fixed is one URL inside it. Returns [] when the tenant has
 * never run one, which is the common case on day one.
 */
export async function gatherAuditFindings(tenantId: string, pageUrl: string): Promise<string[]> {
  let host: string;
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return [];
  }

  const audit = await prisma.siteAudit.findFirst({
    where: { tenantId, domain: host, status: "completed" },
    orderBy: { createdAt: "desc" },
    select: { issues: true },
  });
  if (!audit?.issues) return [];

  const issues = audit.issues as unknown as IssuesSection;
  if (!Array.isArray(issues.items)) return [];

  return issues.items
    .filter((row) => row && typeof row.key === "string" && row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_AUDIT_FINDINGS)
    .map((row) => {
      // THE RAW UPSTREAM KEY, deliberately. The catalogue in
      // site-audit/checks.ts carries a severity and a group but no prose label
      // — the labels are i18n copy, three catalogs deep, and translating a
      // check name into French before handing it to an English prompt would be
      // a round trip that loses the one thing the model can act on. An
      // uncatalogued check still reaches the model as its key rather than
      // vanishing; only the severity annotation is dropped.
      const known = checkDefinition(row.key);
      const severity = known ? `${known.severity}, ${known.group}` : "uncatalogued";
      return `${row.key} (${severity}; ${row.count} page${row.count === 1 ? "" : "s"})`;
    });
}

/**
 * The tenant's highest-value tracked questions, best first.
 *
 * ORDERED BY WHAT THE CUSTOMER SAID MATTERS, then by what we measured:
 * importanceWeight is the multiplier they set by hand, commercialValue is our
 * judgement of the money behind the question, relevanceScore is whether it is
 * about them at all. Sorting on our scores first would bury the two prompts a
 * customer deliberately weighted above the other eighteen.
 */
export async function gatherTrackedPrompts(tenantId: string): Promise<string[]> {
  const rows = await prisma.trackedPrompt.findMany({
    where: { tenantId, active: true },
    orderBy: [
      { importanceWeight: "desc" },
      { commercialValue: "desc" },
      { relevanceScore: "desc" },
      { createdAt: "asc" },
    ],
    take: MAX_TRACKED_PROMPTS,
    select: { text: true },
  });
  return rows.map((row) => row.text).filter(Boolean);
}

export interface InventoryPage {
  url: string;
  title: string;
}

/**
 * What this site already publishes, from the newest completed first-party crawl.
 *
 * FIRST-PARTY CRAWL, not Site Audit: CrawlPage stores a title per URL, which is
 * what makes an inventory line readable, and the audit's `pages` JSON stores
 * only the worst hundred by score. Ordered shallowest-first so the pages a
 * visitor reaches in one click are the ones an answer can link to.
 */
export async function gatherPageInventory(
  tenantId: string,
  pageUrl: string,
): Promise<InventoryPage[]> {
  let host: string;
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return [];
  }

  const job = await prisma.crawlJob.findFirst({
    // Tenant-scoped in the WHERE clause, never a check-then-read.
    where: { tenantId, status: "COMPLETED", rootUrl: { contains: host } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!job) return [];

  const pages = await prisma.crawlPage.findMany({
    where: { crawlJobId: job.id, statusCode: 200 },
    orderBy: [{ depth: "asc" }, { inlinkCount: "desc" }],
    take: MAX_INVENTORY_PAGES,
    select: { url: true, title: true },
  });

  return pages.map((page) => ({ url: page.url, title: (page.title ?? "").trim() }));
}

export interface UnansweredReview {
  id: string;
  platform: string;
  rating: number | null;
  authorName: string | null;
  content: string;
  publishedAt: Date | null;
}

/**
 * Reviews with no reply on record, newest first.
 *
 * "NO REPLY ON RECORD" IS BOTH COLUMNS. `replyContent` and `repliedAt` are set
 * together everywhere they are set at all, but neither has a NOT NULL and this
 * query is what decides whether a customer gets asked to answer something twice
 * — so it checks both rather than trusting that invariant.
 *
 * EMPTY-BODY REVIEWS ARE EXCLUDED. A bare star rating gives the model nothing
 * to be specific about, and "thank you for the five stars" is a reply the
 * customer can write without spending tokens on it.
 */
export async function gatherUnansweredReviews(
  tenantId: string,
  limit: number,
  /**
   * Restrict to specific reviews. Used by re-generation, which has to redraft
   * the ONE review a reviewer rejected rather than whatever the next batch
   * happens to pick up. Still filtered on "unanswered" and still scoped by
   * tenantId, so a stale id from another tenant selects nothing.
   */
  ids?: string[],
): Promise<UnansweredReview[]> {
  if (ids && ids.length === 0) return [];

  const rows = await prisma.externalReview.findMany({
    where: {
      tenantId,
      ...(ids ? { id: { in: ids } } : {}),
      replyContent: null,
      repliedAt: null,
      content: { not: null },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      platform: true,
      rating: true,
      authorName: true,
      content: true,
      publishedAt: true,
    },
  });

  return rows
    .map((row) => ({
      id: row.id,
      platform: String(row.platform),
      rating: row.rating,
      authorName: row.authorName,
      content: (row.content ?? "").trim(),
      publishedAt: row.publishedAt,
    }))
    .filter((row) => row.content.length > 0);
}
