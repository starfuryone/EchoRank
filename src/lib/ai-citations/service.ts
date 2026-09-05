// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/ai-citations/service.ts
//
// The AI Citations lookup: the ONE place this feature can spend money.
//
// ── THE ORDER IS THE DESIGN ────────────────────────────────────────────────
//   1. verification flag  — free; a disabled account never reaches the API
//   2. plan gate          — free
//   3. day-bucket cache   — free, and never touches the allowance
//   4. pooled quota       — ONE search for the whole lookup, not one per call
//   5. the fan-out        — up to four calls per platform, each metered
//   6. persist + log      — the row is the result AND the cache entry
//
// Step 3 before step 4 is the rule the Backlinks and Site Explorer services
// already follow, and it matters most on an exhausted workspace: replaying a
// stored result costs nothing, so a customer who has run out of searches can
// still reopen what they already bought.
//
// Step 4 counts ONCE. One lookup is one user action; the fan-out below is an
// implementation detail of that action, and charging a customer four searches
// because we chose to call four endpoints would make the allowance describe
// our architecture rather than their usage. Every call's real cost still lands
// on the USD cap through seoMeteredCallResult — one allowance, N costs.
//
// ── THE SINGLE ENTRY POINT ─────────────────────────────────────────────────
// GREP GUARD: `runAiCitationsLookup` is the only exported function in this
// feature that calls seoMeteredCallResult, and nothing outside this file may
// call the AI_OPTIMIZATION endpoints. If a second spending path ever appears —
// a worker, a cron, a second route — the cache probe and the allowance check
// exist in one place and that path will not have them. Same discipline as
// keyword-opportunity/start.ts.
//
// ── PARTIAL FAILURE IS A RESULT ────────────────────────────────────────────
// One platform failing must not discard the other's data, which the customer
// has already been billed for. Each platform runs inside its own try/catch and
// its key lands in `failedPlatforms`. Only an all-platforms failure throws.

import "server-only";

import type { AiCitationsAnalysis, PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireSeoQuota } from "@/lib/seo-quota";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { recordResearch } from "@/lib/research-log/store";
import {
  AI_OPTIMIZATION,
  CHATGPT_LANGUAGE_CODE,
  CHATGPT_LOCATION_CODE,
  buildLlmTarget,
  type LlmAggregatedTotal,
  type LlmCrossAggregatedItem,
  type LlmMentionItem,
  type LlmPlatform,
  type LlmTopPagesItem,
} from "@/lib/dataforseo/endpoints";
import { deriveCitedSources, roundOrNull, type PlatformBundle } from "./cited-sources";
import {
  computeShareOfVoice,
  resolveCompetitorGroups,
  type CrossOutcome,
} from "./share-of-voice";
import {
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  MAX_COMPETITORS,
  MENTIONS_SAMPLE_LIMIT,
  PROMPTS_PER_SOURCE,
  SOURCES_PER_PLATFORM,
  TOP_PAGES_LIST_LIMIT,
  aiCitationsEnabled,
  cacheKeyFor,
  msUntilNextBucket,
} from "./options";
import { includeSubdomainsFor, targetCacheKey, type CitationTarget } from "./target";
import type {
  AiCitationsAnalysisDto,
  AiCitationsStatus,
  CitedSourceRow,
  PlatformTotal,
  ShareOfVoiceSection,
} from "./types";

// ─── Typed failures ──────────────────────────────────────────────────────────

/** The account has not been verified for the AI Optimization product. */
export class AiCitationsNotEnabledError extends Error {
  readonly statusCode = 503;
  readonly code = "NOT_ENABLED";
  constructor() {
    super(
      "AI Citations is not enabled on this deployment yet. It needs the AI Optimization product on the connected SEO data account.",
    );
    this.name = "AiCitationsNotEnabledError";
  }
}

/** STARTER does not include this tool. */
export class AiCitationsPlanLockedError extends Error {
  readonly statusCode = 403;
  readonly code = "PLAN_LOCKED";
  constructor(readonly plan: PlanType) {
    super("AI Citations is available on the Growth plan and above.");
    this.name = "AiCitationsPlanLockedError";
  }
}

/** Every platform failed — nothing was worth persisting. */
export class AiCitationsFailedError extends Error {
  readonly statusCode = 502;
  readonly code = "TASK_FAILED";
  constructor() {
    super("Could not read AI citations for this target right now.");
    this.name = "AiCitationsFailedError";
  }
}

