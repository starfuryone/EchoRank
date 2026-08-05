// src/lib/site-crawler/runner.ts
//
// The BFS crawl itself.
//
// MEMORY IS THE DESIGN CONSTRAINT. The crawled set never lives in RAM: the
// frontier is a Redis list, the seen-set a Redis set, and results stream to
// Postgres in batches of WRITE_BATCH_SIZE. At any moment this holds one batch
// of parsed pages and nothing else, so a 25,000-URL crawl costs the same
// memory as a 25-URL one. The box is shared and small; that is the whole
// reason for the shape of this file.
//
// STOPPING. Four ways out, all of which leave a terminal status:
//   frontier empty      → COMPLETED, stoppedReason null
//   pagesCrawled >= cap → COMPLETED, "url_cap"
//   wall clock          → COMPLETED, "time_cap"
//   cancel flag         → CANCELLED
// Anything thrown becomes FAILED with a truncated message. The try/finally is
// what guarantees a job never sits in RUNNING forever, which is the failure a
// polling UI cannot recover from on its own.

import type Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import {
  CRAWLER_USER_AGENT,
  FETCH_CONCURRENCY,
  MAX_CRAWL_DURATION_MS,
  REDIS_KEY_TTL_SECONDS,
  WRITE_BATCH_SIZE,
  crawlKeys,
} from "./constants";
import { collectSitemapUrls, type SitemapResult } from "./sitemap";
import { aggregateCrawl } from "./aggregate";
import { RateLimiter, fetchPage, isHtmlContentType } from "./fetch";
import {
  detectIssues,
  duplicateContentIssue,
  parsePage,
  type DetectedIssue,
  type ParsedPage,
} from "./checks";
import { fetchRobots, type RobotsRules } from "./robots";
import { isFetchableUrl, isInScope, normalizeCrawlUrl } from "./url";

export interface RunCrawlArgs {
  jobId: string;
  redis: Redis;
  /** Injected so tests can run a crawl without a clock. */
  now?: () => number;
}

export interface CrawlOutcome {
  status: "COMPLETED" | "CANCELLED" | "FAILED";
  pagesCrawled: number;
  issueCount: number;
  stoppedReason: string | null;
}

/** One page's fetch+parse result, held only until the batch is written. */
interface PendingPage {
  url: string;
  depth: number;
  statusCode: number | null;
  redirectTarget: string | null;
  contentType: string | null;
  fetchMs: number | null;
  parsed: ParsedPage | null;
  issues: DetectedIssue[];
  contentHash: string | null;
  /** Null when the crawl found no sitemap at all. */
  inSitemap: boolean | null;
  /** Links to enqueue once the row is written. */
  discovered: { url: string; depth: number }[];
  /**
   * Distinct in-scope link targets on this page — the inlink credit it gives.
   * DEDUPED PER SOURCE PAGE: a nav that links the homepage from every page
   * should count once per page, not once per anchor.
   */
  linkTargets: string[];
}

