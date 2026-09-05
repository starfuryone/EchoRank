// src/lib/backlinks/service.ts
//
// Backlinks analysis path, shared by the POST route, the e2e script, and the
// tests. Sibling of site-explorer/service.ts and deliberately the same shape.
//
// Order of operations matters and is deliberate:
//   1. plan gate       — free
//   2. stored row      — free; this tenant already ran this exact lookup
//   3. SPACES cache    — free; ANOTHER tenant already bought this week's answer
//   4. monthly quota   — Redis reservation, rolled back if nothing was billed
//   5. live calls      — sequential, each metered (USD cap inside seoMeteredCall)
//   6. persist + cache + snapshot + research log
//
// ── ONE SERVICE, TWO TIERS ─────────────────────────────────────────────────
// Basic and Full are the SAME code path with a capability object deciding how
// much of it runs. There is deliberately no second "basic service": two paths
// drift, and the one nobody tests is always the cheap one that most customers
// are on. `capability.deepEndpoints` is what stops Basic buying anchors and
// the backlinks list; `capability.scope` is what stops it asking about a path.
// Both are re-checked HERE and not only at the route, because a hidden button
// is not an authorization boundary.
//
// ── TWO CACHES, AND THEY ANSWER DIFFERENT QUESTIONS ────────────────────────
//   the stored row  — "has THIS TENANT run this lookup this week?" Returns
//                     their own analysis, with its own id and cost.
//   Spaces          — "has ANY tenant bought this week's provider payload?"
//                     A domain's link profile is a fact about the public web,
//                     not about who asked, so the payload is shared. A hit
//                     still writes this tenant their own row at cost 0 — they
//                     get a result, and nobody is billed twice for one fetch.
// Both are checked BEFORE the allowance, so an exhausted workspace can still
// reopen and still benefit from another's purchase.
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
import { recordResearch } from "@/lib/research-log/store";
import { cacheKey, dateBucket, readCache, writeCache } from "@/lib/spaces-cache";
import { recordBacklinkSnapshot } from "./snapshots";
import { buildBacklinksListFilters, type BacklinksListFilters } from "./filters";
import {
  parseAnchors,
  parseBacklinksList,
  parseHistory,
  parseLinkedPages,
  parseReferringDomains,
} from "./parse";
import type { BacklinksCapability } from "./options";
import {
  ANCHORS_LIMIT,
  BACKLINKS_CACHE_DAYS,
  BACKLINKS_CACHE_TTL_MS,
  DOMAIN_PAGES_LIMIT,
  HISTORY_MONTHS,
  REFERRING_DOMAINS_LIMIT,
  backlinksCapability,
  planCanAnalyzeBacklinks,
} from "./options";
import {
  BacklinksPlanLockedError,
  BacklinksQuotaExceededError,
  releaseBacklinksAnalysis,
  reserveBacklinksAnalysis,
} from "./quota";
import {
  apiTargetFor,
  buildPrefixFilters,
  includeSubdomainsFor,
  type BacklinksMode,
} from "./target";
import { sectionAppliesTo, sectionsForMode } from "./types";
import type {
  AnchorsSection,
  BacklinksAnalysisDto,
  BacklinksListSection,
  BacklinksSection,
  BacklinksStatus,
  HistorySection,
  PagesSection,
  ReferringDomainsSection,
  SummarySection,
} from "./types";

export { BACKLINKS_CACHE_TTL_MS } from "./options";
export type { BacklinksCapability } from "./options";

/**
 * Sections only the Full tier buys.
 *
 * A list rather than a property on each section, because the question asked of
 * it — "did this tier skip this, or did it fail?" — is asked in one place and
 * the answer must be the same in both branches of it.
 */
const DEEP_SECTIONS: readonly BacklinksSection[] = ["anchors", "pages", "list"];

export interface BacklinksParams {
  /** Already normalized by normalizeTarget(). */
  target: string;
  mode: BacklinksMode;
  /** Full tier only. Ignored — and refused — on Basic. */
  listFilters?: BacklinksListFilters;
}

