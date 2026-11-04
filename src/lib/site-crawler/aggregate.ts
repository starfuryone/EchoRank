// src/lib/site-crawler/aggregate.ts
//
// The site-wide pass: everything that cannot be known from one page alone.
// Since Phase 3a it computes the facts the site-scope rules need
// (packages/crawl-rules PageSiteFacts / JobFacts), then runs those rules over
// every page row and writes their findings.
//
// NOTHING HERE LOADS THE PAGE SET INTO NODE. Each site fact is one SQL query
// that returns only the pages it applies to (duplicate groups, canonical
// targets, hreflang and pagination targets, near-duplicate pairs), held as
// id-keyed maps; the rules then run over a keyset scan of AGGREGATION_BATCH_SIZE
// rows at a time. A 25,000-URL crawl aggregates in roughly the memory a
// 25-URL one does, which is the constraint that shaped the crawl itself.
//
// IDEMPOTENT. Every site rule's rows for the job are deleted before writing,
// so running it twice yields the same rows.

import type Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import {
  RULES,
  evaluateSite,
  evaluateSiteRules,
  type Capability,
  type JobFacts,
  type PageSiteFacts,
  type RuleKind,
  type RulePriority,
} from "@/lib/crawl-rules";
import {
  AGGREGATION_BATCH_SIZE,
  MAX_CHAIN_WALK,
  SUMMARY_DEEPEST_LIMIT,
  SUMMARY_SAMPLE_LIMIT,
  crawlKeys,
} from "./constants";
import type { SitemapResult } from "./sitemap";
import type { SeverityCounts } from "./types";
import { issueRows, toStoredFacts } from "./stored";
import { psiFactsForUrls } from "./psi";
import { flag } from "@/lib/flags";
import { joinGsc, type GscJoinStatus } from "./gsc-join";
import { joinGa4, type Ga4JoinStatus } from "./ga4-join";
import { metricsForPages } from "./metrics";
import type { Ga4Metric, GscMetric } from "./metrics-shared";
import { toTotals } from "./issue-totals";
import { externalFacts, resolveExternalStatuses } from "./external-links";
import { computeLinkScores } from "./link-score";
import { priorityCounts, siteHealth, type SiteHealth } from "./site-health";

export interface AggregateArgs {
  jobId: string;
  rootUrl: string;
  redis: Redis;
  sitemap: SitemapResult;
  /** URLs the sitemap seeded into the frontier — the orphan candidates. */
  sitemapSeeded: Set<string>;
  /** robots.txt carried at least one Sitemap: line. */
  sitemapDeclaredInRobots?: boolean;
  /** Phase 3c: whose Lighthouse runs to attach. Absent = no performance rules. */
  tenantId?: string;
  /** Phase 4a list mode: no link graph, so the rules that read one are skipped. */
  listMode?: boolean;
}

/**
 * Site rules that judge a crawl's link graph or its sitemap: meaningless for a
 * pasted URL list, where nothing was discovered and every URL is "orphaned".
 */
const LIST_MODE_SKIPPED_FAMILIES = new Set(["links", "sitemaps"]);
const LIST_MODE_SKIPPED_RULES = new Set(["response_codes.inlinks_to_3xx", "hreflang.missing_on_multilingual_site"]);

export function keptInListMode(ruleId: string): boolean {
  return !LIST_MODE_SKIPPED_FAMILIES.has(ruleId.split(".")[0]!) && !LIST_MODE_SKIPPED_RULES.has(ruleId);
}

export interface RuleTally {
  count: number;
  kind: RuleKind;
  priority: RulePriority;
  /** Distinct pages with a finding of this rule (Fix first ranks by it). Absent on older summaries. */
  pages?: number;
}