export async function runCrawl({
  jobId,
  redis,
  now = () => Date.now(),
}: RunCrawlArgs): Promise<CrawlOutcome> {
  const keys = crawlKeys(jobId);
  const startedAt = now();

  const job = await prisma.crawlJob.findUnique({
    where: { id: jobId },
    select: { id: true, rootUrl: true, urlCap: true, status: true },
  });
  if (!job) throw new Error(`CrawlJob ${jobId} not found`);

  let pagesCrawled = 0;
  let issueCount = 0;
  let stoppedReason: string | null = null;
  let status: CrawlOutcome["status"] = "COMPLETED";
  let sitemap: SitemapResult = { found: false, urls: [], filesFetched: 0, truncated: false };
  let isInSitemap: ((url: string) => Promise<boolean>) | null = null;
  /** URLs the sitemap put in the frontier — an orphan candidate is one of these. */
  const sitemapSeeded = new Set<string>();
  let summary: unknown = undefined;

  try {
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const rootUrl = job.rootUrl;
    const robots: RobotsRules = await fetchRobots(rootUrl);
    const limiter = new RateLimiter(undefined, robots.crawlDelaySeconds * 1000);

    logger.info(
      {
        jobId,
        rootUrl,
        urlCap: job.urlCap,
        crawlDelay: robots.crawlDelaySeconds,
        robotsAllowAll: robots.allowAll,
        ua: CRAWLER_USER_AGENT,
      },
      "site-crawl started",
    );

    // Seed. SADD returns 0 if the root was already seen, which happens only on
    // a retry of the same job — the frontier is authoritative either way.
    await redis.sadd(keys.seen, rootUrl);
    await redis.rpush(keys.queue, JSON.stringify({ url: rootUrl, depth: 0 }));
    await redis.expire(keys.seen, REDIS_KEY_TTL_SECONDS);
    await redis.expire(keys.queue, REDIS_KEY_TTL_SECONDS);

    // ── Sitemap ─────────────────────────────────────────────────────────
    // Fetched after robots.txt because robots is where the Sitemap: lines
    // live. Failure is not fatal: a site with no sitemap crawls exactly as it
    // did in Phase 1, and the summary records that none was found.
    sitemap = await collectSitemapUrls({
      rootUrl,
      declared: robots.sitemaps,
      limiter,
    });

    if (sitemap.urls.length > 0) {
      // Stored as a SET so membership is one SISMEMBER per page rather than a
      // list held in Node for the length of the crawl.
      for (let i = 0; i < sitemap.urls.length; i += 1000) {
        await redis.sadd(keys.sitemap, ...sitemap.urls.slice(i, i + 1000));
      }
      await redis.expire(keys.sitemap, REDIS_KEY_TTL_SECONDS);
      isInSitemap = async (url: string) => (await redis.sismember(keys.sitemap, url)) === 1;

      // Seed sitemap URLs at depth 0, AFTER the root, so BFS from the root
      // still decides order — these only fill in what nothing links to.
      // Capped so seeding alone can never exceed the plan's URL ceiling.
      const seedRoom = Math.max(0, job.urlCap - 1);
      const seeds: string[] = [];
      for (const url of sitemap.urls) {
        if (seeds.length >= seedRoom) break;
        if (!isFetchableUrl(url)) continue;
        if ((await redis.sadd(keys.seen, url)) === 1) {
          seeds.push(JSON.stringify({ url, depth: 0 }));
          sitemapSeeded.add(url);
        }
      }
      if (seeds.length > 0) await redis.rpush(keys.queue, ...seeds);
    }

    logger.info(
      {
        jobId,
        sitemapFound: sitemap.found,
        sitemapUrls: sitemap.urls.length,
        sitemapFiles: sitemap.filesFetched,
        sitemapTruncated: sitemap.truncated,
      },
      "site-crawl sitemap ingested",
    );

    for (;;) {
      if (await redis.exists(keys.cancel)) {
        status = "CANCELLED";
        stoppedReason = "cancelled";
        break;
      }
      if (pagesCrawled >= job.urlCap) {
        stoppedReason = "url_cap";
        break;
      }
      if (now() - startedAt >= MAX_CRAWL_DURATION_MS) {
        stoppedReason = "time_cap";
        break;
      }

      const remaining = job.urlCap - pagesCrawled;
      const batchSize = Math.min(WRITE_BATCH_SIZE, remaining);
      const batch = await popBatch(redis, keys.queue, batchSize);
      if (batch.length === 0) break; // frontier exhausted — the clean ending

      const results = await processBatch(batch, rootUrl, robots, limiter, isInSitemap);
      const written = await writeBatch(jobId, results, redis, keys.seen, job.urlCap, pagesCrawled);

      pagesCrawled += written.pages;
      issueCount += written.issues;

      // Progress is written every batch so the UI's 3s poll shows movement.
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { pagesCrawled, issueCount },
      });
    }
    // ── Site-wide aggregation ───────────────────────────────────────────
    // Runs for every crawl that produced pages, INCLUDING cap- and
    // time-capped ones — a partial crawl's findings are still findings.
    // Skipped for CANCELLED, where the page set is arbitrary.
    //
    // Wrapped separately from the crawl: the page rows are already good, so an
    // aggregation failure must not turn a COMPLETED crawl into a FAILED one.
    // The reason lands in summary.aggregationError instead.
    if (status === "COMPLETED" && pagesCrawled > 0) {
      try {
        const result = await aggregateCrawl({
          jobId,
          redis,
          sitemap,
          sitemapSeeded,
        });
        summary = result.summary;
        issueCount = result.issueCount;
      } catch (err) {
        logger.error({ jobId, err }, "site-crawl aggregation failed");
        summary = {
          aggregationError: truncate(err instanceof Error ? err.message : String(err), 300),
        };
      }
    }
  } catch (err) {
    status = "FAILED";
    stoppedReason = truncate(err instanceof Error ? err.message : String(err), 500);
    logger.error({ jobId, err }, "site-crawl failed");
  } finally {
    // Terminal status ALWAYS, even if the update above threw. A job left in
    // RUNNING is one the UI polls forever.
    await prisma.crawlJob
      .update({
        where: { id: jobId },
        data: {
          status,
          pagesCrawled,
          issueCount,
          stoppedReason,
          finishedAt: new Date(),
          ...(summary === undefined ? {} : { summary: summary as never }),
        },
      })
      .catch((err) => logger.error({ jobId, err }, "site-crawl: final status write failed"));

    // The frontier is worthless once the crawl ends; TTL is the backstop for
    // a process that dies before reaching this line.
    await redis
      .del(keys.queue, keys.seen, keys.cancel, keys.inlinks, keys.sitemap)
      .catch(() => {});
  }

  logger.info({ jobId, status, pagesCrawled, issueCount, stoppedReason }, "site-crawl finished");
  return { status, pagesCrawled, issueCount, stoppedReason };
}