/**
 * Plans that include the tool.
 *
 * STARTER is out for the same reason it is out of Backlinks: this is a
 * GROWTH-and-up feature, so STARTER sees a locked card with an upgrade path
 * rather than an empty form it cannot submit.
 */
export function planCanUseAiCitations(plan: PlanType): boolean {
  return plan !== "STARTER" && plan !== "AI_VISIBILITY";
}

// ─── Params ──────────────────────────────────────────────────────────────────

export interface AiCitationsParams {
  /** Already parsed by parseCitationTarget(). */
  target: CitationTarget;
  platforms: LlmPlatform[];
  /** Brand labels to compare against. Deduped and capped by the service. */
  competitors: string[];
  /** Market for `google`. ChatGPT is pinned to US/en by the provider. */
  locationCode?: number;
  languageCode?: string;
}

// ─── DTO ─────────────────────────────────────────────────────────────────────

function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function toAiCitationsDto(
  row: AiCitationsAnalysis,
  extra?: { cached?: boolean; now?: Date },
): AiCitationsAnalysisDto {
  const dto: AiCitationsAnalysisDto = {
    id: row.id,
    target: row.target,
    scope: row.scope as AiCitationsAnalysisDto["scope"],
    platforms: jsonArray<LlmPlatform>(row.platforms),
    competitors: jsonArray<string>(row.competitors),
    status: row.status as AiCitationsStatus,
    costUsd: Number(row.costUsd),
    totals: jsonArray<PlatformTotal>(row.totals),
    sources: jsonArray<CitedSourceRow>(row.sources),
    shareOfVoice: (row.shareOfVoice as ShareOfVoiceSection | null) ?? null,
    failedPlatforms: jsonArray<LlmPlatform>(row.failedPlatforms),
    createdAt: row.createdAt.toISOString(),
  };

  if (extra?.cached) {
    dto.cached = true;
    // Counts down to the bucket rolling, not to a rolling 24h from the run —
    // see options.ts. The UI turns it into "Re-run available in 7h".
    dto.reRunAvailableInMs = msUntilNextBucket(extra.now ?? new Date());
  }
  return dto;
}

