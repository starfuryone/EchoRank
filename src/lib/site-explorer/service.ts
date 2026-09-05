// src/lib/site-explorer/service.ts
//
// Site Explorer analysis path, shared by the POST route, the e2e script, and
// the tests.
//
// Order of operations matters and is deliberate:
//   1. stored row      — free; this tenant already ran this exact analysis
//   2. SPACES cache    — free; ANOTHER tenant already bought this week's answer
//   3. monthly quota   — Redis reservation, rolled back if nothing was billed
//   4. five live calls — sequential, each metered (USD cap inside seoMeteredCall)
//   5. persist row     — status=completed, or partial when a section failed
//
// ── ONE WIDE FETCH, THEN EVERY QUESTION IS FREE ────────────────────────────
// The keyword and page sets are fetched wide (1000 and 500 rows) and stored.
// The Keywords and Pages tabs then filter, sort and page over THOSE rows —
// server-side, but with no provider call and no allowance. That is the whole
// bargain of this tool, and it is the opposite of the one Backlinks makes; the
// reasoning for the difference is in ./pagination.ts.
//
// ── THE SHARED CACHE ───────────────────────────────────────────────────────
// A domain's organic footprint is a fact about the public web, not about who
// asked, so the payload is cached under a tenant-free key and one workspace's
// purchase answers another's question. The METERING stays per-tenant: a hit
// consumes no allowance from anyone, and a miss bills only the tenant whose
// request paid for it.
//
// All four endpoints are LIVE mode: DataForSEO's Labs and Backlinks families
// have no standard queue, so there is nothing to poll and no worker. Each call
// is sub-second; the whole POST lands in ~3-5 s.
//
// Partial failure is a first-class outcome. One endpoint 502-ing must not throw
// away three sections the tenant already paid for, so every section is run
// inside its own try/catch and its key is recorded in `failedSections`.

import type { PlanType, SiteExplorerAnalysis } from "@/generated/prisma";
import { requireSeoQuota } from "@/lib/seo-quota";
import { prisma } from "@/lib/prisma";
import {
  BACKLINKS,
  LABS,
  type BacklinksSummaryItem,
  type CompetitorsDomainItem,
  type DomainRankOverviewItem,
  type RankedKeywordItem,
  type RelevantPageItem,
} from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { cacheKey, dateBucket, readCache, writeCache } from "@/lib/spaces-cache";
import { recordResearch } from "@/lib/research-log/store";
import { backlinksSummaryTask } from "@/lib/dataforseo/backlinks-summary";
import {
  parseBacklinks,
  parseCompetitors,
  parseDomainPages,
  parseOverview,
  parseRankedKeywords,
} from "./parse";
import {
  COMPETITORS_LIMIT,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  RANKED_KEYWORDS_LIMIT,
  RELEVANT_PAGES_LIMIT,
  SITE_EXPLORER_CACHE_DAYS,
  SITE_EXPLORER_CACHE_TTL_MS,
} from "./options";
import {
  releaseSiteExplorerAnalysis,
  reserveSiteExplorerAnalysis,
  SiteExplorerQuotaExceededError,
} from "./quota";
import type {
  BacklinksSection,
  CompetitorsSection,
  DomainPagesSection,
  OverviewSection,
  RankedKeywordsSection,
  SiteExplorerAnalysisDto,
  SiteExplorerSection,
  SiteExplorerStatus,
} from "./types";

export {
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  SITE_EXPLORER_CACHE_TTL_MS,
} from "./options";

export interface SiteExplorerParams {
  /** Already normalized by normalizeDomain(). */
  domain: string;
  locationCode: number;
  languageCode: string;
}

/** Every section failed — nothing was worth persisting. */
export class SiteExplorerFailedError extends Error {
  readonly statusCode = 502;
  constructor(readonly cause: unknown) {
    super("Could not analyze this domain right now");
    this.name = "SiteExplorerFailedError";
  }
}