/** Pop up to `count` frontier entries. LPOP with a count is atomic. */
async function popBatch(
  redis: Redis,
  queueKey: string,
  count: number,
): Promise<{ url: string; depth: number }[]> {
  if (count <= 0) return [];
  const raw = await redis.lpop(queueKey, count);
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];

  const out: { url: string; depth: number }[] = [];
  for (const entry of items) {
    try {
      const parsed = JSON.parse(entry) as { url: string; depth: number };
      if (typeof parsed?.url === "string") {
        out.push({ url: parsed.url, depth: Number(parsed.depth) || 0 });
      }
    } catch {
      // A malformed frontier entry is dropped rather than failing the crawl.
    }
  }
  return out;
}

/** Fetch and parse one batch, at most FETCH_CONCURRENCY at a time. */
async function processBatch(
  batch: { url: string; depth: number }[],
  rootUrl: string,
  robots: RobotsRules,
  limiter: RateLimiter,
  isInSitemap: ((url: string) => Promise<boolean>) | null,
): Promise<PendingPage[]> {
  const results: PendingPage[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= batch.length) return;
      const item = batch[index]!;
      results.push(await crawlOne(item, rootUrl, robots, limiter, isInSitemap));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, batch.length) }, worker),
  );
  return results;
}

async function crawlOne(
  item: { url: string; depth: number },
  rootUrl: string,
  robots: RobotsRules,
  limiter: RateLimiter,
  /** Null when the crawl found no sitemap; otherwise membership per URL. */
  isInSitemap: ((url: string) => Promise<boolean>) | null,
): Promise<PendingPage> {
  const base: PendingPage = {
    url: item.url,
    depth: item.depth,
    statusCode: null,
    redirectTarget: null,
    contentType: null,
    fetchMs: null,
    parsed: null,
    issues: [],
    contentHash: null,
    inSitemap: null,
    discovered: [],
    linkTargets: [],
  };

  // Disallowed URLs are RECORDED, never fetched. The row exists so the tenant
  // can see what robots.txt is hiding from search engines too.
  if (!robots.isAllowed(item.url)) {
    return {
      ...base,
      issues: detectIssues({
        statusCode: null,
        parsed: null,
        finalUrl: item.url,
        redirectHops: 0,
        xRobotsTag: null,
        isHtml: false,
        blockedByRobots: true,
      }),
    };
  }

  // Second line behind scope: never open a socket to a private address.
  if (!isFetchableUrl(item.url)) return base;

  const inSitemap = isInSitemap ? await isInSitemap(item.url) : null;

  await limiter.acquire();
  const res = await fetchPage(item.url);

  const isHtml = isHtmlContentType(res.contentType) && res.html !== null;
  const parsed = isHtml ? parsePage(res.html!, res.finalUrl, rootUrl) : null;

  const issues = detectIssues({
    statusCode: res.statusCode,
    parsed,
    finalUrl: res.finalUrl,
    redirectHops: res.redirectHops,
    xRobotsTag: res.xRobotsTag,
    isHtml,
  });

  // parsePage already dedupes hrefs per page, so this set is the "one credit
  // per source page" rule the inlink count needs.
  const linkTargets = [
    ...new Set(
      (parsed?.links ?? [])
        .map((url) => normalizeCrawlUrl(url))
        .filter((url): url is string => Boolean(url))
        .filter((url) => isInScope(url, rootUrl) && isFetchableUrl(url)),
    ),
  ];

  return {
    ...base,
    statusCode: res.statusCode,
    redirectTarget: res.redirectTarget,
    contentType: res.contentType,
    fetchMs: res.fetchMs,
    parsed,
    issues,
    contentHash: parsed?.contentHash ?? null,
    inSitemap,
    discovered: linkTargets.map((url) => ({ url, depth: item.depth + 1 })),
    linkTargets,
  };
}