/** The stored row for this exact key, or null. */
export async function findCachedAnalysis(
  tenantId: string,
  params: AiCitationsParams,
  now = new Date(),
): Promise<AiCitationsAnalysis | null> {
  return prisma.aiCitationsAnalysis.findFirst({
    where: {
      tenantId,
      cacheKey: cacheKeyFor(targetCacheKey(params.target), params.platforms, now),
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── The fan-out ─────────────────────────────────────────────────────────────

/**
 * A market a platform can actually answer for.
 *
 * ChatGPT mention data is US/en ONLY — a provider restriction, not a default we
 * picked. Sending a chat_gpt call for another market returns nothing HAVING
 * BEEN BILLED, so pinning here is the difference between an empty section and
 * an empty section that cost money.
 */
function marketFor(
  platform: LlmPlatform,
  params: AiCitationsParams,
): { locationCode: number; languageCode: string } {
  if (platform === "chat_gpt") {
    return { locationCode: CHATGPT_LOCATION_CODE, languageCode: CHATGPT_LANGUAGE_CODE };
  }
  return {
    locationCode: params.locationCode ?? DEFAULT_LOCATION_CODE,
    languageCode: params.languageCode ?? DEFAULT_LANGUAGE_CODE,
  };
}

type Billed<T> = { data: T; costUsd: number };

/** One metered call. Returns null on failure; the caller records the platform. */
async function call<T>(
  tenantId: string,
  label: string,
  path: string,
  task: Record<string, unknown>,
): Promise<Billed<T> | null> {
  try {
    const { data, billing } = await seoMeteredCallResult<T>(tenantId, path, task);
    return { data, costUsd: billing.costUsd };
  } catch (err) {
    // Logged rather than swallowed: a call failing for every tenant is an
    // upstream contract change, and the server log is the only place that is
    // visible before a customer reports it.
    console.error(
      `[ai-citations] ${label} failed for tenant ${tenantId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** `result[0]` of a live envelope, as an object. */
function firstResult(data: unknown): Record<string, unknown> | null {
  if (!Array.isArray(data)) return null;
  const first = data[0];
  return typeof first === "object" && first !== null ? (first as Record<string, unknown>) : null;
}

function itemsOf<T>(data: unknown): T[] {
  const result = firstResult(data);
  const items = result?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// ─── The entry point ─────────────────────────────────────────────────────────

/**
 * Run a lookup, or replay today's.
 *
 * Throws AiCitationsNotEnabledError (503), AiCitationsPlanLockedError (403),
 * SeoQuotaExceededError (429), AiCitationsFailedError (502), or
 * DataforseoError (mapped by seoErrorResponse).
 */
export async function runAiCitationsLookup(
  tenantId: string,
  plan: PlanType,
  params: AiCitationsParams,
  now = new Date(),
): Promise<{ analysis: AiCitationsAnalysisDto; cached: boolean }> {
  // 1. The flag. Checked FIRST, before the plan gate, so a workspace on a
  //    qualifying plan is told "not enabled here" rather than nothing.
  if (!aiCitationsEnabled()) throw new AiCitationsNotEnabledError();

  // 2. Plan.
  if (!planCanUseAiCitations(plan)) throw new AiCitationsPlanLockedError(plan);

  // 3. Cache, before the allowance.
  const cached = await findCachedAnalysis(tenantId, params, now);
  if (cached) {
    return { analysis: toAiCitationsDto(cached, { cached: true, now }), cached: true };
  }

  // 4. One search for the whole lookup. See the header.
  await requireSeoQuota(tenantId, plan, "ai_citations", now);

  const { target, platforms } = params;
  const competitors = resolveCompetitorGroups(
    target.hostname,
    params.competitors,
    MAX_COMPETITORS,
  );

  const llmTarget = buildLlmTarget({
    type: "domain",
    value: target.hostname,
    includeSubdomains: includeSubdomainsFor(target.scope),
  });

  // Post-filter only when the scope is narrower than a hostname. A whole-domain
  // lookup passes null so no page is dropped.
  const pageFilter =
    target.scope === "subfolder" || target.scope === "exact_url" ? target : null;

  const bundles: PlatformBundle[] = [];
  const totals: PlatformTotal[] = [];
  const crossOutcomes: CrossOutcome[] = [];
  const failedPlatforms: LlmPlatform[] = [];
  let costUsd = 0;

  // Sequential per platform, not Promise.all: concurrent live calls against one
  // DataForSEO account invite its per-account rate limit, and the whole fan-out
  // is still inside the few seconds the UI promises.
  for (const platform of platforms) {
    const market = marketFor(platform, params);
    const base = {
      target: [llmTarget],
      platform,
      location_code: market.locationCode,
      language_code: market.languageCode,
    };

    const [aggregated, topPages, mentions] = [
      await call<LlmAggregatedTotal[]>(
        tenantId,
        `aggregated/${platform}`,
        AI_OPTIMIZATION.llmMentionsAggregated,
        { ...base, internal_list_limit: 10 },
      ),
      await call<LlmTopPagesItem[]>(
        tenantId,
        `top_pages/${platform}`,
        AI_OPTIMIZATION.llmMentionsTopPages,
        {
          ...base,
          links_scope: "sources",
          items_list_limit: TOP_PAGES_LIST_LIMIT,
          internal_list_limit: 5,
        },
      ),
      await call<LlmMentionItem[]>(
        tenantId,
        `search/${platform}`,
        AI_OPTIMIZATION.llmMentionsSearch,
        { ...base, limit: MENTIONS_SAMPLE_LIMIT },
      ),
    ];

    for (const result of [aggregated, topPages, mentions]) {
      if (result) costUsd += result.costUsd;
    }

    // A platform counts as failed only when its AUTHORITATIVE call failed. The
    // mentions sample is the optional half — losing it costs example prompts,
    // not the table — so a platform with top_pages and no sample is a complete
    // result with thinner colour, not a broken one.
    if (!topPages) {
      failedPlatforms.push(platform);
      continue;
    }

    bundles.push({
      platform,
      topPages: itemsOf<LlmTopPagesItem>(topPages.data),
      mentions: mentions ? itemsOf<LlmMentionItem>(mentions.data) : [],
    });

    const totalBlock = firstResult(aggregated?.data)?.total as LlmAggregatedTotal | undefined;
    const group = totalBlock?.platform?.find((entry) => entry?.key === platform);
    totals.push({
      platform,
      mentions: roundOrNull(group?.mentions),
      aiSearchVolume: roundOrNull(group?.ai_search_volume),
      impressions: roundOrNull(group?.impressions),
    });

    // The competitor comparison is one extra call per platform, and only when
    // competitors were actually supplied — the provider requires 2..10 groups,
    // and target-plus-nothing is one.
    if (competitors.length > 0) {
      const cross = await call<LlmCrossAggregatedItem[]>(
        tenantId,
        `cross_aggregated/${platform}`,
        AI_OPTIMIZATION.llmMentionsCrossAggregated,
        {
          targets: [
            { aggregation_key: target.hostname, target: [llmTarget] },
            ...competitors.map((label) => ({
              aggregation_key: label,
              target: [buildLlmTarget({ type: "keyword", value: label })],
            })),
          ],
          platform,
          location_code: market.locationCode,
          language_code: market.languageCode,
          internal_list_limit: 5,
        },
      );
      if (cross) costUsd += cross.costUsd;
      crossOutcomes.push({
        platform,
        status: cross ? "success" : "error",
        items: cross ? itemsOf<LlmCrossAggregatedItem>(cross.data) : [],
      });
    }
  }

  // Nothing came back at all. Anything DataForSEO did bill is already recorded
  // as a SeoApiCall, so the USD ledger stays honest even though no row is kept.
  if (failedPlatforms.length === platforms.length) {
    throw new AiCitationsFailedError();
  }

  const sources = deriveCitedSources(
    bundles,
    { sourcesPerPlatform: SOURCES_PER_PLATFORM, promptsPerSource: PROMPTS_PER_SOURCE },
    pageFilter,
  );
  const shareOfVoice = computeShareOfVoice(crossOutcomes, target.hostname, competitors);

  const row = await prisma.aiCitationsAnalysis.create({
    data: {
      tenantId,
      target: target.display,
      scope: target.scope,
      cacheKey: cacheKeyFor(targetCacheKey(target), platforms, now),
      platforms,
      competitors,
      status: failedPlatforms.length > 0 ? "partial" : "completed",
      costUsd,
      // `as object`: Prisma's InputJsonValue wants an index signature, which the
      // named row interfaces deliberately do not have — the same cast the
      // Backlinks and Site Explorer services make.
      totals: totals as unknown as object,
      sources: sources as unknown as object,
      shareOfVoice: (shareOfVoice as unknown as object) ?? undefined,
      failedPlatforms,
      createdAt: now,
    },
  });

  await recordResearch({
    tenantId,
    feature: "ai_citations",
    target: target.display,
    metrics: {
      scope: target.scope,
      platforms: platforms.length,
      sources: sources.length,
      competitors: competitors.length,
      failedPlatforms: failedPlatforms.length,
    },
    costUsd,
    sourceRef: row.id,
    now,
  });

  console.info(
    `[ai-citations] tenant=${tenantId} target=${target.display} scope=${target.scope} ` +
      `platforms=${platforms.join(",")} sources=${sources.length} ` +
      `cost=$${costUsd.toFixed(6)} status=${row.status}` +
      (failedPlatforms.length ? ` failed=${failedPlatforms.join(",")}` : ""),
  );

  return { analysis: toAiCitationsDto(row), cached: false };
}

/** Newest lookups for the workspace. Read-only; never spends. */
export async function listAiCitationsHistory(tenantId: string, take = 20) {
  const rows = await prisma.aiCitationsAnalysis.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      target: true,
      scope: true,
      status: true,
      costUsd: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    target: row.target,
    scope: row.scope as AiCitationsAnalysisDto["scope"],
    status: row.status as AiCitationsStatus,
    costUsd: Number(row.costUsd),
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * One stored lookup, tenant-scoped.
 *
 * findFirst with BOTH ids — never findUnique on the id alone. CLAUDE.md's rule
 * for any route taking an :id, and this row contains a competitor comparison
 * the customer paid for.
 */
export async function readAiCitationsAnalysis(
  tenantId: string,
  id: string,
): Promise<AiCitationsAnalysisDto | null> {
  const row = await prisma.aiCitationsAnalysis.findFirst({ where: { id, tenantId } });
  return row ? toAiCitationsDto(row) : null;
}

/** The newest stored lookup, optionally for one target. The MCP tool's read. */
export async function readLatestAiCitations(
  tenantId: string,
  target?: string,
): Promise<AiCitationsAnalysisDto | null> {
  const row = await prisma.aiCitationsAnalysis.findFirst({
    where: { tenantId, ...(target ? { target } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return row ? toAiCitationsDto(row) : null;
}
