// src/lib/site-explorer/service.ts
//
// Site Explorer analysis path, shared by the POST route, the e2e script, and
// the tests.
//
// Order of operations matters and is deliberate:
//   1. 24 h cache      — free, and never touches the monthly allowance
//   2. monthly quota   — Redis reservation, rolled back if nothing was billed
//   3. four live calls — sequential, each metered (USD cap inside seoMeteredCall)
//   4. persist row     — status=completed, or partial when a section failed
//
// All four endpoints are LIVE mode: DataForSEO's Labs and Backlinks families
// have no standard queue, so there is nothing to poll and no worker. Each call
// is sub-second; the whole POST lands in ~3-5 s.
//
// Partial failure is a first-class outcome. One endpoint 502-ing must not throw
// away three sections the tenant already paid for, so every section is run
// inside its own try/catch and its key is recorded in `failedSections`.

import type { PlanType, SiteExplorerAnalysis } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  BACKLINKS,
  LABS,
  type BacklinksSummaryItem,
  type CompetitorsDomainItem,
  type DomainRankOverviewItem,
  type RankedKeywordItem,
} from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { backlinksSummaryTask } from "@/lib/dataforseo/backlinks-summary";
import { parseBacklinks, parseCompetitors, parseOverview, parseRankedKeywords } from "./parse";
import {
  COMPETITORS_LIMIT,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  RANKED_KEYWORDS_LIMIT,
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

  const sections = { overview, rankedKeywords, competitors, backlinks };
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
      failedSections,
    },
  });

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