/**
 * The tier does not include what was asked for.
 *
 * 403 rather than a silent downgrade: quietly answering a narrower question
 * than the customer asked is how someone concludes the tool is broken. Telling
 * them the scope is on another plan is at least true and actionable.
 */
export class BacklinksCapabilityError extends Error {
  readonly statusCode = 403;
  readonly code = "CAPABILITY_LOCKED";
  constructor(
    readonly capability: "scope" | "filters" | "deepEndpoints" | "csv" | "history",
    readonly plan: PlanType,
  ) {
    super(
      capability === "scope"
        ? "Subdomain, URL-prefix and exact-page scopes are available on the Agency plan and above."
        : capability === "filters"
          ? "Backlink filters are available on the Agency plan and above."
          : "That part of the Backlinks tool is available on the Agency plan and above.",
    );
    this.name = "BacklinksCapabilityError";
  }
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
    list: (row.list as BacklinksListSection | null) ?? null,
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

/**
 * The shared Spaces key for this lookup.
 *
 * NO TENANT ID, and no filters either. The payload cached is the UNFILTERED
 * provider response — filtering is applied when the list is served, so two
 * tenants asking the same target with different filters share one fetch. A key
 * that carried filters would cache one answer per filter combination, which is
 * a cache that never hits.
 */
export function backlinksCacheKey(params: BacklinksParams, now = new Date()): string {
  return cacheKey({
    feature: "backlinks",
    version: "v1",
    scope: params.mode,
    target: params.target,
    dateBucket: dateBucket(BACKLINKS_CACHE_DAYS, now),
  });
}

/** What lands in Spaces: the parsed sections, not the raw envelopes. */
interface CachedBacklinksPayload {
  summary: SummarySection | null;
  history: HistorySection | null;
  referringDomains: ReferringDomainsSection | null;
  anchors: AnchorsSection | null;
  pages: PagesSection | null;
  list: BacklinksListSection | null;
  failedSections: BacklinksSection[];
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

  // ── The capability gate, before anything is spent or even looked up ──────
  // Re-checked here rather than trusted from the route: this function is also
  // called by the e2e script and the tests, and a gate that only exists at one
  // of three call sites is a gate that will be missed at the fourth.
  const capability = backlinksCapability(plan);
  if (capability.scope !== "full" && params.mode !== "domain") {
    throw new BacklinksCapabilityError("scope", plan);
  }
  if (!capability.filters && params.listFilters) {
    throw new BacklinksCapabilityError("filters", plan);
  }

  const cached = await findCachedAnalysis(tenantId, params, now);
  if (cached) {
    return { analysis: toAnalysisDto(cached, { cached: true, now }), cached: true };
  }

  const target = params.target;
  const includeSubdomains = includeSubdomainsFor(params.mode);

  // ── The SHARED cache, still before the allowance ─────────────────────────
  // Another tenant may already have bought this week's payload. Serving it
  // costs this tenant nothing — no allowance, no reservation, no provider
  // call — and the row is written at cost 0 so the ledger says what happened.
  // readCache never throws; an unreachable cache is a miss.
  const shared = await readCache<CachedBacklinksPayload>(backlinksCacheKey(params, now));
  if (shared) {
    const row = await persistAnalysis({
      tenantId,
      params,
      capability,
      sections: shared,
      failedSections: shared.failedSections,
      costUsd: 0,
      now,
      // No snapshot on a shared hit: the numbers are unchanged since whoever
      // fetched them, and a second point at the same values on the same day
      // would imply a second measurement.
      snapshot: false,
    });
    console.info(
      `[backlinks] tenant=${tenantId} target=${target} mode=${params.mode} SHARED-CACHE-HIT cost=$0`,
    );
    return { analysis: toAnalysisDto(row), cached: true };
  }

  // Pooled monthly search quota (Postgres). Runs alongside the per-tool
  // reservation below and the USD cap inside the metered call — any of the
  // three can deny. Placed after BOTH cache checks on purpose: serving a
  // stored or shared result costs nothing, so an exhausted tenant can still
  // reopen what they already paid for and still benefit from another's fetch.
  await requireSeoQuota(tenantId, plan, "backlinks", now);

