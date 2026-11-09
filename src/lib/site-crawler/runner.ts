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
  FETCH_CONCURRENCY,
  MAX_ANCHOR_CHARS,
  MAX_CRAWL_DURATION_MS,
  MAX_IMG_SRCS_PER_PAGE,
  MAX_LINKS_PER_PAGE,
  MAX_EXTERNAL_LINKS_PER_PAGE,
  REDIS_KEY_TTL_SECONDS,
  WRITE_BATCH_SIZE,
  crawlKeys,
} from "./constants";
import { collectSitemapUrls, type SitemapResult } from "./sitemap";
import { aggregateCrawl } from "./aggregate";
import { RateLimiter, fetchPage, isHtmlContentType } from "./fetch";
import { DEFAULT_CRAWL_CONFIG, readStoredConfig, type RuntimeCrawlConfig } from "./crawl-config";
import { openCrawlConfig } from "./crawl-config-secrets";
import { crawlSettings, resolveRobots, type CrawlSettings } from "./crawl-settings";
import { parsePage, type ParsedPage } from "./checks";
import { evaluatePageRules, type Issue, type PageFacts } from "@/lib/crawl-rules";
import { buildPageFacts, buildPageFactsAndText } from "./facts";
import { acceptedWords, acquireSpelling, checkSpelling } from "./spelling";
import { attachHeadChecks, type HeadCheckDeps } from "./head-checks";
import { issueRows, renderColumns, storedColumns } from "./stored";
import { RenderBudget, callSidecarRender } from "./render";
import { isRenderMode } from "./types";
import { flag } from "@/lib/flags";
import type { Validator as AmpValidator } from "amphtml-validator";
import { cookieHeaderFor, loadJar, saveJar, sidecarLogin, type JarCookie } from "./login";
import { LOGOUT_TEXT, LOGOUT_URL } from "./login-config";
/** Phase 4g: the visible text the AI and semantic steps read (their own truncation). */
const TEXT_SNIPPET_CHARS = 6_000;
import { snippetCode } from "./js-snippets";
import { ampValidator, validateAmp } from "./amp-validator";
import { renderedOnlyLinks } from "@/lib/crawl-rules";
import { fetchRobots, type RobotsRules } from "./robots";
import { closeCrawlSnapshots, openCrawlSnapshots } from "@/lib/page-archive/crawl";
import type { PageRunWriter } from "@/lib/page-archive/writer";
import { writeCrawlTables } from "./archive/engine";
import { isFetchableUrl, normalizeCrawlUrl } from "./url";
import type { RedirectHop } from "./fetch";
import { resolveLinkGraph } from "./link-graph";
import { compileExtraction, customFacts, type PageExtraction, type PageExtractor } from "./extraction";
import { segmentMatcher, type SegmentPage } from "./segments";
import { FREE_CRAWL_MAX_DURATION_MS, isFreeSource } from "./free-tenant";

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

/** Everything one page's crawl needs, fixed for the length of the crawl. */
interface CrawlCtx {
  rootUrl: string;
  /** The robots.txt rules the crawl obeys (spider mode). */
  robots: RobotsRules;
  /** Phase 4a list mode: every URL is fetched once, nothing is discovered. */
  listMode: boolean;
  /** The rules for a URL's host: the crawl's own in spider mode, each host's in list mode. */
  robotsFor: (url: string) => Promise<RobotsRules>;
  /** A custom robots.txt in test mode: judged, never obeyed. */
  robotsTest: RobotsRules | null;
  limiter: RateLimiter;
  /** Null when the crawl found no sitemap; otherwise membership per URL. */
  isInSitemap: ((url: string) => Promise<boolean>) | null;
  head: HeadCheckDeps;
  render: RenderBudget;
  spell: SpellCtx;
  settings: CrawlSettings;
  /** Phase 4b custom extraction and search; null when the crawl has neither. */
  extract: PageExtractor | null;
  /** Phase 4b: the segments a page falls in (indexes into config.segments); null when the crawl has none. */
  segmentsOf: ((page: SegmentPage) => number[]) | null;
  /** Phase 4e: the official AMP validator, loaded on the first AMP page (null = unavailable); null when crawl.amp is off. */
  amp: (() => Promise<AmpValidator | null>) | null;
  /** Phase 4e: the crawl is logged in — logout links and rel=nofollow links are never followed. */
  loggedIn: boolean;
  /** Phase 4g: keep each page's visible text (AI prompts or semantic duplicates opted in). */
  keepText: boolean;
  /** The page archive (ECHORANK-DATA-ARCHIVE.md 1b); null when off. add() never waits. */
  snapshots: PageRunWriter | null;
}

