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
  /** Links to enqueue once the row is written. */
  discovered: { url: string; depth: number }[];
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

      const results = await processBatch(batch, rootUrl, robots, limiter);
      const written = await writeBatch(jobId, results, redis, keys.seen, job.urlCap, pagesCrawled);

      pagesCrawled += written.pages;
      issueCount += written.issues;

      // Progress is written every batch so the UI's 3s poll shows movement.
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { pagesCrawled, issueCount },
      });
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
        },
      })
      .catch((err) => logger.error({ jobId, err }, "site-crawl: final status write failed"));

    // The frontier is worthless once the crawl ends; TTL is the backstop for
    // a process that dies before reaching this line.
    await redis.del(keys.queue, keys.seen, keys.cancel).catch(() => {});
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
): Promise<PendingPage[]> {
  const results: PendingPage[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= batch.length) return;
      const item = batch[index]!;
      results.push(await crawlOne(item, rootUrl, robots, limiter));
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
    discovered: [],
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

  const discovered = (parsed?.links ?? [])
    .map((url) => normalizeCrawlUrl(url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => isInScope(url, rootUrl) && isFetchableUrl(url))
    .map((url) => ({ url, depth: item.depth + 1 }));

  return {
    ...base,
    statusCode: res.statusCode,
    redirectTarget: res.redirectTarget,
    contentType: res.contentType,
    fetchMs: res.fetchMs,
    parsed,
    issues,
    contentHash: parsed?.contentHash ?? null,
    discovered,
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