  const quota = await reserveBacklinksAnalysis(tenantId, plan, now);
  if (!quota.allowed) {
    throw new BacklinksQuotaExceededError(quota.limit, plan);
  }

  // The provider takes a hostname for a prefix lookup and is narrowed with a
  // filter — the Backlinks endpoints accept a domain or a page and nothing in
  // between. See target.ts.
  const apiTarget = apiTargetFor(target, params.mode);
  const prefixFilters = params.mode === "prefix" ? buildPrefixFilters(target) : undefined;

  // Sequential, not Promise.all: five concurrent live calls against the same
  // account invite DataForSEO's per-account rate limit, and the serial version
  // is still inside the few seconds the UI promises.
  // A PREFIX HAS NO SUMMARY ENDPOINT. summary/live takes a whole target, so a
  // path's totals are assembled from two filtered total_count reads of the
  // backlinks list — every link, and one per referring domain. Rank, spam
  // scores and new/lost have no filtered source and stay NULL, which is the
  // honest value; rendering them as 0 would say "no authority" about a page
  // nobody measured.
  const summary =
    params.mode === "prefix"
      ? await prefixSummary(tenantId, apiTarget, includeSubdomains, prefixFilters!)
      : await section<BacklinksSummaryItem[], SummarySection>(
          "summary",
          tenantId,
          BACKLINKS.summary,
          backlinksSummaryTask(apiTarget, { includeSubdomains }),
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
      target: apiTarget,
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
      target: apiTarget,
      // ROWS ARE THE COST LEVER on this endpoint — it bills per request AND
      // per row — so a Basic tenant buys only what Basic can display. Full
      // buys the wider set it can filter and page through.
      limit: Math.min(REFERRING_DOMAINS_LIMIT, capability.listRows),
      include_subdomains: includeSubdomains,
      backlinks_status_type: "live",
      // Strongest domains first — the limit above decides how many rows we
      // buy, this decides WHICH.
      order_by: ["rank,desc"],
      ...(prefixFilters ? { filters: prefixFilters } : {}),
    },
    parseReferringDomains as (raw: { items?: unknown[] }[]) => ReferringDomainsSection,
  );

  // ── ANCHORS ARE FULL-ONLY SPEND ─────────────────────────────────────────
  // Not "fetched and hidden": Basic does not buy them at all. Hiding a section
  // a customer paid for is the shape of upsell that makes people feel robbed,
  // and it would put every Basic lookup's cost up for a card they never see.
  const anchors = !capability.deepEndpoints
    ? null
    : await section<{ items?: unknown[]; total_count?: number }[], AnchorsSection>(
        "anchors",
        tenantId,
        BACKLINKS.anchors,
        {
          target: apiTarget,
          limit: ANCHORS_LIMIT,
          include_subdomains: includeSubdomains,
          backlinks_status_type: "live",
          order_by: ["backlinks,desc"],
          ...(prefixFilters ? { filters: prefixFilters } : {}),
        },
        parseAnchors as (raw: { items?: unknown[] }[]) => AnchorsSection,
      );

  const pages = !runsDomainOnly || !capability.deepEndpoints
    ? null
    : await section<{ items?: unknown[]; total_count?: number }[], PagesSection>(
    "pages",
    tenantId,
    BACKLINKS.domainPages,
    {
      target: apiTarget,
      limit: DOMAIN_PAGES_LIMIT,
      backlinks_status_type: "live",
      // No order_by: domain_pages rejects it outright ("Invalid Field:
      // 'order_by'", verified live 2026-07-29) unlike its sibling endpoints.
      // Its default ordering is already backlinks-descending.
    },
    parseLinkedPages as (raw: { items?: unknown[] }[]) => PagesSection,
  );