/** The job's stored config, decrypted; the defaults for a pre-4a job. */
function runtimeConfig(raw: unknown): RuntimeCrawlConfig {
  const stored = readStoredConfig(raw);
  return stored ? openCrawlConfig(stored) : { ...DEFAULT_CRAWL_CONFIG };
}

/** A frontier entry. `from` is the page that linked here first (absent for the root and seeds). */
interface FrontierItem {
  url: string;
  depth: number;
  from?: string;
}

/** One internal link edge, before its source page has an id. */
interface PendingEdge {
  toUrl: string;
  anchor: string | null;
  nofollow: boolean;
  position: number;
  /** Phase 4g: an outbound link; never resolved to a page id. */
  isExternal?: boolean;
}

/** One page's fetch+parse result, held only until the batch is written. */
interface PendingPage {
  url: string;
  depth: number;
  /** Phase 4a: the discoverer, every redirect hop, image srcs, Last-Modified, outgoing edges. */
  foundOn: string | null;
  redirectChain: RedirectHop[] | null;
  imgSrcs: string[];
  lastModified: string | null;
  edges: PendingEdge[];
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
  /** Phase 4b: extractor index → values, and search hits (null = no searches configured). */
  extracted: Map<number, string[]>;
  /** Phase 4e: custom JavaScript values, one per snippet, on rendered pages only. */
  jsValues: string[] | null;
  /** Phase 4g: visible text for the post-crawl AI / semantic steps; null unless kept. */
  textSnippet: string | null;
  searchHits: Record<string, number> | null;
  /** Phase 4b: indexes into config.segments. */
  segmentIds: number[];
  /** Links to enqueue once the row is written. */
  discovered: FrontierItem[];
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
      config: true,
      mode: true,
    },
  });
  if (!job) throw new Error(`CrawlJob ${jobId} not found`);
  const listMode = job.mode === "list";

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
    .findUnique({ where: { id: job.tenantId }, select: { name: true, spellingAcceptedWords: true, source: true } })
    .catch(() => null);
  // The free public crawler (free-tenant.ts): a 10-minute ceiling and raw HTML only.
  const free = isFreeSource(tenant?.source);
  const maxDurationMs = free ? FREE_CRAWL_MAX_DURATION_MS : MAX_CRAWL_DURATION_MS;
  const spell: SpellCtx = {
    accepted: acceptedWords(tenant?.spellingAcceptedWords ?? [], tenant?.name ?? "", job.rootUrl),
    rootLang: null,
  };
  // Phase 4e: the custom JavaScript snippets ride every render call (set once the config is open).
  let snippetCodes: string[] = [];
  // Phase 4e forms login: the session (cookies) for the login host, and what the crawl header says.
  let jar: JarCookie[] | null = null;
  let loginState: { status: "ok" | "failed"; reason?: string } | null = null;
  const render = new RenderBudget(
    !free && isRenderMode(job.renderMode) ? job.renderMode : "none",
    job.renderCap,
    job.pagesRendered,
    (url) => callSidecarRender(url, fetch, snippetCodes, jar ?? []),
  );
  // Released in the finally below: the dictionaries (600 MB for French) are
  // dropped once no crawl in this process holds them.
  const releaseSpelling = acquireSpelling();
  // The page archive (ECHORANK-DATA-ARCHIVE.md 1b): every page fetched, copied
  // to Spaces as the crawl goes. Null when off, unconfigured, or the free crawler.
  const archived = openCrawlSnapshots({ id: jobId, tenantId: job.tenantId, free });
  const snapshots = archived?.writer ?? null;

  try {
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const rootUrl = job.rootUrl;
    // Phase 4a configuration. Decrypted here, inside the try: a key that
    // cannot open the secrets fails the job rather than crawling without them.
    const cfg = runtimeConfig(job.config);
    const settings = crawlSettings(cfg, rootUrl);
    snippetCodes = flag("crawl.customJs") ? (cfg.js ?? []).map(snippetCode) : [];
    // Once per crawl (a retried job reuses the session in Redis). A failed
    // login is not fatal: the crawl runs unauthenticated and says so.
    if (cfg.login && flag("crawl.login")) {
      const loginHost = new URL(cfg.login.loginUrl).hostname.toLowerCase();
      jar = await loadJar(redis, jobId);
      if (!jar) {
        const out = await sidecarLogin(cfg.login, settings.userAgent);
        if (out.ok) {
          jar = out.cookies;
          await saveJar(redis, jobId, jar);
        } else {
          loginState = { status: "failed", reason: out.reason };
        }
      }
      if (jar) {
        const session = jar;
        settings.fetchOpts.cookiesFor = (u) => cookieHeaderFor(session, loginHost, u);
      }
      const state: { status: "ok" | "failed"; reason?: string } = jar ? { status: "ok" } : (loginState ?? { status: "failed", reason: "sidecar_unavailable" });
      loginState = state;
      await prisma.crawlJob.update({ where: { id: jobId }, data: { summary: { login: state } as object } });
      logger.info({ jobId, login: state.status, reason: state.reason ?? null }, "site-crawl login");
    }
    const live = await fetchRobots(rootUrl, { userAgent: settings.userAgent, agent: settings.agent });
    const { obey: robots, test: robotsTest } = resolveRobots(
      live,
      cfg,
      new URL("/robots.txt", rootUrl).toString(),
      settings.agent,
    );
    const limiter = new RateLimiter(cfg.speed, robots.crawlDelaySeconds * 1000);

    logger.info(
      {
        jobId,
        rootUrl,
        urlCap: job.urlCap,
        crawlDelay: robots.crawlDelaySeconds,
        robotsAllowAll: robots.allowAll,
        ua: settings.userAgent,
        respectRobots: cfg.respectRobots,
        customRobots: cfg.customRobots ? (cfg.customRobotsMode ?? "test") : null,
        // Which options are set, never their values.
        credentials: Boolean(settings.fetchOpts.extraHeaders),
        renderMode: render.mode,
        renderCap: render.cap,
      },
      "site-crawl started",
    );

    // Seed. SADD returns 0 if the root was already seen, which happens only on
    // a retry of the same job — the frontier is authoritative either way.
    // List mode was seeded by the service with the whole list; nothing to add.
    if (!listMode) {
      await redis.sadd(keys.seen, rootUrl);
      await redis.rpush(keys.queue, JSON.stringify({ url: rootUrl, depth: 0 }));
      await redis.expire(keys.seen, REDIS_KEY_TTL_SECONDS);
      await redis.expire(keys.queue, REDIS_KEY_TTL_SECONDS);
    }

    // ── Sitemap ─────────────────────────────────────────────────────────
    // Fetched after robots.txt because robots is where the Sitemap: lines
    // live. Failure is not fatal: a site with no sitemap crawls exactly as it
    // did in Phase 1, and the summary records that none was found. Not read
    // in list mode: the list is the whole job.
    if (!listMode) {
      sitemap = await collectSitemapUrls({
        rootUrl,
        declared: robots.sitemaps,
        limiter,
      });
    }

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
      for (const raw of sitemap.urls) {
        if (seeds.length >= seedRoom) break;
        const url = settings.admit(raw);
        if (!url) continue;
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

    const ctx: CrawlCtx = {
      rootUrl,
      robots,
      // List mode obeys each host's own live robots.txt; a draft speaks for the root's host only.
      robotsTest: listMode ? null : robotsTest,
      listMode,
      robotsFor: listMode
        ? robotsCache((origin) =>
            origin === listRoot(rootUrl)
              ? Promise.resolve(robots)
              : fetchRobots(origin, { userAgent: settings.userAgent, agent: settings.agent }),
          )
        : async () => robots,
      limiter,
      isInSitemap,
      head: { redis, cacheKey: keys.headCache, limiter },
      render,
      spell,
      settings,
      extract: compileExtraction(cfg.extractors ?? [], cfg.searches ?? []),
      segmentsOf: cfg.segments?.length ? segmentMatcher(cfg.segments) : null,
      amp: flag("crawl.amp") ? () => ampValidator() : null,
      loggedIn: jar !== null,
      keepText: Boolean((cfg.ai && flag("crawl.ai")) || (cfg.semantic && flag("crawl.semantic"))),
      snapshots,
    };

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
      if (now() - startedAt >= maxDurationMs) {
        stoppedReason = "time_cap";
        break;
      }

      const remaining = job.urlCap - pagesCrawled;
      const batchSize = Math.min(WRITE_BATCH_SIZE, remaining);
      const batch = await popBatch(redis, keys.queue, batchSize);
      if (batch.length === 0) {
        // A list-mode job that finds no list: it sat queued past the frontier TTL.
        if (listMode && pagesCrawled === 0) stoppedReason = "list_expired";
        break; // frontier exhausted — the clean ending
      }

      const results = await processBatch(batch, ctx);
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
        await resolveLinkGraph(jobId);
        const result = await aggregateCrawl({
          jobId,
          rootUrl: job.rootUrl,
          redis,
          sitemap,
          sitemapSeeded,
          sitemapDeclaredInRobots: robots.sitemaps.length > 0,
          tenantId: job.tenantId,
          listMode,
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
    releaseSpelling();
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
          ...(summary === undefined && !loginState ? {} : { summary: (loginState ? { ...((summary as object | undefined) ?? {}), login: loginState } : summary) as never }),
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
        keys.login,
      )
      .catch(() => {});
  }

  // The page archive: the last uploads, the manifest, and (COMPLETED) a copy
  // of the tables. After the terminal status, so the crawl is done on screen.
  if (archived) await closeCrawlSnapshots(archived, { id: jobId, tenantId: job.tenantId, status }, writeCrawlTables);

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
async function popBatch(redis: Redis, queueKey: string, count: number): Promise<FrontierItem[]> {
  if (count <= 0) return [];
  const raw = await redis.lpop(queueKey, count);
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];

  const out: FrontierItem[] = [];
  for (const entry of items) {
    try {
      const parsed = JSON.parse(entry) as FrontierItem;
      if (typeof parsed?.url === "string") {
        out.push({
          url: parsed.url,
          depth: Number(parsed.depth) || 0,
          ...(typeof parsed.from === "string" ? { from: parsed.from } : {}),
        });
      }
    } catch {
      // A malformed frontier entry is dropped rather than failing the crawl.
    }
  }
  return out;
}

/** Fetch and parse one batch, at most FETCH_CONCURRENCY at a time. */
async function processBatch(batch: FrontierItem[], ctx: CrawlCtx): Promise<PendingPage[]> {
  const results: PendingPage[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= batch.length) return;
      const item = batch[index]!;
      const result = await crawlOne(item, ctx);
      // Segments are judged on the finished page: URL, depth, status, extracted values.
      if (ctx.segmentsOf) {
        result.segmentIds = ctx.segmentsOf({
          url: result.url,
          depth: result.depth,
          statusCode: result.statusCode,
          extracted: result.extracted,
        });
      }
      results.push(result);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, batch.length) }, worker),
  );
  return results;
}

