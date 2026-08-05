// src/lib/site-crawler/aggregate.ts
//
// The site-wide pass: everything that cannot be known from one page alone.
//
// NOTHING HERE LOADS THE PAGE SET INTO NODE. Every question is asked of
// Postgres as a groupBy or a batched keyset scan, and the largest thing this
// module holds at once is one AGGREGATION_BATCH_SIZE window plus the redirect
// map (url -> target, only for pages that actually redirect). A 25,000-URL
// crawl aggregates in roughly the memory a 25-URL one does, which is the same
// constraint that shaped the crawl itself.
//
// IDEMPOTENT BY CONSTRUCTION. Aggregation deletes AGGREGATED_ISSUE_TYPES for
// the job before writing, so running it twice yields the same rows. The one
// exception is REDIRECT_CHAIN, which the crawl also writes from single-fetch
// hop counts — see the note on AGGREGATED_ISSUE_TYPES in checks.ts.

import type Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import {
  AGGREGATION_BATCH_SIZE,
  MAX_CHAIN_WALK,
  SUMMARY_DEEPEST_LIMIT,
  SUMMARY_SAMPLE_LIMIT,
  crawlKeys,
} from "./constants";
import { AGGREGATED_ISSUE_TYPES, ISSUE_SEVERITY, type IssueType } from "./checks";
import type { SitemapResult } from "./sitemap";

export interface AggregateArgs {
  jobId: string;
  redis: Redis;
  sitemap: SitemapResult;
  /** URLs the sitemap seeded into the frontier — the orphan candidates. */
  sitemapSeeded: Set<string>;
}

export interface CrawlSummary {
  statusCodes: Record<string, number>;
  depths: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issuesByType: Record<string, number>;
  duplicates: { title: number; metaDescription: number; content: number };
  redirects: { chains: number; loops: number; longestChain: number };
  sitemap: {
    found: boolean;
    urlCount: number;
    filesFetched: number;
    truncated: boolean;
    notCrawled: number;
    notCrawledSample: string[];
  };
  inlinks: { average: number; zeroCount: number; max: number };
  deepestPages: { url: string; depth: number }[];
  aggregationMs: number;
  aggregationError?: string;
}

export interface AggregateResult {
  summary: CrawlSummary;
  /** Total issues for the job after aggregation — replaces the running count. */
  issueCount: number;
}

interface IssueRow {
  crawlPageId: string;
  type: IssueType;
  severity: string;
  detail: string | null;
}

export async function aggregateCrawl({
  jobId,
  redis,
  sitemap,
  sitemapSeeded,
}: AggregateArgs): Promise<AggregateResult> {
  const started = Date.now();
  const keys = crawlKeys(jobId);

  // Wipe what this step owns, so a re-run cannot double it.
  await prisma.crawlIssue.deleteMany({
    where: {
      crawlPage: { crawlJobId: jobId },
      type: { in: [...AGGREGATED_ISSUE_TYPES] },
    },
  });

  const pending: IssueRow[] = [];
  const add = (crawlPageId: string, type: IssueType, detail?: string) =>
    pending.push({ crawlPageId, type, severity: ISSUE_SEVERITY[type], detail: detail ?? null });

  const inlinkStats = await flushInlinks(jobId, redis, keys.inlinks);
  const duplicates = await findDuplicates(jobId, add);
  const redirects = await walkRedirects(jobId, add);
  const orphans = await findOrphans(jobId, sitemapSeeded, add);
  await flagNoInlinks(jobId, add);

  // One bulk insert. createMany skips the per-row round trip that would make
  // tens of thousands of findings the slowest part of the crawl.
  for (let i = 0; i < pending.length; i += AGGREGATION_BATCH_SIZE) {
    await prisma.crawlIssue.createMany({ data: pending.slice(i, i + AGGREGATION_BATCH_SIZE) });
  }

  const [statusCodes, depths, issuesBySeverity, issuesByType, deepestPages, issueCount] =
    await Promise.all([
      distribution(jobId, "statusCode"),
      distribution(jobId, "depth"),
      issueDistribution(jobId, "severity"),
      issueDistribution(jobId, "type"),
      deepest(jobId),
      prisma.crawlIssue.count({ where: { crawlPage: { crawlJobId: jobId } } }),
    ]);

  const notCrawled = await sitemapNotCrawled(jobId, sitemap);

  const summary: CrawlSummary = {
    statusCodes,
    depths,
    issuesBySeverity,
    issuesByType,
    duplicates,
    redirects,
    sitemap: {
      found: sitemap.found,
      urlCount: sitemap.urls.length,
      filesFetched: sitemap.filesFetched,
      truncated: sitemap.truncated,
      notCrawled: notCrawled.count,
      notCrawledSample: notCrawled.sample,
    },
    inlinks: inlinkStats,
    deepestPages,
    aggregationMs: Date.now() - started,
  };

  logger.info(
    { jobId, aggregationMs: summary.aggregationMs, issueCount, orphans },
    "site-crawl aggregation complete",
  );

  return { summary, issueCount };
}