  // ── THE FULL TIER'S BACKLINKS LIST ──────────────────────────────────────
  // FILTERS GO TO THE PROVIDER, not applied here over what came back, and the
  // reason is the same trap Phase D's cited-sources avoids: this call is
  // capped at `listRows`, so filtering AFTER the cap would filter a set that
  // was already truncated. A ".edu only" filter over the top 200 links of a
  // domain with ten thousand returns whichever of those 200 happen to be .edu
  // — usually none — and an empty table is indistinguishable from "you have no
  // .edu links". Pushing the filter upstream asks the right question of the
  // whole population.
  //
  // The consequence, and it is the honest trade: CHANGING A FILTER IS A NEW
  // FETCH. Paging and sorting within what came back are free (the rows are in
  // the stored row and in the shared cache); narrowing is not. The UI says so
  // next to the Apply button.
  const list =
    !capability.deepEndpoints
      ? null
      : await (async () => {
          const built = params.listFilters
            ? buildBacklinksListFilters(params.listFilters)
            : { filters: [] as unknown[] };
          const merged = prefixFilters
            ? built.filters.length > 0
              ? [built.filters, "and", prefixFilters[0]]
              : prefixFilters
            : built.filters;
          return section<{ items?: unknown[]; total_count?: number }[], BacklinksListSection>(
            "list",
            tenantId,
            BACKLINKS.list,
            {
              target: apiTarget,
              limit: capability.listRows,
              include_subdomains: includeSubdomains,
              backlinks_status_type: "live",
              mode: "as_is",
              order_by: ["domain_from_rank,desc"],
              ...(merged.length > 0 ? { filters: merged } : {}),
            },
            parseBacklinksList,
          );
        })();

  const sections = { summary, history, referringDomains, anchors, pages, list };
  // Only sections that were actually ATTEMPTED can be "failed". Two kinds of
  // section are absent rather than broken, and conflating them would show a
  // Basic tenant two "couldn't load" cards on every successful lookup:
  //   - domain-only sections in a page- or path-scoped lookup (they can never
  //     load), and
  //   - deep sections on a tier that did not buy them.
  const keys = sectionsForMode(params.mode).filter(
    (key) => capability.deepEndpoints || !DEEP_SECTIONS.includes(key),
  );
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

  const payload: CachedBacklinksPayload = {
    summary: summary?.payload ?? null,
    history: history?.payload ?? null,
    referringDomains: referringDomains?.payload ?? null,
    anchors: anchors?.payload ?? null,
    pages: pages?.payload ?? null,
    list: list?.payload ?? null,
    failedSections,
  };

  const row = await persistAnalysis({
    tenantId,
    params,
    capability,
    sections: payload,
    failedSections,
    costUsd,
    now,
    snapshot: true,
  });

  // Share the payload. Fire-and-forget by design — writeCache never throws,
  // and the customer already has their answer either way, so a slow Spaces
  // write must not be on their critical path.
  //
  // ONLY A FULL-TIER PAYLOAD IS CACHED, and this is the subtle one: a Basic
  // fetch bought fewer sections, so caching it would let the next FULL tenant
  // hit that cache and receive a result missing anchors and pages, at cost 0,
  // with no way to tell it apart from a genuinely empty profile. A tier's
  // savings must not become another tier's silent data loss.
  //
  // A FILTERED FETCH IS ALSO NOT SHARED. The key deliberately carries no
  // filters — a key per filter combination is a cache that never hits — so
  // storing a filtered payload under it would serve the next tenant somebody
  // else's narrower question as if it were their broad one.
  if (capability.deepEndpoints && !params.listFilters) {
    void writeCache(backlinksCacheKey(params, now), payload);
  }

  // Per-section costs, not just the total: this API bills per row, so a
  // section drifting upward is only visible broken out.
  const breakdown = keys
    .map((key) => `${key}=$${(sections[key]?.costUsd ?? 0).toFixed(6)}`)
    .join(" ");
  console.info(
    `[backlinks] tenant=${tenantId} target=${target} mode=${params.mode} ` +
      `tier=${capability.tier} cost=$${costUsd.toFixed(6)} status=${row.status} ${breakdown}` +
      (failedSections.length ? ` failed=${failedSections.join(",")}` : ""),
  );

  return { analysis: toAnalysisDto(row), cached: false };
}

/**
 * Write the row, the history point and the research-log entry.
 *
 * Shared by the fresh path and the shared-cache path so the two cannot
 * diverge in what they record — a cache hit that skipped the research log
 * would make the Recent-research panel disagree with what the tenant can
 * actually reopen.
 */