async function crawlOne(item: FrontierItem, ctx: CrawlCtx): Promise<PendingPage> {
  const { robotsTest, limiter, isInSitemap, head, render, spell, settings } = ctx;
  // In list mode every URL is its own site: internal vs external, and which
  // robots.txt applies, are judged against the URL's own origin.
  const rootUrl = ctx.listMode ? listRoot(item.url) : ctx.rootUrl;
  const robots = await ctx.robotsFor(rootUrl);
  const base: PendingPage = {
    url: item.url,
    depth: item.depth,
    foundOn: item.from ?? null,
    redirectChain: null,
    imgSrcs: [],
    lastModified: null,
    edges: [],
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
    extracted: new Map(),
    jsValues: null,
    textSnippet: null,
    searchHits: null,
    segmentIds: [],
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
    if (robotsTest) facts.robotsTest = judgeDraft(robots, robotsTest, item.url);
    return { ...base, issues: evaluatePageRules(facts) };
  }

  // Second line behind scope: never open a socket to a private address.
  if (!isFetchableUrl(item.url)) return base;

  const inSitemap = isInSitemap ? await isInSitemap(item.url) : null;

  await limiter.acquire();
  const res = await fetchPage(item.url, settings.fetchOpts);

  const isHtml = isHtmlContentType(res.contentType) && res.html !== null;
  // Custom extraction runs on the document parsePage loads, not a second parse.
  let extraction: PageExtraction | null = null;
  const extract = ctx.extract;
  const parsed = isHtml
    ? parsePage(res.html!, res.finalUrl, rootUrl, extract ? ($) => void (extraction = extract.run($, res.html!)) : undefined)
    : null;
  const ex = extraction as PageExtraction | null;
  if (ex?.timedOut) logger.info({ url: item.url }, "site-crawl regex budget spent on page");

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
  if (extract && ex) facts.custom = customFacts(extract, ex);
  await attachHeadChecks(facts, rootUrl, head);
  if (robotsTest) facts.robotsTest = judgeDraft(robots, robotsTest, item.url);
  const renderOut = ctx.snapshots ? await render.maybeRenderWithHtml(facts) : null;
  const rendered = ctx.snapshots ? (renderOut?.facts ?? null) : await render.maybeRender(facts);
  if (rendered) facts.render = rendered;
  // The page archive: a copy of what was fetched, queued and never awaited.
  // A logged-in crawl keeps metadata only (owner's decision 2026-11-09);
  // a non-HTML body is never read, so it is metadata only too.
  ctx.snapshots?.add({
    url: item.url,
    finalUrl: res.finalUrl,
    status: res.statusCode,
    contentType: res.contentType,
    headers: res.responseHeaders ?? res.headers,
    fetchedAt: new Date().toISOString(),
    raw: isHtml ? { html: res.html! } : null,
    rendered: renderOut?.html ? { html: renderOut.html } : null,
    renderedStatus: renderOut?.status ?? null,
    skipped: ctx.loggedIn ? "login_crawl" : isHtml ? null : res.statusCode === null ? "fetch_failed" : "not_html",
  });
  // Phase 4e: an AMP document is validated on its raw HTML, as AMP caches see it.
  if (ctx.amp && facts.html?.isAmp && isHtml) {
    const validator = await ctx.amp();
    if (validator) {
      try {
        facts.amp = validateAmp(validator, res.html!);
      } catch (err) {
        logger.warn({ url: item.url, err: err instanceof Error ? err.message : String(err) }, "site-crawl amp validation failed");
      }
    }
  }

  if (facts.html && item.url === rootUrl) spell.rootLang = facts.html.langAttr;
  if (text && facts.html && facts.statusCode !== null && facts.statusCode >= 200 && facts.statusCode < 300) {
    const spelling = await checkSpelling(text, facts.html.langAttr ?? spell.rootLang, spell.accepted).catch(() => null);
    if (spelling) facts.spelling = spelling;
  }

  const issues = evaluatePageRules(facts, {
    capabilities: [...(render.enabled ? (["render", "spell"] as const) : (["spell"] as const)), ...(facts.amp ? (["amp"] as const) : [])],
  });

  // Links that exist only after JavaScript are links a rendering crawler
  // follows, so a rendered page's discovery (and the inlink credit it gives)
  // includes them.
  const jsLinks = facts.html && facts.render?.html ? renderedOnlyLinks(facts.html, facts.render.html) : [];

  // parsePage already dedupes hrefs per page, so this set is the "one credit
  // per source page" rule the inlink count needs.
  const admitAll = (urls: string[]) => [
    ...new Set(
      urls
        .map((url) => normalizeCrawlUrl(url))
        .filter((url): url is string => Boolean(url))
        .map(settings.admit)
        .filter((url): url is string => Boolean(url)),
    ),
  ];
  const linkTargets = admitAll([...(parsed?.links ?? []), ...jsLinks]);
  // rel=nofollow targets are crawled only when the configuration says so;
  // they never earn a followed-inlink credit either way.
  // Phase 4e: a logged-in crawl never follows a rel=nofollow link, whatever the configuration says.
  const nofollowFollowed = settings.followNofollow && !ctx.loggedIn ? admitAll(parsed?.nofollowLinks ?? []) : [];
  // …nor a logout link (by URL or anchor text): following one would end the session.
  const logout = ctx.loggedIn ? logoutTargets(facts) : null;
  const deeper = settings.maxDepth === null || item.depth + 1 <= settings.maxDepth;

  return {
    ...base,
    redirectChain: res.chain.length ? [...res.chain, { url: res.finalUrl, status: res.statusCode ?? 0 }] : null,
    imgSrcs: imageSrcs(facts),
    lastModified: res.lastModified ? res.lastModified.slice(0, 64) : null,
    edges: linkEdges(facts, settings),
    statusCode: res.statusCode,
    redirectTarget: res.redirectTarget,
    contentType: res.contentType,
    fetchMs: res.fetchMs,
    parsed,
    issues,
    stored: { ...storedColumns(facts), ampHtml: ampKey(facts, settings) },
    rendered: renderColumns(facts),
    contentHash: parsed?.contentHash ?? null,
    inSitemap,
    extracted: ex?.values ?? new Map(),
    jsValues: facts.render?.snippets ?? null,
    textSnippet:
      ctx.keepText && text && facts.html && facts.statusCode !== null && facts.statusCode >= 200 && facts.statusCode < 300
        ? text.slice(0, TEXT_SNIPPET_CHARS) || null
        : null,
    searchHits: ex?.searchHits ?? null,
    discovered: deeper && !ctx.listMode
      ? [...linkTargets, ...nofollowFollowed, ...annotationTargets(facts, linkTargets, settings)]
          .filter((url) => !logout || (!logout.has(url) && !LOGOUT_URL.test(url)))
          .map((url) => ({
            url,
            depth: item.depth + 1,
            from: item.url,
          }))
      : [],
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
function annotationTargets(facts: PageFacts, linkTargets: string[], settings: CrawlSettings): string[] {
  const h = facts.html;
  if (!h) return [];
  const seen = new Set(linkTargets);
  const out: string[] = [];
  // Phase 4e: rel=amphtml targets too; they count against the crawl's URL cap like any page.
  for (const raw of [...h.hreflang.map((x) => x.href), ...h.canonicals, ...h.relNext, ...h.relPrev, ...(h.amphtml ?? [])]) {
    const normalized = normalizeCrawlUrl(raw, facts.finalUrl);
    const url = normalized ? settings.admit(normalized) : null;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Phase 4e: links a logged-in crawl must not follow — logout by URL or anchor text, and every rel=nofollow link. */
function logoutTargets(facts: PageFacts): Set<string> {
  const out = new Set<string>();
  for (const a of facts.html?.anchors ?? []) {
    if (LOGOUT_URL.test(a.href) || LOGOUT_TEXT.test(a.text) || /\bnofollow\b/i.test(a.rel)) {
      const u = normalizeCrawlUrl(a.href, facts.finalUrl);
      if (u) out.add(u);
    }
  }
  return out;
}

/** Phase 4e: the first rel=amphtml target keyed like a crawled URL (so it joins that row), or null. */
function ampKey(facts: PageFacts, settings: CrawlSettings): string | null {
  const raw = facts.html?.amphtml?.[0];
  const normalized = raw ? normalizeCrawlUrl(raw, facts.finalUrl) : null;
  return normalized ? settings.canonical(normalized) : null;
}

/**
 * The page's internal link edges: one per distinct target, the first anchor
 * that points there (its text and position), capped at MAX_LINKS_PER_PAGE.
 * Targets are keyed like crawled URLs, so aggregation can join them to pages.
 */
function linkEdges(facts: PageFacts, settings: CrawlSettings): PendingEdge[] {
  const out: PendingEdge[] = [];
  const seen = new Set<string>();
  // Phase 4g: outbound links too, deduped per URL, at most MAX_EXTERNAL_LINKS_PER_PAGE.
  const external: PendingEdge[] = [];
  const seenExternal = new Set<string>();
  const keepExternal = flag("crawl.externalLinks");
  for (const [position, a] of (facts.html?.anchors ?? []).entries()) {
    const normalized = normalizeCrawlUrl(a.href, facts.finalUrl);
    if (!normalized) continue;
    if (!settings.inScope(normalized)) {
      if (keepExternal && external.length < MAX_EXTERNAL_LINKS_PER_PAGE && /^https?:\/\//i.test(normalized) && !seenExternal.has(normalized)) {
        seenExternal.add(normalized);
        external.push({
          toUrl: normalized,
          anchor: a.text ? a.text.slice(0, MAX_ANCHOR_CHARS) : null,
          nofollow: a.rel.split(/\s+/).includes("nofollow"),
          position: Math.min(position, 32_767),
          isExternal: true,
        });
      }
      continue;
    }
    if (out.length >= MAX_LINKS_PER_PAGE) continue;
    const toUrl = settings.canonical(normalized);
    if (seen.has(toUrl)) continue;
    seen.add(toUrl);
    out.push({
      toUrl,
      anchor: a.text ? a.text.slice(0, MAX_ANCHOR_CHARS) : null,
      nofollow: a.rel.split(/\s+/).includes("nofollow"),
      position: Math.min(position, 32_767),
    });
  }
  return [...out, ...external];
}

/** Absolute http(s) <img> srcs, deduped, capped (image sitemap). */
function imageSrcs(facts: PageFacts): string[] {
  const out = new Set<string>();
  for (const img of facts.html?.images ?? []) {
    if (out.size >= MAX_IMG_SRCS_PER_PAGE) break;
    if (/^https?:\/\//i.test(img.src) && img.src.length <= 2000) out.add(img.src);
  }
  return [...out];
}

/** "https://a.example/x?y" → "https://a.example/". */
function listRoot(url: string): string {
  try {
    return `${new URL(url).origin}/`;
  } catch {
    return url;
  }
}

/** Hosts whose robots.txt a list-mode crawl keeps in memory. A longer list refetches. */
const ROBOTS_CACHE_HOSTS = 200;

/** One robots.txt fetch per host for a list-mode crawl. */
function robotsCache(load: (origin: string) => Promise<RobotsRules>): (rootUrl: string) => Promise<RobotsRules> {
  const cache = new Map<string, Promise<RobotsRules>>();
  return (rootUrl) => {
    let rules = cache.get(rootUrl);
    if (!rules) {
      if (cache.size >= ROBOTS_CACHE_HOSTS) cache.clear();
      rules = load(rootUrl);
      cache.set(rootUrl, rules);
    }
    return rules;
  };
}

/** How the live file and the draft judge one URL (custom robots.txt, test mode). */
function judgeDraft(live: RobotsRules, draft: RobotsRules, url: string) {
  return {
    liveAllowed: live.isAllowed(url),
    customAllowed: draft.isAllowed(url),
    liveLine: live.matchLine?.(url) ?? null,
    customLine: draft.matchLine(url),
  };
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

      const page = await tx.crawlPage.create({
        data: {
          crawlJobId: jobId,
          url: result.url,
          foundOn: result.foundOn,
          redirectChain: result.redirectChain ? (result.redirectChain as unknown as object[]) : undefined,
          imgSrcs: result.imgSrcs,
          lastModified: result.lastModified,
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
          searchHits: result.searchHits ?? undefined,
          segmentIds: result.segmentIds,
          ...(result.textSnippet ? { textSnippet: result.textSnippet } : {}),
          issues: { create: issues },
        },
        select: { id: true },
      });
      if (result.extracted.size) {
        await tx.crawlExtraction.createMany({
          data: [...result.extracted].map(([extractorIndex, values]) => ({ crawlJobId: jobId, pageId: page.id, extractorIndex, values })),
        });
      }
      if (result.jsValues?.length) {
        await tx.crawlExtraction.createMany({
          data: result.jsValues.map((v, extractorIndex) => ({ crawlJobId: jobId, pageId: page.id, kind: "js" as const, extractorIndex, values: [v] })),
        });
      }
      if (result.edges.length) {
        await tx.crawlLink.createMany({
          data: result.edges.map((e) => ({ crawlJobId: jobId, fromPageId: page.id, ...e })),
        });
      }

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
async function enqueueUnseen(redis: Redis, seenKey: string, candidates: FrontierItem[], room: number): Promise<void> {
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
      toPush.push(JSON.stringify(candidate));
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