/**
 * Write one batch and enqueue what it discovered.
 *
 * Duplicate detection happens HERE rather than in checks.ts because it needs
 * the rest of the crawl: a hash is a duplicate only if another 200 page in this
 * job already carried it. The [crawlJobId, contentHash] index is what makes
 * that lookup cheap enough to do per page.
 */
async function writeBatch(
  jobId: string,
  results: PendingPage[],
  redis: Redis,
  seenKey: string,
  urlCap: number,
  alreadyCrawled: number,
): Promise<{ pages: number; issues: number }> {
  if (results.length === 0) return { pages: 0, issues: 0 };

  let issuesWritten = 0;

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      const isOk =
        result.statusCode !== null && result.statusCode >= 200 && result.statusCode < 300;

      let duplicateOf: string | null = null;
      if (isOk && result.contentHash) {
        const existing = await tx.crawlPage.findFirst({
          where: { crawlJobId: jobId, contentHash: result.contentHash },
          select: { url: true },
        });
        duplicateOf = existing?.url ?? null;
      }

      const issues = duplicateOf
        ? [...result.issues, duplicateContentIssue(duplicateOf)]
        : result.issues;

      await tx.crawlPage.create({
        data: {
          crawlJobId: jobId,
          url: result.url,
          statusCode: result.statusCode,
          redirectTarget: result.redirectTarget,
          title: result.parsed?.title ?? null,
          titleLength: result.parsed?.titleLength ?? null,
          metaDescription: result.parsed?.metaDescription ?? null,
          metaDescLength: result.parsed?.metaDescLength ?? null,
          h1Count: result.parsed?.h1Count ?? null,
          canonical: result.parsed?.canonical ?? null,
          metaRobots: result.parsed?.metaRobots ?? null,
          wordCount: result.parsed?.wordCount ?? null,
          contentHash: result.contentHash,
          depth: result.depth,
          internalLinks: result.parsed?.internalLinks ?? null,
          fetchMs: result.fetchMs,
          contentType: result.contentType,
          inSitemap: result.inSitemap,
          issues: {
            create: issues.map((i) => ({
              type: i.type,
              severity: i.severity,
              detail: i.detail ?? null,
            })),
          },
        },
      });

      issuesWritten += issues.length;
    }
  });

  // Credit inlinks in Redis rather than a link-edge table. One HINCRBY per
  // distinct (source page, target) pair — an edge table would carry an order
  // of magnitude more rows than the pages themselves.
  const credits = results.flatMap((r) => r.linkTargets);
  if (credits.length > 0) {
    const pipeline = redis.pipeline();
    const inlinksKey = seenKey.replace(/:seen$/, ":inlinks");
    for (const target of credits) pipeline.hincrby(inlinksKey, target, 1);
    pipeline.expire(inlinksKey, REDIS_KEY_TTL_SECONDS);
    await pipeline.exec();
  }

  // Enqueue after the write, and only up to the cap: a crawl that has already
  // reached its ceiling should not grow a frontier nobody will pop.
  const room = urlCap - (alreadyCrawled + results.length);
  if (room > 0) {
    const candidates = results.flatMap((r) => r.discovered);
    await enqueueUnseen(redis, seenKey, candidates, room);
  }

  return { pages: results.length, issues: issuesWritten };
}

/**
 * Add URLs to the frontier, skipping any already seen.
 *
 * SADD reports how many members were new, so the seen-set is both the dedupe
 * and the decision — no read-then-write race between concurrent batches.
 */
async function enqueueUnseen(
  redis: Redis,
  seenKey: string,
  candidates: { url: string; depth: number }[],
  room: number,
): Promise<void> {
  if (candidates.length === 0 || room <= 0) return;

  const queueKey = seenKey.replace(/:seen$/, ":queue");
  const batchSeen = new Set<string>();
  const toPush: string[] = [];

  for (const candidate of candidates) {
    if (toPush.length >= room) break;
    if (batchSeen.has(candidate.url)) continue;
    batchSeen.add(candidate.url);

    const added = await redis.sadd(seenKey, candidate.url);
    if (added === 1) {
      toPush.push(JSON.stringify({ url: candidate.url, depth: candidate.depth }));
    }
  }

  if (toPush.length > 0) {
    await redis.rpush(queueKey, ...toPush);
    await redis.expire(queueKey, REDIS_KEY_TTL_SECONDS);
    await redis.expire(seenKey, REDIS_KEY_TTL_SECONDS);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
