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
import { recordResearch } from "@/lib/research-log/store";
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
import { parsePage, type ParsedPage } from "./checks";
import { evaluatePageRules, type Issue, type PageFacts } from "@/lib/crawl-rules";
import { buildPageFacts, buildPageFactsAndText } from "./facts";
import { acceptedWords, checkSpelling } from "./spelling";
import { attachHeadChecks, type HeadCheckDeps } from "./head-checks";
import { issueRows, renderColumns, storedColumns } from "./stored";
import { RenderBudget } from "./render";
import { isRenderMode } from "./types";
import { renderedOnlyLinks } from "@/lib/crawl-rules";
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

/** Per-crawl spell-check context. rootLang is filled once the root page is parsed. */
interface SpellCtx {
  accepted: Set<string>;
  rootLang: string | null;
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
  /** Page-scope rule findings (packages/crawl-rules). */
  issues: Issue[];
  /** The Phase 3a stored-fact columns; null when nothing was fetched. */
  stored: ReturnType<typeof storedColumns> | null;
  /** The Phase 3b render columns; null/empty when the page was not rendered. */
  rendered: ReturnType<typeof renderColumns> | null;
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
  /** Distinct in-scope rel=nofollow targets: the nofollow-inlink credit. */
  nofollowTargets: string[];
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
    // tenantId is here for the Research Log write at the end. It is not used
    // to scope anything: the job id came from a tenant-scoped route, and the
    // worker is running that job, not looking one up.
    select: {
      id: true,
      tenantId: true,
      rootUrl: true,
      urlCap: true,
      status: true,
      renderMode: true,
      renderCap: true,
      pagesRendered: true,
    },
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
  // Spell check (Phase 3c): the workspace's accepted words, and the root
  // page's language as the fallback for pages that do not declare one.
  const tenant = await prisma.tenant
    .findUnique({ where: { id: job.tenantId }, select: { name: true, spellingAcceptedWords: true } })
    .catch(() => null);
  const spell: SpellCtx = {
    accepted: acceptedWords(tenant?.spellingAcceptedWords ?? [], tenant?.name ?? "", job.rootUrl),
    rootLang: null,
  };
  const render = new RenderBudget(
    isRenderMode(job.renderMode) ? job.renderMode : "none",
    job.renderCap,
    job.pagesRendered,
  );

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
        renderMode: render.mode,
        renderCap: render.cap,
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

      const results = await processBatch(batch, rootUrl, robots, limiter, isInSitemap, {
        redis,
        cacheKey: keys.headCache,
        limiter,
      }, render, spell);
      const written = await writeBatch(jobId, results, redis, keys.seen, job.urlCap, pagesCrawled);

      pagesCrawled += written.pages;
      issueCount += written.issues;

