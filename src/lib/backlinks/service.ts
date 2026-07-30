// src/lib/backlinks/service.ts
//
// Backlinks analysis path, shared by the POST route, the e2e script, and the
// tests. Sibling of site-explorer/service.ts and deliberately the same shape.
//
// Order of operations matters and is deliberate:
//   1. plan gate       — free; STARTER/AI_VISIBILITY never reach the API
//   2. 24 h cache      — free, and never touches the monthly allowance
//   3. monthly quota   — Redis reservation, rolled back if nothing was billed
//   4. five live calls — sequential, each metered (USD cap inside seoMeteredCall)
//   5. persist row     — status=completed, or partial when a section failed
//
// All five endpoints are LIVE mode: the Backlinks family has no standard
// queue, so there is nothing to poll and no worker.
//
// Partial failure is a first-class outcome. One endpoint 502-ing must not
// throw away four sections the tenant already paid for, so every section runs
// inside its own try/catch and its key is recorded in `failedSections`.
//
// COST NOTE: this API bills per request AND per row, so each section's billed
// cost is logged individually — a section that quietly gets more expensive is
// otherwise invisible inside the total.

import type { BacklinksAnalysis, PlanType } from "@/generated/prisma";
import { requireSeoQuota } from "@/lib/seo-quota";
import { prisma } from "@/lib/prisma";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import {
  backlinksSummaryTask,
  parseBacklinksSummary,
  type BacklinksSummaryItem,
} from "@/lib/dataforseo/backlinks-summary";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { parseAnchors, parseHistory, parseLinkedPages, parseReferringDomains } from "./parse";
import {
  ANCHORS_LIMIT,
  BACKLINKS_CACHE_TTL_MS,
  DOMAIN_PAGES_LIMIT,
  HISTORY_MONTHS,
  REFERRING_DOMAINS_LIMIT,
  planCanAnalyzeBacklinks,
} from "./options";
import {
  BacklinksPlanLockedError,
  BacklinksQuotaExceededError,
  releaseBacklinksAnalysis,
  reserveBacklinksAnalysis,
} from "./quota";
import { includeSubdomainsFor, type BacklinksMode } from "./target";
import { sectionAppliesTo, sectionsForMode } from "./types";
import type {
  AnchorsSection,
  BacklinksAnalysisDto,
  BacklinksSection,
  BacklinksStatus,
  HistorySection,
  PagesSection,
  ReferringDomainsSection,
  SummarySection,
} from "./types";

export { BACKLINKS_CACHE_TTL_MS } from "./options";

export interface BacklinksParams {
  /** Already normalized by normalizeTarget(). */
  target: string;
  mode: BacklinksMode;
}

/** Every section failed — nothing was worth persisting. */
export class BacklinksFailedError extends Error {
  readonly statusCode = 502;
  constructor() {
    super("Could not analyze this target right now");
    this.name = "BacklinksFailedError";
  }
}

/** Prisma row -> API shape. Decimal and Date never cross the wire raw. */
export function toAnalysisDto(
  row: BacklinksAnalysis,
  extra?: { cached?: boolean; now?: Date },
): BacklinksAnalysisDto {
  const dto: BacklinksAnalysisDto = {
    id: row.id,
    target: row.target,
    mode: row.mode as BacklinksMode,
    status: row.status as BacklinksStatus,
    costUsd: Number(row.costUsd),
    summary: (row.summary as SummarySection | null) ?? null,
    history: (row.history as HistorySection | null) ?? null,
    referringDomains: (row.referringDomains as ReferringDomainsSection | null) ?? null,
    anchors: (row.anchors as AnchorsSection | null) ?? null,
    pages: (row.pages as PagesSection | null) ?? null,
    failedSections: Array.isArray(row.failedSections)
      ? (row.failedSections as BacklinksSection[])
      : [],
    createdAt: row.createdAt.toISOString(),
  };

  if (extra?.cached) {
    dto.cached = true;
    // How long until this target can be re-analyzed. The UI turns it into
    // "Re-run available in 21h" so the disabled button explains itself.
    const elapsed = (extra.now ?? new Date()).getTime() - row.createdAt.getTime();
    dto.reRunAvailableInMs = Math.max(BACKLINKS_CACHE_TTL_MS - elapsed, 0);
  }

  return dto;
}