export interface CrawlSummary {
  statusCodes: Record<string, number>;
  depths: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issuesByType: Record<string, number>;
  /**
   * issuesBySeverity in the fixed shape. Its presence is what tells
   * getIssueTotals the cache is current; older summaries fall back to a groupBy.
   */
  totals: SeverityCounts;
  /** Phase 3a: findings per rule id, and totals by kind. */
  issues?: Record<string, RuleTally>;
  issuesByKind?: Record<RuleKind, number>;
  duplicates: { title: number; metaDescription: number; content: number; nearContent?: number | null };
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
  /** Phase 3c: pages whose performance rules ran on an attached Lighthouse run. */
  psiPages?: number;
  /** Site health 0–100 (site-health.ts), with its inputs. Absent on crawls from before it. */
  health?: SiteHealth | null;
  /** Phase 4g: distinct external URLs, how many had their status resolved, and whether the resolve cap cut it short. */
  external?: { urls: number; checked: number; capped: boolean };
  /** Phase 4g: pages and followed internal edges Link Score ran over, and its bottom-decile threshold. */
  linkScore?: { pages: number; edges: number; p10: number | null };
  /** Phase 4d: what each joined source did on this crawl (absent = not attempted). */
  metrics?: { gsc?: GscJoinStatus; ga4?: Ga4JoinStatus };
  aggregationMs: number;
  aggregationError?: string;
}

export interface AggregateResult {
  summary: CrawlSummary;
  /** Total issues for the job after aggregation — replaces the running count. */
  issueCount: number;
}

const SITE_RULE_IDS = RULES.filter((r) => r.scope === "site").map((r) => r.id);

/** Near-duplicate pairing is quadratic in the worst case; it gets a budget, not a free hand. */
const NEAR_DUPLICATE_TIMEOUT_MS = 60_000;