/**
 * Move the Redis inlink hash into CrawlPage.inlinkCount.
 *
 * HSCAN rather than HGETALL: a 25,000-page site's hash is 25,000 fields, and
 * HGETALL would materialize all of them in one reply. Updates go out per
 * batch with a WHERE on the crawl, so a URL from another crawl cannot be hit.
 */
async function flushInlinks(
  jobId: string,
  redis: Redis,
  inlinksKey: string,
): Promise<{ average: number; zeroCount: number; max: number }> {
  let cursor = "0";
  let max = 0;

  do {
    const [next, flat] = await redis.hscan(inlinksKey, cursor, "COUNT", 500);
    cursor = next;

    // HSCAN returns [field, value, field, value, …].
    for (let i = 0; i < flat.length; i += 2) {
      const url = flat[i]!;
      const count = Number(flat[i + 1]) || 0;
      if (count > max) max = count;
      await prisma.crawlPage.updateMany({
        where: { crawlJobId: jobId, url },
        data: { inlinkCount: count },
      });
    }
  } while (cursor !== "0");

  // Pages nothing linked to keep a real 0 rather than null, so "no inlinks"
  // and "not yet computed" stay distinguishable.
  await prisma.crawlPage.updateMany({
    where: { crawlJobId: jobId, inlinkCount: null },
    data: { inlinkCount: 0 },
  });

  const [agg, zeroCount] = await Promise.all([
    prisma.crawlPage.aggregate({ where: { crawlJobId: jobId }, _avg: { inlinkCount: true } }),
    prisma.crawlPage.count({ where: { crawlJobId: jobId, inlinkCount: 0 } }),
  ]);

  return {
    average: Math.round((agg._avg.inlinkCount ?? 0) * 100) / 100,
    zeroCount,
    max,
  };
}

/** 200-status HTML pages — the only population the content rules apply to. */
const OK_HTML = {
  statusCode: { gte: 200, lt: 300 },
  contentType: { startsWith: "text/html" },
};

/**
 * Duplicate title / meta description / content groups.
 *
 * Postgres does the grouping; only duplicated groups come back, each already
 * carrying its member ids. A site with no duplicates transfers nothing.
 */
async function findDuplicates(
  jobId: string,
  add: (pageId: string, type: IssueType, detail?: string) => void,
): Promise<{ title: number; metaDescription: number; content: number }> {
  const [title, metaDescription, content] = await Promise.all([
    duplicateGroups(jobId, "title"),
    duplicateGroups(jobId, "metaDescription"),
    duplicateGroups(jobId, "contentHash"),
  ]);

  const write = (
    groups: DuplicateGroup[],
    type: IssueType,
    what: string,
  ) => {
    for (const group of groups) {
      // EVERY member is flagged, including the first. Phase 1's write-time
      // check could only see pages written before the current one, so the
      // first member of each group went unflagged — that is the bug this
      // recomputation fixes.
      for (const id of group.ids) {
        add(id, type, `${group.ids.length} pages share this ${what}`);
      }
    }
  };

  write(title, "DUPLICATE_TITLE", "title");
  write(metaDescription, "DUPLICATE_META_DESC", "meta description");
  write(content, "DUPLICATE_CONTENT", "content");

  return {
    title: title.length,
    metaDescription: metaDescription.length,
    content: content.length,
  };
}

interface DuplicateGroup {
  ids: string[];
}

/**
 * Groups of 200-status HTML pages sharing one column value.
 *
 * RAW SQL, and one query per column rather than groupBy + a findMany per
 * group: array_agg returns the member ids with the group, so a site with 400
 * duplicate groups costs three queries instead of 1,200. The column name is a
 * literal in each branch — never interpolated — so this cannot become an
 * injection point.
 */