/** Newest analysis for this exact (target, mode) inside the cache window. */
export async function findCachedAnalysis(
  tenantId: string,
  params: BacklinksParams,
  now = new Date(),
): Promise<BacklinksAnalysis | null> {
  return prisma.backlinksAnalysis.findFirst({
    where: {
      tenantId,
      target: params.target,
      mode: params.mode,
      createdAt: { gte: new Date(now.getTime() - BACKLINKS_CACHE_TTL_MS) },
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
  key: BacklinksSection,
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
      `[backlinks] section ${key} failed for tenant ${tenantId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** YYYY-MM-DD, `months` before `now`. history/live wants a date window. */
function monthsAgo(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Cache hit -> the stored analysis; otherwise reserve quota, run the five live
 * calls in sequence and persist the result.
 *
 * Throws BacklinksPlanLockedError (403), BacklinksQuotaExceededError (429),
 * BacklinksQuotaUnavailableError (503), or BacklinksFailedError (502).
 */
export async function runAnalysis(
  tenantId: string,
  plan: PlanType,
  params: BacklinksParams,
  now = new Date(),
): Promise<{ analysis: BacklinksAnalysisDto; cached: boolean }> {
  if (!planCanAnalyzeBacklinks(plan)) throw new BacklinksPlanLockedError(plan);

  const cached = await findCachedAnalysis(tenantId, params, now);
  if (cached) {
    return { analysis: toAnalysisDto(cached, { cached: true, now }), cached: true };
  }

  // Pooled monthly search quota (Postgres). Runs alongside the per-tool
  // reservation below and the USD cap inside the metered call — any of the
  // three can deny. Placed after the cache check on purpose: serving a
  // stored result costs nothing, so an exhausted tenant can still reopen
  // what they already paid for.
  await requireSeoQuota(tenantId, plan, "backlinks", now);

  const quota = await reserveBacklinksAnalysis(tenantId, plan, now);
  if (!quota.allowed) {
    throw new BacklinksQuotaExceededError(quota.limit, plan);
  }

  const target = params.target;
  const includeSubdomains = includeSubdomainsFor(params.mode);

  // Sequential, not Promise.all: five concurrent live calls against the same
  // account invite DataForSEO's per-account rate limit, and the serial version
  // is still inside the few seconds the UI promises.
  const summary = await section<BacklinksSummaryItem[], SummarySection>(
    "summary",
    tenantId,
    BACKLINKS.summary,
    backlinksSummaryTask(target, { includeSubdomains }),
    parseBacklinksSummary,
  );

  // history and domain_pages are domain-scoped upstream; in exact-URL mode
  // they are skipped entirely (see DOMAIN_ONLY_SECTIONS) rather than called,
  // failed, and shown to the user as two broken cards.
  const runsDomainOnly = sectionAppliesTo("history", params.mode);

  const history = !runsDomainOnly ? null : await section<{ items?: unknown[] }[], HistorySection>(
    "history",
    tenantId,
    BACKLINKS.history,
    {
      target,
      date_from: monthsAgo(now, HISTORY_MONTHS),
    },
    parseHistory as (raw: { items?: unknown[] }[]) => HistorySection,
  );

  const referringDomains = await section<
    { items?: unknown[]; total_count?: number }[],
    ReferringDomainsSection
  >(
    "referringDomains",
    tenantId,
    BACKLINKS.referringDomains,
    {
      target,
      limit: REFERRING_DOMAINS_LIMIT,
      include_subdomains: includeSubdomains,
      backlinks_status_type: "live",
      // Strongest domains first — this endpoint bills per row, so the limit
      // above is the cost lever and this only decides WHICH rows we buy.
      order_by: ["rank,desc"],
    },
    parseReferringDomains as (raw: { items?: unknown[] }[]) => ReferringDomainsSection,
  );

  const anchors = await section<{ items?: unknown[]; total_count?: number }[], AnchorsSection>(
    "anchors",
    tenantId,
    BACKLINKS.anchors,
    {
      target,
      limit: ANCHORS_LIMIT,
      include_subdomains: includeSubdomains,
      backlinks_status_type: "live",
      order_by: ["backlinks,desc"],
    },
    parseAnchors as (raw: { items?: unknown[] }[]) => AnchorsSection,
  );

  const pages = !runsDomainOnly ? null : await section<{ items?: unknown[]; total_count?: number }[], PagesSection>(
    "pages",
    tenantId,
    BACKLINKS.domainPages,
    {
      target,
      limit: DOMAIN_PAGES_LIMIT,
      backlinks_status_type: "live",
      // No order_by: domain_pages rejects it outright ("Invalid Field:
      // 'order_by'", verified live 2026-07-29) unlike its sibling endpoints.
      // Its default ordering is already backlinks-descending.
    },
    parseLinkedPages as (raw: { items?: unknown[] }[]) => PagesSection,
  );

  const sections = { summary, history, referringDomains, anchors, pages };
  // Only sections that were actually attempted can be "failed". A skipped
  // domain-only section is absent, not broken.
  const keys = sectionsForMode(params.mode);
  const failedSections = keys.filter((key) => sections[key] === null);

  // Nothing came back — the tenant gets its analysis back rather than an empty
  // row and a spent slot. Anything DataForSEO did bill is already recorded as
  // a SeoApiCall by seoMeteredCallResult, so the USD ledger stays honest.
  if (failedSections.length === keys.length) {
    await releaseBacklinksAnalysis(tenantId, now);
    throw new BacklinksFailedError();
  }

  // Bill from the envelopes, never a price table (dataforseo/metering.ts).
  const costUsd = Object.values(sections).reduce(
    (total, result) => total + (result?.costUsd ?? 0),
    0,
  );

  const row = await prisma.backlinksAnalysis.create({
    data: {
      tenantId,
      target,
      mode: params.mode,
      status: failedSections.length > 0 ? "partial" : "completed",
      costUsd,
      // `as object`: Prisma's InputJsonValue wants an index signature, which
      // our named section interfaces deliberately do not have.
      summary: (summary?.payload as object) ?? undefined,
      history: (history?.payload as object) ?? undefined,
      referringDomains: (referringDomains?.payload as object) ?? undefined,
      anchors: (anchors?.payload as object) ?? undefined,
      pages: (pages?.payload as object) ?? undefined,
      failedSections,
      createdAt: now,
    },
  });

  // Per-section costs, not just the total: this API bills per row, so a
  // section drifting upward is only visible broken out.
  const breakdown = keys
    .map((key) => `${key}=$${(sections[key]?.costUsd ?? 0).toFixed(6)}`)
    .join(" ");
  console.info(
    `[backlinks] tenant=${tenantId} target=${target} mode=${params.mode} ` +
      `cost=$${costUsd.toFixed(6)} status=${row.status} ${breakdown}` +
      (failedSections.length ? ` failed=${failedSections.join(",")}` : ""),
  );

  return { analysis: toAnalysisDto(row), cached: false };
}