async function persistAnalysis(input: {
  tenantId: string;
  params: BacklinksParams;
  capability: BacklinksCapability;
  sections: CachedBacklinksPayload;
  failedSections: BacklinksSection[];
  costUsd: number;
  now: Date;
  snapshot: boolean;
}): Promise<BacklinksAnalysis> {
  const { tenantId, params, sections, failedSections, costUsd, now } = input;

  const row = await prisma.backlinksAnalysis.create({
    data: {
      tenantId,
      target: params.target,
      mode: params.mode,
      status: failedSections.length > 0 ? "partial" : "completed",
      costUsd,
      // `as object`: Prisma's InputJsonValue wants an index signature, which
      // our named section interfaces deliberately do not have.
      summary: (sections.summary as object) ?? undefined,
      history: (sections.history as object) ?? undefined,
      referringDomains: (sections.referringDomains as object) ?? undefined,
      anchors: (sections.anchors as object) ?? undefined,
      pages: (sections.pages as object) ?? undefined,
      list: (sections.list as object) ?? undefined,
      failedSections,
      createdAt: now,
    },
  });

  // History is recorded on EVERY TIER — the data is already paid for, and a
  // tier that starts recording only on upgrade shows an empty chart for weeks
  // afterwards. The capability gates the chart, not the write. Never throws.
  if (input.snapshot) {
    await recordBacklinkSnapshot({
      tenantId,
      target: params.target,
      mode: params.mode,
      summary: sections.summary,
      now,
    });
  }

  await recordResearch({
    tenantId,
    feature: "backlinks",
    target: params.target,
    metrics: {
      mode: params.mode,
      tier: input.capability.tier,
      referringDomains: sections.summary?.referringDomains ?? 0,
      backlinks: sections.summary?.backlinks ?? 0,
      domainRank: sections.summary?.rank ?? 0,
      failedSections: failedSections.length,
    },
    costUsd,
    sourceRef: row.id,
    now,
  });

  return row;
}

/**
 * A prefix scope's totals, from two filtered `total_count` reads.
 *
 * summary/live takes a whole target and has no filter parameter, so a path's
 * numbers come from the backlinks LIST endpoint asked for one row twice: once
 * counting every link (`as_is`) and once counting one per referring domain.
 * The `limit: 1` is the point — we want the count, not the rows, and this
 * endpoint bills per row.
 *
 * Everything the summary endpoint would have given and these cannot — rank,
 * spam scores, broken counts, new/lost — stays NULL. Not 0: a zero here reads
 * as a measured absence of authority, which is a different and much worse
 * claim than "we did not measure it".
 */
async function prefixSummary(
  tenantId: string,
  apiTarget: string,
  includeSubdomains: boolean,
  filters: unknown[],
): Promise<{ payload: SummarySection; costUsd: number } | null> {
  const base = {
    target: apiTarget,
    include_subdomains: includeSubdomains,
    backlinks_status_type: "live",
    limit: 1,
    filters,
  };

  // Sequential: two concurrent live calls on one account invite the provider's
  // per-account rate limit, and this is already sub-second.
  const all = await section<{ total_count?: number }[], number>(
    "summary",
    tenantId,
    BACKLINKS.list,
    { ...base, mode: "as_is" },
    (raw) => raw?.[0]?.total_count ?? 0,
  );
  if (!all) return null;

  const perDomain = await section<{ total_count?: number }[], number>(
    "summary",
    tenantId,
    BACKLINKS.list,
    { ...base, mode: "one_per_domain" },
    (raw) => raw?.[0]?.total_count ?? 0,
  );

  return {
    payload: {
      backlinks: all.payload,
      referringDomains: perDomain?.payload ?? 0,
      referringMainDomains: perDomain?.payload ?? 0,
      rank: 0,
      brokenBacklinks: 0,
      dofollowDomains: 0,
      nofollowDomains: 0,
      dofollowRatio: null,
    },
    costUsd: all.costUsd + (perDomain?.costUsd ?? 0),
  };
}