async function duplicateGroups(
  jobId: string,
  field: "title" | "metaDescription" | "contentHash",
): Promise<DuplicateGroup[]> {
  const rows =
    field === "title"
      ? await prisma.$queryRaw<{ ids: string[] }[]>`
          SELECT array_agg(id) AS ids FROM crawl_pages
          WHERE "crawlJobId" = ${jobId}
            AND "statusCode" >= 200 AND "statusCode" < 300
            AND "contentType" LIKE 'text/html%'
            AND title IS NOT NULL AND title <> ''
          GROUP BY title HAVING count(*) > 1`
      : field === "metaDescription"
        ? await prisma.$queryRaw<{ ids: string[] }[]>`
            SELECT array_agg(id) AS ids FROM crawl_pages
            WHERE "crawlJobId" = ${jobId}
              AND "statusCode" >= 200 AND "statusCode" < 300
              AND "contentType" LIKE 'text/html%'
              AND "metaDescription" IS NOT NULL AND "metaDescription" <> ''
            GROUP BY "metaDescription" HAVING count(*) > 1`
        : await prisma.$queryRaw<{ ids: string[] }[]>`
            SELECT array_agg(id) AS ids FROM crawl_pages
            WHERE "crawlJobId" = ${jobId}
              AND "statusCode" >= 200 AND "statusCode" < 300
              AND "contentType" LIKE 'text/html%'
              AND "contentHash" IS NOT NULL
            GROUP BY "contentHash" HAVING count(*) > 1`;

  return rows.map((r) => ({ ids: r.ids }));
}

/**
 * Walk url -> redirectTarget chains.
 *
 * The map holds only pages that actually redirect, which on a healthy site is
 * a small fraction of the crawl. Each start is walked at most MAX_CHAIN_WALK
 * hops; revisiting a URL inside one walk is a loop.
 */
async function walkRedirects(
  jobId: string,
  add: (pageId: string, type: IssueType, detail?: string) => void,
): Promise<{ chains: number; loops: number; longestChain: number }> {
  const map = new Map<string, { id: string; target: string }>();

  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.crawlPage.findMany({
      where: { crawlJobId: jobId, redirectTarget: { not: null } },
      select: { id: true, url: true, redirectTarget: true },
      orderBy: { id: "asc" },
      take: AGGREGATION_BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      map.set(row.url, { id: row.id, target: row.redirectTarget! });
    }
    if (batch.length < AGGREGATION_BATCH_SIZE) break;
    cursor = batch[batch.length - 1]!.id;
  }

  // Pages that already carry a chain warning from the crawl keep it; see the
  // note on AGGREGATED_ISSUE_TYPES. This is what makes adding chains here
  // stable across re-runs without deleting the per-fetch findings.
  const alreadyFlagged = new Set(
    (
      await prisma.crawlIssue.findMany({
        where: { crawlPage: { crawlJobId: jobId }, type: "REDIRECT_CHAIN" },
        select: { crawlPageId: true },
      })
    ).map((r) => r.crawlPageId),
  );

  let chains = 0;
  let loops = 0;
  let longestChain = 0;

  for (const [start, entry] of map) {
    const walk = walkChain(start, map);

    if (walk.looped) {
      loops += 1;
      add(entry.id, "REDIRECT_LOOP", `loop: ${walk.path.join(" → ")}`);
      continue;
    }
    if (walk.hops > 1) {
      chains += 1;
      longestChain = Math.max(longestChain, walk.hops);
      if (!alreadyFlagged.has(entry.id)) {
        add(entry.id, "REDIRECT_CHAIN", `${walk.hops} hops: ${walk.path.join(" → ")}`);
      }
    }
  }

  return { chains, loops, longestChain };
}

export interface ChainWalk {
  path: string[];
  hops: number;
  looped: boolean;
  /** True when the walk stopped at MAX_CHAIN_WALK rather than at an end. */
  truncated: boolean;
}

/**
 * Follow one redirect chain from `start`.
 *
 * Pure, and exported for its own test: this is the piece with the interesting
 * failure mode. A cycle must be reported as a loop rather than walked forever,
 * and the hop budget is what stops a very long legitimate chain from becoming
 * an unbounded walk.
 */
export function walkChain(
  start: string,
  map: ReadonlyMap<string, { target: string }>,
): ChainWalk {
  const first = map.get(start);
  if (!first) return { path: [start], hops: 0, looped: false, truncated: false };

  const path = [start];
  const seen = new Set([start]);
  let current = first.target;
  let looped = false;
  let truncated = true;

  for (let hop = 0; hop < MAX_CHAIN_WALK; hop++) {
    path.push(current);
    if (seen.has(current)) {
      looped = true;
      truncated = false;
      break;
    }
    seen.add(current);
    const next = map.get(current);
    if (!next) {
      truncated = false;
      break;
    }
    current = next.target;
  }

  return { path, hops: path.length - 1, looped, truncated };
}