/** Prisma row -> API shape. Decimal and Date never cross the wire raw. */
export function toAnalysisDto(
  row: SiteExplorerAnalysis,
  extra?: { cached?: boolean; now?: Date },
): SiteExplorerAnalysisDto {
  const dto: SiteExplorerAnalysisDto = {
    id: row.id,
    domain: row.domain,
    locationCode: row.locationCode,
    languageCode: row.languageCode,
    status: row.status as SiteExplorerStatus,
    costUsd: Number(row.costUsd),
    overview: (row.overview as OverviewSection | null) ?? null,
    rankedKeywords: (row.rankedKeywords as RankedKeywordsSection | null) ?? null,
    competitors: (row.competitors as CompetitorsSection | null) ?? null,
    backlinks: (row.backlinks as BacklinksSection | null) ?? null,
    pages: (row.pages as DomainPagesSection | null) ?? null,
    failedSections: Array.isArray(row.failedSections)
      ? (row.failedSections as SiteExplorerSection[])
      : [],
    createdAt: row.createdAt.toISOString(),
  };

  if (extra?.cached) {
    dto.cached = true;
    // How long until this domain can be re-analyzed. The UI turns it into
    // "Re-run available in 21h" so the disabled button explains itself.
    const elapsed = (extra.now ?? new Date()).getTime() - row.createdAt.getTime();
    dto.reRunAvailableInMs = Math.max(SITE_EXPLORER_CACHE_TTL_MS - elapsed, 0);
  }

  return dto;
}

/**
 * The shared Spaces key for this analysis.
 *
 * NO TENANT ID, and the market IS in the scope segment: the same domain asked
 * about from Canada and from the United States is a different answer, and a
 * key that dropped the market would serve one as the other.
 */
export function siteExplorerCacheKey(params: SiteExplorerParams, now = new Date()): string {
  return cacheKey({
    feature: "site-explorer",
    version: "v1",
    scope: `${params.locationCode}-${params.languageCode}`,
    target: params.domain,
    dateBucket: dateBucket(SITE_EXPLORER_CACHE_DAYS, now),
  });
}

/** What lands in Spaces: the parsed sections, not the raw envelopes. */
interface CachedSiteExplorerPayload {
  overview: OverviewSection | null;
  rankedKeywords: RankedKeywordsSection | null;
  competitors: CompetitorsSection | null;
  backlinks: BacklinksSection | null;
  pages: DomainPagesSection | null;
  failedSections: SiteExplorerSection[];
}