      // Progress is written every batch so the UI's 3s poll shows movement.
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { pagesCrawled, issueCount, pagesRendered: job.pagesRendered + render.rendered },
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
          rootUrl: job.rootUrl,
          redis,
          sitemap,
          sitemapSeeded,
          sitemapDeclaredInRobots: robots.sitemaps.length > 0,
          tenantId: job.tenantId,
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
          pagesRendered: job.pagesRendered + render.rendered,
          ...(summary === undefined ? {} : { summary: summary as never }),
        },
      })
      .catch((err) => logger.error({ jobId, err }, "site-crawl: final status write failed"));

    // The frontier is worthless once the crawl ends; TTL is the backstop for
    // a process that dies before reaching this line.
    await redis
      .del(
        keys.queue,
        keys.seen,
        keys.cancel,
        keys.inlinks,
        keys.sitemap,
        keys.nofollowInlinks,
        keys.firstSource,
        keys.headCache,
      )
      .catch(() => {});
  }

  // Research Log — COMPLETED crawls only, including cap- and time-capped ones
  // (a partial crawl's findings are still findings, which is the same call the
  // aggregation step above makes). CANCELLED and FAILED runs record nothing:
  // the log answers "has this workspace already researched this", and a crawl
  // that produced no usable page set has not.
  //
  // costUsd is 0 and that is correct, not a placeholder — the crawler fetches
  // pages itself and buys nothing from DataForSEO. The entry still earns its
  // place: knowing a site was crawled two days ago is what stops the next
  // agent starting a second one.
  if (status === "COMPLETED") {
    await recordResearch({
      tenantId: job.tenantId,
      feature: "site_crawl",
      target: job.rootUrl,
      metrics: { pagesCrawled, issues: issueCount, urlCap: job.urlCap },
      costUsd: 0,
      sourceRef: jobId,
    });
  }

  logger.info(
    {
      jobId,
      status,
      pagesCrawled,
      issueCount,
      stoppedReason,
      rendered: render.rendered,
      renderFailed: render.failed,
      renderStopped: render.stopped,
    },
    "site-crawl finished",
  );
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
  head: HeadCheckDeps,
  render: RenderBudget,
  spell: SpellCtx,
): Promise<PendingPage[]> {
  const results: PendingPage[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= batch.length) return;
      const item = batch[index]!;
      results.push(await crawlOne(item, rootUrl, robots, limiter, isInSitemap, head, render, spell));
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
  head: HeadCheckDeps,
  render: RenderBudget,
  spell: SpellCtx,
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
    stored: null,
    rendered: null,
    contentHash: null,
    inSitemap: null,
    discovered: [],
    linkTargets: [],
    nofollowTargets: [],
  };
  const factsBase = {
    url: item.url,
    rootUrl,
    depth: item.depth,
    redirectHops: 0,
    redirectTarget: null,
    contentType: null,
    responseMs: null,
    bytes: null,
    inSitemap: null,
    headers: {},
    html: null,
  };

  // Disallowed URLs are RECORDED, never fetched. The row exists so the tenant
  // can see what robots.txt is hiding from search engines too.
  if (!robots.isAllowed(item.url)) {
    const facts = buildPageFacts({
      ...factsBase,
      finalUrl: item.url,
      blockedByRobots: true,
      statusCode: null,
      fetchError: null,
    });
    return { ...base, issues: evaluatePageRules(facts) };
  }

  // Second line behind scope: never open a socket to a private address.
  if (!isFetchableUrl(item.url)) return base;

  const inSitemap = isInSitemap ? await isInSitemap(item.url) : null;

  await limiter.acquire();
  const res = await fetchPage(item.url);

  const isHtml = isHtmlContentType(res.contentType) && res.html !== null;
  const parsed = isHtml ? parsePage(res.html!, res.finalUrl, rootUrl) : null;

  // One PageFacts for the rule engine. The HTML string goes no further than
  // this call: facts are counts, flags, short strings and URLs. The visible
  // text is held only for the spell check below.
  const { facts, text } = buildPageFactsAndText({
    ...factsBase,
    finalUrl: res.finalUrl,
    blockedByRobots: false,
    statusCode: res.statusCode,
    fetchError: res.statusCode === null ? res.error : null,
    redirectHops: res.redirectHops,
    redirectTarget: res.redirectTarget,
    contentType: res.contentType,
    responseMs: res.fetchMs,
    bytes: res.bytes,
    inSitemap,
    headers: res.headers,
    html: isHtml ? res.html : null,
  });
  await attachHeadChecks(facts, rootUrl, head);
  const rendered = await render.maybeRender(facts);
  if (rendered) facts.render = rendered;

  if (facts.html && item.url === rootUrl) spell.rootLang = facts.html.langAttr;
  if (text && facts.html && facts.statusCode !== null && facts.statusCode >= 200 && facts.statusCode < 300) {
    const spelling = await checkSpelling(text, facts.html.langAttr ?? spell.rootLang, spell.accepted).catch(() => null);
    if (spelling) facts.spelling = spelling;
  }

  const issues = evaluatePageRules(facts, { capabilities: render.enabled ? ["render", "spell"] : ["spell"] });

  // Links that exist only after JavaScript are links a rendering crawler
  // follows, so a rendered page's discovery (and the inlink credit it gives)
  // includes them.
  const jsLinks = facts.html && facts.render?.html ? renderedOnlyLinks(facts.html, facts.render.html) : [];

  // parsePage already dedupes hrefs per page, so this set is the "one credit
  // per source page" rule the inlink count needs.
  const linkTargets = [
    ...new Set(
      [...(parsed?.links ?? []), ...jsLinks]
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
    stored: storedColumns(facts),
    rendered: renderColumns(facts),
    contentHash: parsed?.contentHash ?? null,
    inSitemap,
    discovered: [...linkTargets, ...annotationTargets(facts, linkTargets, rootUrl)].map((url) => ({
      url,
      depth: item.depth + 1,
    })),
    linkTargets,
    nofollowTargets: [...new Set(parsed?.nofollowLinks ?? [])],
  };
}

/**
 * URLs a page points at through annotations rather than anchors: hreflang
 * alternates, the canonical, rel next/prev. Crawled (in scope only) so the
 * site rules can judge them, but they earn no inlink credit — an annotation
 * is not a link a visitor can follow.
 */
function annotationTargets(facts: PageFacts, linkTargets: string[], rootUrl: string): string[] {
  const h = facts.html;
  if (!h) return [];
  const seen = new Set(linkTargets);
  const out: string[] = [];
  for (const raw of [...h.hreflang.map((x) => x.href), ...h.canonicals, ...h.relNext, ...h.relPrev]) {
    const url = normalizeCrawlUrl(raw, facts.finalUrl);
    if (!url || seen.has(url) || !isInScope(url, rootUrl) || !isFetchableUrl(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Write one batch and enqueue what it discovered.
 *
 * Page-scope findings only. Everything that needs the rest of the crawl
 * (duplicates, canonical/hreflang targets, orphans…) is a site rule and runs
 * once, in aggregation, over the complete page set.
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
      const issues = issueRows(result.issues, jobId);

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
          ...(result.stored ?? {}),
          ...(result.rendered ?? {}),
          simhash: result.parsed?.simhash ?? null,
          issues: { create: issues },
        },
      });

      issuesWritten += issues.length;
    }
  });

  // Credit inlinks in Redis rather than a link-edge table. One HINCRBY per
  // distinct (source page, target) pair — an edge table would carry an order
  // of magnitude more rows than the pages themselves.
  const credits = results.flatMap((r) => r.linkTargets);
  const nofollow = results.flatMap((r) => r.nofollowTargets);
  if (credits.length > 0 || nofollow.length > 0) {
    const keys = crawlKeys(jobId);
    const pipeline = redis.pipeline();
    for (const target of credits) pipeline.hincrby(keys.inlinks, target, 1);
    for (const target of nofollow) pipeline.hincrby(keys.nofollowInlinks, target, 1);
    // First page seen linking to each target: the source that gets the
    // links.outlinks_to_redirect credit when the target turns out to redirect.
    for (const r of results) for (const target of r.linkTargets) pipeline.hsetnx(keys.firstSource, target, r.url);
    for (const key of [keys.inlinks, keys.nofollowInlinks, keys.firstSource]) pipeline.expire(key, REDIS_KEY_TTL_SECONDS);
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