/**
 * Pages the sitemap advertises that nothing on the site links to.
 *
 * Only pages seeded FROM the sitemap qualify: a page reached by crawling is
 * linked to by definition. Combined with inlinkCount = 0, that is precisely
 * "advertised but unreachable by following links".
 */
async function findOrphans(
  jobId: string,
  sitemapSeeded: Set<string>,
  add: (pageId: string, type: IssueType, detail?: string) => void,
): Promise<number> {
  if (sitemapSeeded.size === 0) return 0;

  let orphans = 0;
  const seeded = [...sitemapSeeded];

  for (let i = 0; i < seeded.length; i += AGGREGATION_BATCH_SIZE) {
    const slice = seeded.slice(i, i + AGGREGATION_BATCH_SIZE);
    const rows = await prisma.crawlPage.findMany({
      where: {
        crawlJobId: jobId,
        url: { in: slice },
        depth: 0,
        inlinkCount: 0,
        ...OK_HTML,
      },
      select: { id: true },
    });
    for (const row of rows) {
      add(row.id, "ORPHAN_PAGE", "In the sitemap, but nothing on the site links to it");
      orphans += 1;
    }
  }

  return orphans;
}

/** 200 HTML pages below the root that nothing links to. */
async function flagNoInlinks(
  jobId: string,
  add: (pageId: string, type: IssueType, detail?: string) => void,
): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.crawlPage.findMany({
      where: { crawlJobId: jobId, inlinkCount: 0, depth: { gt: 0 }, ...OK_HTML },
      select: { id: true },
      orderBy: { id: "asc" },
      take: AGGREGATION_BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    for (const row of batch) add(row.id, "NO_INLINKS", "No internal links point to this page");
    if (batch.length < AGGREGATION_BATCH_SIZE) break;
    cursor = batch[batch.length - 1]!.id;
  }
}

/** Value -> count for one CrawlPage column, computed in Postgres. */
async function distribution(
  jobId: string,
  field: "statusCode" | "depth",
): Promise<Record<string, number>> {
  const groups = await prisma.crawlPage.groupBy({
    by: [field],
    where: { crawlJobId: jobId },
    _count: { _all: true },
  });

  const out: Record<string, number> = {};
  for (const group of groups) {
    const value = group[field];
    out[value === null ? "unknown" : String(value)] = group._count._all;
  }
  return out;
}

async function issueDistribution(
  jobId: string,
  field: "severity" | "type",
): Promise<Record<string, number>> {
  const groups = await prisma.crawlIssue.groupBy({
    by: [field],
    where: { crawlPage: { crawlJobId: jobId } },
    _count: { _all: true },
  });

  const out: Record<string, number> = {};
  for (const group of groups) out[group[field]] = group._count._all;
  return out;
}

async function deepest(jobId: string): Promise<{ url: string; depth: number }[]> {
  const rows = await prisma.crawlPage.findMany({
    where: { crawlJobId: jobId },
    select: { url: true, depth: true },
    orderBy: [{ depth: "desc" }, { url: "asc" }],
    take: SUMMARY_DEEPEST_LIMIT,
  });
  return rows.map((r) => ({ url: r.url, depth: r.depth }));
}

/**
 * Sitemap URLs that never became a page row — normally because a cap was hit.
 *
 * Checked in slices against the crawled set rather than by loading either side
 * whole, and the sample is capped: a crawl that stopped at 500 of 50,000
 * sitemap URLs must not write 49,500 URLs into the summary column.
 */
async function sitemapNotCrawled(
  jobId: string,
  sitemap: SitemapResult,
): Promise<{ count: number; sample: string[] }> {
  if (sitemap.urls.length === 0) return { count: 0, sample: [] };

  let count = 0;
  const sample: string[] = [];

  for (let i = 0; i < sitemap.urls.length; i += AGGREGATION_BATCH_SIZE) {
    const slice = sitemap.urls.slice(i, i + AGGREGATION_BATCH_SIZE);
    const found = await prisma.crawlPage.findMany({
      where: { crawlJobId: jobId, url: { in: slice } },
      select: { url: true },
    });
    const crawled = new Set(found.map((r) => r.url));
    for (const url of slice) {
      if (crawled.has(url)) continue;
      count += 1;
      if (sample.length < SUMMARY_SAMPLE_LIMIT) sample.push(url);
    }
  }

  return { count, sample };
}