/** Newest analysis for this exact target inside the cache window. */
export async function findCachedAnalysis(
  tenantId: string,
  params: SiteExplorerParams,
  now = new Date(),
): Promise<SiteExplorerAnalysis | null> {
  return prisma.siteExplorerAnalysis.findFirst({
    where: {
      tenantId,
      domain: params.domain,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      createdAt: { gte: new Date(now.getTime() - SITE_EXPLORER_CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Runs one metered section. Returns the parsed payload and its billed cost, or
 * null when the call failed — the caller records the section key and moves on
 * to the next endpoint instead of aborting the run.
 *
 * Failures are logged rather than swallowed silently: a section that starts
 * failing for every tenant is an upstream contract change, and the only place
 * that is visible is the server log.
 */
async function section<TRaw, TOut>(
  key: SiteExplorerSection,
  tenantId: string,
  path: string,
  task: Record<string, unknown>,
  parse: (raw: TRaw) => TOut,
): Promise<{ payload: TOut; costUsd: number } | null> {
  try {
    const { data, billing } = await seoMeteredCallResult<TRaw>(tenantId, path, task);
    return { payload: parse(data), costUsd: billing.costUsd };
  } catch (err) {
    console.error(
      `[site-explorer] section ${key} failed for tenant ${tenantId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Cache hit -> the stored analysis; otherwise reserve quota, run the four live
 * calls in sequence and persist the result.
 *
 * Throws SiteExplorerQuotaExceededError (429), SiteExplorerQuotaUnavailableError
 * (503), or SiteExplorerFailedError (502, all four sections down).
 */
export async function runAnalysis(
  tenantId: string,
  plan: PlanType,
  params: SiteExplorerParams,
): Promise<{ analysis: SiteExplorerAnalysisDto; cached: boolean }> {
  const cached = await findCachedAnalysis(tenantId, params);
  if (cached) {
    return { analysis: toAnalysisDto(cached, { cached: true }), cached: true };
  }

  // The SHARED cache, still before the allowance. Another tenant may already
  // have bought this week's payload; serving it costs this tenant nothing.
  // readCache never throws — an unreachable cache is a miss.
  const shared = await readCache<CachedSiteExplorerPayload>(siteExplorerCacheKey(params));
  if (shared) {
    const row = await prisma.siteExplorerAnalysis.create({
      data: {
        tenantId,
        domain: params.domain,
        locationCode: params.locationCode,
        languageCode: params.languageCode,
        status: shared.failedSections.length > 0 ? "partial" : "completed",
        // Zero, because nobody was billed for this one. The tenant gets a
        // result and the ledger says what actually happened.
        costUsd: 0,
        overview: (shared.overview as object) ?? undefined,
        rankedKeywords: (shared.rankedKeywords as object) ?? undefined,
        competitors: (shared.competitors as object) ?? undefined,
        backlinks: (shared.backlinks as object) ?? undefined,
        pages: (shared.pages as object) ?? undefined,
        failedSections: shared.failedSections,
      },
    });
    await recordResearch({
      tenantId,
      feature: "domain_overview",
      target: params.domain,
      metrics: {
        locationCode: params.locationCode,
        languageCode: params.languageCode,
        keywords: shared.overview?.keywordCount ?? 0,
        etv: Math.round(shared.overview?.etv ?? 0),
        failedSections: shared.failedSections.length,
        sharedCache: 1,
      },
      costUsd: 0,
      sourceRef: row.id,
    });
    console.info(
      `[site-explorer] tenant=${tenantId} domain=${params.domain} SHARED-CACHE-HIT cost=$0`,
    );
    return { analysis: toAnalysisDto(row), cached: true };
  }

  // Pooled monthly search quota (Postgres). Runs alongside the per-tool
  // reservation below and the USD cap inside the metered call — any of the
  // three can deny. Placed after the cache check on purpose: serving a
  // stored result costs nothing, so an exhausted tenant can still reopen
  // what they already paid for.
  await requireSeoQuota(tenantId, plan, "domain_overview");

  const quota = await reserveSiteExplorerAnalysis(tenantId, plan);
  if (!quota.allowed) {
    throw new SiteExplorerQuotaExceededError(quota.limit, plan);
  }

  const loc = { location_code: params.locationCode, language_code: params.languageCode };

  // Sequential, not Promise.all: four concurrent live calls against the same
  // account invite DataForSEO's per-account rate limit, and the serial version
  // is still inside the ~5 s the UI promises.
  const overview = await section<{ items?: DomainRankOverviewItem[] }[], OverviewSection>(
    "overview",
    tenantId,
    LABS.domainRankOverview,
    { target: params.domain, ...loc, limit: 1 },
    parseOverview,
  );

  const rankedKeywords = await section<
    { items?: RankedKeywordItem[]; total_count?: number }[],
    RankedKeywordsSection
  >(
    "rankedKeywords",
    tenantId,
    LABS.rankedKeywords,
    {
      target: params.domain,
      ...loc,
      limit: RANKED_KEYWORDS_LIMIT,
      // Best-ranking first. DataForSEO bills this endpoint per row returned,
      // so the limit above is the cost lever, not this.
      order_by: ["ranked_serp_element.serp_item.rank_group,asc"],
    },
    parseRankedKeywords,
  );

  const competitors = await section<{ items?: CompetitorsDomainItem[] }[], CompetitorsSection>(
    "competitors",
    tenantId,
    LABS.competitorsDomain,
    { target: params.domain, ...loc, limit: COMPETITORS_LIMIT },
    (raw) => parseCompetitors(raw, params.domain),
  );

  const backlinks = await section<BacklinksSummaryItem[], BacklinksSection>(
    "backlinks",
    tenantId,
    BACKLINKS.summary,
    backlinksSummaryTask(params.domain, { includeSubdomains: true }),
    parseBacklinks,
  );

  // The Pages tab. relevant_pages answers "which pages earn the traffic",
  // which is the question the Keywords tab leaves open: a customer looking at
  // 1,000 ranked keywords wants to know which twenty pages they belong to.
  const pages = await section<
    { items?: RelevantPageItem[]; total_count?: number }[],
    DomainPagesSection
  >(
    "pages",
    tenantId,
    LABS.relevantPages,
    { target: params.domain, ...loc, limit: RELEVANT_PAGES_LIMIT },
    parseDomainPages,
  );

  const sections = { overview, rankedKeywords, competitors, backlinks, pages };
  const failedSections = (Object.keys(sections) as SiteExplorerSection[]).filter(
    (key) => sections[key] === null,
  );

  // Nothing came back — the tenant gets its analysis back rather than an empty
  // row and a spent slot. Anything DataForSEO did bill is already recorded as
  // a SeoApiCall by seoMeteredCallResult, so the USD ledger stays honest.
  if (failedSections.length === (Object.keys(sections) as string[]).length) {
    await releaseSiteExplorerAnalysis(tenantId);
    throw new SiteExplorerFailedError(null);
  }

  // Bill from the envelopes, never a price table (dataforseo/metering.ts).
  const costUsd = Object.values(sections).reduce(
    (total, result) => total + (result?.costUsd ?? 0),
    0,
  );

  const row = await prisma.siteExplorerAnalysis.create({
    data: {
      tenantId,
      domain: params.domain,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      status: failedSections.length > 0 ? "partial" : "completed",
      costUsd,
      // `as object`: Prisma's InputJsonValue wants an index signature, which
      // our named section interfaces deliberately do not have (the repo's
      // keywords/overview route casts the same way).
      overview: (overview?.payload as object) ?? undefined,
      rankedKeywords: (rankedKeywords?.payload as object) ?? undefined,
      competitors: (competitors?.payload as object) ?? undefined,
      backlinks: (backlinks?.payload as object) ?? undefined,
      pages: (pages?.payload as object) ?? undefined,
      failedSections,
    },
  });

  // Research Log, on delivered success. A partial analysis still counts —
  // the customer paid for it and can read it back, which is the question the
  // log answers. recordResearch never throws (see its header), so this cannot
  // turn a completed, billed analysis into a 500.
  await recordResearch({
    tenantId,
    feature: "domain_overview",
    target: params.domain,
    metrics: {
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      keywords: overview?.payload?.keywordCount ?? 0,
      etv: Math.round(overview?.payload?.etv ?? 0),
      failedSections: failedSections.length,
    },
    costUsd,
    sourceRef: row.id,
  });

  // Share the payload. Fire-and-forget: writeCache never throws, and the
  // customer already has their answer, so a slow Spaces write must not sit on
  // their critical path. A PARTIAL analysis is not shared — the next tenant
  // would receive missing sections at cost 0 with no way to tell them from
  // genuinely empty ones, the same trap the Backlinks tier split avoids.
  if (failedSections.length === 0) {
    void writeCache(siteExplorerCacheKey(params), {
      overview: overview?.payload ?? null,
      rankedKeywords: rankedKeywords?.payload ?? null,
      competitors: competitors?.payload ?? null,
      backlinks: backlinks?.payload ?? null,
      pages: pages?.payload ?? null,
      failedSections,
    } satisfies CachedSiteExplorerPayload);
  }

  console.info(
    `[site-explorer] tenant=${tenantId} domain=${params.domain} ` +
      `cost=$${costUsd.toFixed(6)} status=${row.status}` +
      (failedSections.length ? ` failed=${failedSections.join(",")}` : ""),
  );

  return { analysis: toAnalysisDto(row), cached: false };
}

/** Defaults the routes and the e2e script share. */
export const DEFAULT_PARAMS = {
  locationCode: DEFAULT_LOCATION_CODE,
  languageCode: DEFAULT_LANGUAGE_CODE,
} as const;