export async function aggregateCrawl({
  jobId,
  rootUrl,
  redis,
  sitemap,
  sitemapSeeded,
  sitemapDeclaredInRobots = false,
  tenantId,
  listMode = false,
}: AggregateArgs): Promise<AggregateResult> {
  const started = Date.now();
  const keys = crawlKeys(jobId);

  // Wipe what this step owns, so a re-run cannot double it.
  await prisma.crawlIssue.deleteMany({ where: { crawlJobId: jobId, ruleId: { in: SITE_RULE_IDS } } });

  const inlinkStats = await flushInlinks(jobId, redis, keys.inlinks);
  await flushHash(jobId, redis, keys.nofollowInlinks, "nofollowInlinkCount");

  // Phase 4g: Link Score (PageRank over the resolved internal edges), before the site rules read it.
  const linkScore = flag("crawl.linkScore") ? await computeLinkScores(jobId) : null;
  // Phase 4g: each external URL's status, once per crawl, before the facts that read it.
  const external = flag("crawl.externalLinks") ? await resolveExternalStatuses(jobId, redis, keys.headCache) : null;
  const [dupTitle, dupMeta, dupH1, dupH2, dupContent, h1Title, canonicalTargets, hreflang, pagination, near, ampTargets, externalByPage] =
    await Promise.all([
      duplicateCounts(jobId, "title"),
      duplicateCounts(jobId, "metaDescription"),
      duplicateCounts(jobId, "h1First"),
      duplicateCounts(jobId, "h2First"),
      duplicateCounts(jobId, "contentHash"),
      h1MatchesOtherTitle(jobId),
      canonicalTargetFacts(jobId),
      hreflangFacts(jobId),
      paginationFacts(jobId),
      nearDuplicates(jobId),
      ampTargetFacts(jobId),
      external ? externalFacts(jobId) : Promise.resolve(new Map<string, NonNullable<PageSiteFacts["external"]>>()),
    ]);
  const redirects = await walkRedirects(jobId, redis, keys.firstSource);
  const orphans = await findOrphans(jobId, sitemapSeeded);
  const notCrawled = await sitemapNotCrawled(jobId, sitemap);

  const job: JobFacts = {
    pagesCrawled: await prisma.crawlPage.count({ where: { crawlJobId: jobId } }),
    langsSeen: await langsSeen(jobId),
    sitemap: {
      found: sitemap.found,
      urlCount: sitemap.urls.length,
      largestFileUrls: sitemap.largestFileUrls ?? sitemap.urls.length,
      notCrawled: notCrawled.count,
      notCrawledSample: notCrawled.sample[0] ?? null,
      declaredInRobots: sitemapDeclaredInRobots,
    },
    ...(linkScore ? { linkScoreP10: linkScore.p10 } : {}),
  };

  // ── Phase 4d: joined data, stored before the site rules so they read it ──
  const metricsStatus: NonNullable<CrawlSummary["metrics"]> = {};
  const joined: Capability[] = [];
  if (tenantId && flag("crawl.gsc")) {
    const gsc: GscJoinStatus = await joinGsc(jobId, tenantId, rootUrl).catch((err: unknown) => ({
      status: "failed" as const,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    }));
    metricsStatus.gsc = gsc;
    if (gsc.status === "ok") joined.push("gsc");
  }
  if (tenantId && flag("crawl.ga4")) {
    const ga4: Ga4JoinStatus = await joinGa4(jobId, tenantId, rootUrl).catch((err: unknown) => ({
      status: "failed" as const,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    }));
    metricsStatus.ga4 = ga4;
    if (ga4.status === "ok") joined.push("ga4");
  }

  // ── Run the site rules over every page, one keyset window at a time ──────
  const rootKey = rootUrl.replace(/\/+$/, "");
  let cursor: string | undefined;
  /** Pages with a Lighthouse run attached (Phase 3c). */
  let psiPages = 0;
  for (;;) {
    const batch = await prisma.crawlPage.findMany({
      where: { crawlJobId: jobId },
      select: {
        id: true, url: true, depth: true, statusCode: true, redirectTarget: true, contentType: true,
        title: true, metaDescription: true, h1First: true, h2First: true, canonical: true,
        canonicalHeader: true, noindex: true, metaRobots: true, inSitemap: true, inlinkCount: true,
        nofollowInlinkCount: true, hreflang: true, langAttr: true, relNext: true, relPrev: true,
        ampHtml: true, isAmp: true, linkScore: true,
      },
      orderBy: { id: "asc" },
      take: AGGREGATION_BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;

    const psi = tenantId ? await psiFactsForUrls(tenantId, batch.map((p) => p.url)) : new Map();
    psiPages += psi.size;
    const metrics = joined.length ? await metricsForPages(batch.map((p) => p.id)) : new Map();
    // ga4.converting_page_has_issues: high-priority findings already on the page (page scope).
    const highByPage = joined.includes("ga4") ? await highPriorityByPage(batch.map((p) => p.id)) : new Map<string, number>();

    const rows = batch.flatMap((page) => {
      const site: PageSiteFacts = {
        duplicateTitleCount: dupTitle.get(page.id) ?? 1,
        duplicateMetaCount: dupMeta.get(page.id) ?? 1,
        duplicateH1Count: dupH1.get(page.id) ?? 1,
        duplicateH2Count: dupH2.get(page.id) ?? 1,
        duplicateContentCount: dupContent.get(page.id) ?? 1,
        nearDuplicateCount: near.pairs.get(page.id) ?? 0,
        h1MatchesOtherTitleCount: h1Title.get(page.id) ?? 0,
        nofollowInlinkCount: page.nofollowInlinkCount ?? 0,
        redirectLoop: redirects.loops.get(page.id) ?? null,
        outlinksToRedirect: redirects.toRedirect.get(page.url) ?? 0,
        orphan: orphans.has(page.id),
        canonicalTarget: canonicalTargets.get(page.id) ?? null,
        hreflang: hreflang.get(page.id) ?? {
          targets: 0, non200: 0, noindex: 0, notCanonical: 0, missingReturn: 0, langMismatch: 0, unlinked: 0, sample: null,
        },
        pagination: pagination.get(page.id) ?? { non200: 0, sequenceErrors: 0, sample: null },
        ampTarget: ampTargets.get(page.id) ?? null,
        external: externalByPage.get(page.id) ?? null,
      };
      const isRoot = page.url.replace(/\/+$/, "") === rootKey;
      const pagePsi = psi.get(page.url) ?? null;
      const m = metrics.get(page.id);
      const found = evaluateSiteRules(toStoredFacts(page, rootUrl), {
        capabilities: pagePsi ? ["psi", ...joined] : joined,
        metrics: {
          gsc: joined.includes("gsc") ? gscFacts(m?.gsc as GscMetric | undefined) : null,
          ga4: joined.includes("ga4") ? ga4Facts(m?.ga4 as Ga4Metric | undefined) : null,
          highPriorityIssues: highByPage.get(page.id) ?? 0,
        },
        site,
        job,
        isRoot,
        psi: pagePsi,
      });
      // Site-scope findings of this pass count too: re-ask the one GA4 rule with them included.
      const siteHigh = found.filter((f) => f.priority === "high").length;
      if (joined.includes("ga4") && siteHigh > 0 && !found.some((f) => f.ruleId === GA4_CONVERTING.id)) {
        const g = ga4Facts(m?.ga4 as Ga4Metric | undefined);
        found.push(
          ...evaluateSite([GA4_CONVERTING], toStoredFacts(page, rootUrl), {
            capabilities: joined,
            metrics: { ga4: g, highPriorityIssues: (highByPage.get(page.id) ?? 0) + siteHigh },
            site,
            job,
            isRoot,
          }),
        );
      }
      const kept = listMode ? found.filter((f) => keptInListMode(f.ruleId)) : found;
      return issueRows(kept, jobId).map((r) => ({ ...r, crawlPageId: page.id }));
    });
    for (let i = 0; i < rows.length; i += AGGREGATION_BATCH_SIZE) {
      await prisma.crawlIssue.createMany({ data: rows.slice(i, i + AGGREGATION_BATCH_SIZE) });
    }

    if (batch.length < AGGREGATION_BATCH_SIZE) break;
    cursor = batch[batch.length - 1]!.id;
  }

  const [statusCodes, depths, issuesBySeverity, issuesByType, ruleTallies, deepestPages, issueCount] = await Promise.all([
    distribution(jobId, "statusCode"),
    distribution(jobId, "depth"),
    issueDistribution(jobId, "severity"),
    issueDistribution(jobId, "type"),
    ruleTally(jobId),
    deepest(jobId),
    prisma.crawlIssue.count({ where: { crawlJobId: jobId } }),
  ]);

  const summary: CrawlSummary = {
    statusCodes,
    depths,
    issuesBySeverity,
    issuesByType,
    totals: toTotals(issuesBySeverity),
    issues: ruleTallies.issues,
    issuesByKind: ruleTallies.byKind,
    duplicates: {
      title: groupsOf(dupTitle),
      metaDescription: groupsOf(dupMeta),
      content: groupsOf(dupContent),
      nearContent: near.timedOut ? null : near.pages,
    },
    redirects: redirects.stats,
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
    psiPages,
    health: siteHealth(priorityCounts(ruleTallies.issues), job.pagesCrawled),
    ...(Object.keys(metricsStatus).length ? { metrics: metricsStatus } : {}),
    ...(external ? { external } : {}),
    ...(linkScore ? { linkScore } : {}),
    aggregationMs: Date.now() - started,
  };

  logger.info(
    { jobId, aggregationMs: summary.aggregationMs, issueCount, orphans: orphans.size, nearTimedOut: near.timedOut },
    "site-crawl aggregation complete",
  );

  return { summary, issueCount };
}

/**
 * Phase 4d: re-tally a finished crawl's issues into its summary after the
 * post-crawl metrics job added findings (PSI, backlinks). The same queries
 * aggregation runs, written over the summary's issue fields only.
 */
export async function recountIssues(jobId: string): Promise<{ issueCount: number }> {
  const [issuesBySeverity, issuesByType, ruleTallies, issueCount, job] = await Promise.all([
    issueDistribution(jobId, "severity"),
    issueDistribution(jobId, "type"),
    ruleTally(jobId),
    prisma.crawlIssue.count({ where: { crawlJobId: jobId } }),
    prisma.crawlJob.findUnique({ where: { id: jobId }, select: { summary: true, pagesCrawled: true } }),
  ]);
  const summary = {
    ...((job?.summary as object | null) ?? {}),
    issuesBySeverity,
    issuesByType,
    totals: toTotals(issuesBySeverity),
    issues: ruleTallies.issues,
    issuesByKind: ruleTallies.byKind,
    // Post-crawl steps add findings: health follows them.
    health: siteHealth(priorityCounts(ruleTallies.issues), job?.pagesCrawled ?? 0),
  };
  await prisma.crawlJob.update({ where: { id: jobId }, data: { issueCount, summary: summary as object } });
  return { issueCount };
}

const GA4_CONVERTING = RULES.find((r) => r.id === "ga4.converting_page_has_issues")!;

/** A page GA4 returned no row for had no sessions. */
export function ga4Facts(g: Ga4Metric | undefined) {
  return g ?? { sessions: 0, totalUsers: 0, engagementRate: 0, keyEvents: 0 };
}

/** Page-scope high-priority findings per page (written during the crawl). */
async function highPriorityByPage(pageIds: string[]): Promise<Map<string, number>> {
  const groups = await prisma.crawlIssue.groupBy({ by: ["crawlPageId"], where: { crawlPageId: { in: pageIds }, priority: "high" }, _count: { _all: true } });
  return new Map(groups.map((g) => [g.crawlPageId, g._count._all]));
}

/** A page GSC returned no row for had no clicks and no impressions. */
export function gscFacts(g: GscMetric | undefined) {
  return g ? { clicks: g.clicks, impressions: g.impressions, ctr: g.ctr, position: g.position } : { clicks: 0, impressions: 0, ctr: 0, position: null };
}

/** Distinct groups in a page→group-size map: sum over members of 1/size. */
function groupsOf(m: Map<string, number>): number {
  let n = 0;
  for (const size of m.values()) n += 1 / size;
  return Math.round(n);
}

/**
 * Move the Redis inlink hash into CrawlPage.inlinkCount.
 *
 * HSCAN rather than HGETALL: a 25,000-page site's hash is 25,000 fields, and
 * HGETALL would materialize all of them in one reply.
 */
async function flushInlinks(
  jobId: string,
  redis: Redis,
  inlinksKey: string,
): Promise<{ average: number; zeroCount: number; max: number }> {
  const max = await flushHash(jobId, redis, inlinksKey, "inlinkCount");

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

/**
 * HSCAN a url → count hash into one CrawlPage column, then 0-fill the rest so
 * "none" and "not yet computed" stay distinguishable. Returns the max count.
 */
async function flushHash(
  jobId: string,
  redis: Redis,
  key: string,
  field: "inlinkCount" | "nofollowInlinkCount",
): Promise<number> {
  let cursor = "0";
  let max = 0;
  do {
    const [next, flat] = await redis.hscan(key, cursor, "COUNT", 500);
    cursor = next;
    for (let i = 0; i < flat.length; i += 2) {
      const url = flat[i]!;
      const count = Number(flat[i + 1]) || 0;
      if (count > max) max = count;
      await prisma.crawlPage.updateMany({ where: { crawlJobId: jobId, url }, data: { [field]: count } });
    }
  } while (cursor !== "0");
  await prisma.crawlPage.updateMany({ where: { crawlJobId: jobId, [field]: null }, data: { [field]: 0 } });
  return max;
}

/**
 * page id → size of its group, for 200-status HTML pages sharing one value.
 * Only members of duplicated groups come back. Each branch names its column
 * as a literal — never interpolated — so this cannot become an injection point.
 */
async function duplicateCounts(
  jobId: string,
  field: "title" | "metaDescription" | "h1First" | "h2First" | "contentHash",
): Promise<Map<string, number>> {
  const where = (col: string) => `
    "crawlJobId" = $1 AND "statusCode" >= 200 AND "statusCode" < 300
    AND "contentType" LIKE 'text/html%' AND ${col} IS NOT NULL AND ${col} <> ''`;
  const sql = {
    title: `SELECT array_agg(id) AS ids FROM crawl_pages WHERE ${where("title")} GROUP BY title HAVING count(*) > 1`,
    metaDescription: `SELECT array_agg(id) AS ids FROM crawl_pages WHERE ${where('"metaDescription"')} GROUP BY "metaDescription" HAVING count(*) > 1`,
    h1First: `SELECT array_agg(id) AS ids FROM crawl_pages WHERE ${where('"h1First"')} GROUP BY "h1First" HAVING count(*) > 1`,
    h2First: `SELECT array_agg(id) AS ids FROM crawl_pages WHERE ${where('"h2First"')} GROUP BY "h2First" HAVING count(*) > 1`,
    contentHash: `SELECT array_agg(id) AS ids FROM crawl_pages WHERE ${where('"contentHash"')} GROUP BY "contentHash" HAVING count(*) > 1`,
  }[field];
  const rows = await prisma.$queryRawUnsafe<{ ids: string[] }[]>(sql, jobId);
  const out = new Map<string, number>();
  for (const r of rows) for (const id of r.ids) out.set(id, r.ids.length);
  return out;
}

/** page id → how many OTHER pages have this page's first H1 as their title. */
async function h1MatchesOtherTitle(jobId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ id: string; n: number }[]>`
    SELECT p.id, count(o.id)::int AS n
    FROM crawl_pages p
    JOIN crawl_pages o ON o."crawlJobId" = p."crawlJobId" AND o.id <> p.id AND o.title = p."h1First"
    WHERE p."crawlJobId" = ${jobId} AND p."h1First" IS NOT NULL AND p."h1First" <> ''
      AND o."statusCode" >= 200 AND o."statusCode" < 300
    GROUP BY p.id`;
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** Phase 4e: page id → the crawled page its rel=amphtml names (not crawled = absent). */
async function ampTargetFacts(jobId: string): Promise<Map<string, NonNullable<PageSiteFacts["ampTarget"]>>> {
  const rows = await prisma.$queryRaw<{ id: string; url: string; statusCode: number | null; isAmp: boolean; canonical: string | null }[]>`
    SELECT p.id, t.url, t."statusCode", COALESCE(t."isAmp", false) AS "isAmp", COALESCE(t.canonical, t."canonicalHeader") AS canonical
    FROM crawl_pages p
    JOIN crawl_pages t ON t."crawlJobId" = p."crawlJobId" AND t.url = p."ampHtml"
    WHERE p."crawlJobId" = ${jobId} AND p."ampHtml" IS NOT NULL AND p."ampHtml" <> p.url`;
  return new Map(rows.map((r) => [r.id, { url: r.url, statusCode: r.statusCode, isAmp: r.isAmp, canonical: r.canonical }]));
}

/** page id → the crawled page its canonical points at, when that is another URL. */
async function canonicalTargetFacts(jobId: string): Promise<Map<string, PageSiteFacts["canonicalTarget"]>> {
  const rows = await prisma.$queryRaw<{ id: string; statusCode: number | null; redirects: boolean; noindex: boolean }[]>`
    SELECT p.id, t."statusCode", (t."redirectTarget" IS NOT NULL) AS redirects, COALESCE(t.noindex, false) AS noindex
    FROM crawl_pages p
    JOIN crawl_pages t ON t."crawlJobId" = p."crawlJobId" AND t.url = p.canonical
    WHERE p."crawlJobId" = ${jobId} AND p.canonical IS NOT NULL AND p.canonical <> p.url`;
  return new Map(rows.map((r) => [r.id, { statusCode: r.statusCode, redirects: r.redirects, noindex: r.noindex }]));
}

/**
 * page id → what its hreflang alternates look like where they were crawled.
 * Self-references are excluded; an alternate never crawled contributes only
 * to `targets` (nothing can be said about it).
 */
async function hreflangFacts(jobId: string): Promise<Map<string, PageSiteFacts["hreflang"]>> {
  const rows = await prisma.$queryRaw<(PageSiteFacts["hreflang"] & { id: string })[]>`
    SELECT p.id,
      count(*)::int AS targets,
      count(*) FILTER (WHERE t.id IS NOT NULL AND (t."statusCode" IS NULL OR t."statusCode" < 200 OR t."statusCode" >= 300 OR t."redirectTarget" IS NOT NULL))::int AS non200,
      count(*) FILTER (WHERE t.noindex)::int AS noindex,
      count(*) FILTER (WHERE t.canonical IS NOT NULL AND t.canonical <> t.url)::int AS "notCanonical",
      count(*) FILTER (WHERE t.id IS NOT NULL AND t."statusCode" >= 200 AND t."statusCode" < 300 AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.hreflang) = 'array' THEN t.hreflang ELSE '[]'::jsonb END) r
        WHERE r->>'href' = p.url))::int AS "missingReturn",
      count(*) FILTER (WHERE t."langAttr" IS NOT NULL AND e->>'lang' <> 'x-default'
        AND split_part(lower(t."langAttr"), '-', 1) <> split_part(lower(e->>'lang'), '-', 1))::int AS "langMismatch",
      count(*) FILTER (WHERE t.id IS NOT NULL AND t."inlinkCount" = 0)::int AS unlinked,
      min(e->>'href') AS sample
    FROM crawl_pages p
    CROSS JOIN LATERAL jsonb_array_elements(p.hreflang) e
    LEFT JOIN crawl_pages t ON t."crawlJobId" = p."crawlJobId" AND t.url = e->>'href'
    WHERE p."crawlJobId" = ${jobId} AND jsonb_typeof(p.hreflang) = 'array' AND e->>'href' <> p.url
    GROUP BY p.id`;
  return new Map(rows.map(({ id, ...facts }) => [id, facts]));
}

/** page id → its rel next/prev targets' status and reciprocity. */
async function paginationFacts(jobId: string): Promise<Map<string, PageSiteFacts["pagination"]>> {
  const rows = await prisma.$queryRaw<{ id: string; non200: number; sequenceErrors: number; sample: string | null }[]>`
    SELECT p.id,
      count(*) FILTER (WHERE t.id IS NOT NULL AND (t."statusCode" IS NULL OR t."statusCode" < 200 OR t."statusCode" >= 300 OR t."redirectTarget" IS NOT NULL))::int AS non200,
      count(*) FILTER (WHERE t.id IS NOT NULL AND t."statusCode" >= 200 AND t."statusCode" < 300 AND (
        (x.dir = 'next' AND t."relPrev" IS DISTINCT FROM p.url) OR (x.dir = 'prev' AND t."relNext" IS DISTINCT FROM p.url)))::int AS "sequenceErrors",
      min(x.href) AS sample
    FROM crawl_pages p
    CROSS JOIN LATERAL (VALUES ('next', p."relNext"), ('prev', p."relPrev")) AS x(dir, href)
    LEFT JOIN crawl_pages t ON t."crawlJobId" = p."crawlJobId" AND t.url = x.href
    WHERE p."crawlJobId" = ${jobId} AND x.href IS NOT NULL
    GROUP BY p.id`;
  return new Map(rows.map(({ id, ...facts }) => [id, facts]));
}

/**
 * Near-duplicates: pairs of 200 HTML pages whose 64-bit SimHashes differ in
 * at most 3 bits, exact duplicates excluded.
 *
 * Pigeonhole: two hashes within 3 bits agree exactly on at least one of four
 * 16-bit bands, so candidates come from four equi-joins (hash joins, no
 * cross product), and only candidates get the popcount. A site whose pages
 * share a band wholesale (one template, no text) can still blow up, so the
 * query runs under a statement timeout; on timeout near-duplicates are
 * skipped and the summary says so (nearContent: null).
 */
async function nearDuplicates(jobId: string): Promise<{ pairs: Map<string, number>; pages: number; timedOut: boolean }> {
  try {
    const rows = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${NEAR_DUPLICATE_TIMEOUT_MS}`);
        return tx.$queryRaw<{ id: string; n: number }[]>`
          WITH p AS (
            SELECT id, simhash, "contentHash",
              (simhash >> 48) & 65535 AS b0, (simhash >> 32) & 65535 AS b1,
              (simhash >> 16) & 65535 AS b2, simhash & 65535 AS b3
            FROM crawl_pages
            WHERE "crawlJobId" = ${jobId} AND simhash IS NOT NULL
              AND "statusCode" >= 200 AND "statusCode" < 300 AND "contentType" LIKE 'text/html%'
          ),
          c AS (
            SELECT a.id AS aid, b.id AS bid, a.simhash AS sa, b.simhash AS sb FROM p a JOIN p b ON a.b0 = b.b0 AND a.id < b.id AND a."contentHash" IS DISTINCT FROM b."contentHash"
            UNION SELECT a.id, b.id, a.simhash, b.simhash FROM p a JOIN p b ON a.b1 = b.b1 AND a.id < b.id AND a."contentHash" IS DISTINCT FROM b."contentHash"
            UNION SELECT a.id, b.id, a.simhash, b.simhash FROM p a JOIN p b ON a.b2 = b.b2 AND a.id < b.id AND a."contentHash" IS DISTINCT FROM b."contentHash"
            UNION SELECT a.id, b.id, a.simhash, b.simhash FROM p a JOIN p b ON a.b3 = b.b3 AND a.id < b.id AND a."contentHash" IS DISTINCT FROM b."contentHash"
          ),
          m AS (SELECT aid, bid FROM c WHERE length(replace(((sa # sb)::bit(64))::text, '0', '')) <= 3)
          SELECT id, count(*)::int AS n FROM (SELECT aid AS id FROM m UNION ALL SELECT bid FROM m) x GROUP BY id`;
      },
      { timeout: NEAR_DUPLICATE_TIMEOUT_MS + 10_000 },
    );
    return { pairs: new Map(rows.map((r) => [r.id, r.n])), pages: rows.length, timedOut: false };
  } catch (err) {
    logger.warn({ jobId, err }, "site-crawl near-duplicate pass skipped");
    return { pairs: new Map(), pages: 0, timedOut: true };
  }
}

/** Distinct primary language subtags across 200 HTML pages. */
async function langsSeen(jobId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(DISTINCT split_part(lower("langAttr"), '-', 1))::int AS n FROM crawl_pages
    WHERE "crawlJobId" = ${jobId} AND "langAttr" IS NOT NULL AND "langAttr" <> ''
      AND "statusCode" >= 200 AND "statusCode" < 300`;
  return row?.n ?? 0;
}

/**
 * Walk url -> redirectTarget chains: loops per page, chain stats, and the
 * outlinks-to-redirect credit (the first page seen linking to each
 * redirecting URL, from the Redis firstSource hash).
 *
 * The map holds only pages that actually redirect, which on a healthy site is
 * a small fraction of the crawl.
 */
async function walkRedirects(jobId: string, redis: Redis, firstSourceKey: string) {
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
    for (const row of batch) map.set(row.url, { id: row.id, target: row.redirectTarget! });
    if (batch.length < AGGREGATION_BATCH_SIZE) break;
    cursor = batch[batch.length - 1]!.id;
  }

  const loops = new Map<string, string>();
  const toRedirect = new Map<string, number>();
  let chains = 0;
  let longestChain = 0;

  for (const [start, entry] of map) {
    const walk = walkChain(start, map);
    if (walk.looped) loops.set(entry.id, walk.path.join(" → "));
    else if (walk.hops > 1) {
      chains += 1;
      longestChain = Math.max(longestChain, walk.hops);
    }
    const source = await redis.hget(firstSourceKey, start);
    if (source) toRedirect.set(source, (toRedirect.get(source) ?? 0) + 1);
  }

  return { loops, toRedirect, stats: { chains, loops: loops.size, longestChain } };
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
async function findOrphans(jobId: string, sitemapSeeded: Set<string>): Promise<Set<string>> {
  const out = new Set<string>();
  const seeded = [...sitemapSeeded];
  for (let i = 0; i < seeded.length; i += AGGREGATION_BATCH_SIZE) {
    const rows = await prisma.crawlPage.findMany({
      where: {
        crawlJobId: jobId,
        url: { in: seeded.slice(i, i + AGGREGATION_BATCH_SIZE) },
        depth: 0,
        inlinkCount: 0,
        statusCode: { gte: 200, lt: 300 },
        contentType: { startsWith: "text/html" },
      },
      select: { id: true },
    });
    for (const row of rows) out.add(row.id);
  }
  return out;
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
    where: { crawlJobId: jobId },
    _count: { _all: true },
  });

  const out: Record<string, number> = {};
  for (const group of groups) out[group[field]] = group._count._all;
  return out;
}

/** Findings per rule id and totals by kind, for summary.issues / issuesByKind. */
async function ruleTally(jobId: string): Promise<{ issues: Record<string, RuleTally>; byKind: Record<RuleKind, number> }> {
  // One grouped read: findings and the distinct pages they sit on, per rule.
  const groups = await prisma.$queryRaw<{ ruleId: string; kind: string; priority: string; n: bigint; pages: bigint }[]>`
    SELECT "ruleId", "kind", "priority", count(*) AS n, count(DISTINCT "crawlPageId") AS pages
    FROM "crawl_issues"
    WHERE "crawlJobId" = ${jobId} AND "ruleId" IS NOT NULL
    GROUP BY "ruleId", "kind", "priority"`;
  const issues: Record<string, RuleTally> = {};
  const byKind: Record<RuleKind, number> = { issue: 0, warning: 0, opportunity: 0 };
  for (const g of groups) {
    const kind = g.kind as RuleKind;
    issues[g.ruleId] = { count: Number(g.n), kind, priority: g.priority as RulePriority, pages: Number(g.pages) };
    if (kind in byKind) byKind[kind] += Number(g.n);
  }
  return { issues, byKind };
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
