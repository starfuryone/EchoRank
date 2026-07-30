// src/lib/serp/service.ts
//
// SERP Checker submission path, shared by the POST route and its tests.
//
// Order of operations matters and is deliberate:
//   1. 24 h cache        — free, and never touches the monthly allowance
//   2. monthly quota     — Redis reservation, rolled back if step 4 fails
//   3. USD cap + meter   — inside seoMeteredCall (writes the SeoApiCall row)
//   4. task_post         — standard queue (priority 1), ~$0.0006
//   5. persist SerpCheck — status=queued; the serp-checks worker finishes it
//
// The results themselves arrive asynchronously: see
// src/infrastructure/queue/workers/serp-check.worker.ts.

import type { PlanType, SerpCheck } from "@/generated/prisma";
import { requireSeoQuota } from "@/lib/seo-quota";
import { prisma } from "@/lib/prisma";
import { SERP } from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { reserveSerpCheck, releaseSerpCheck } from "./quota";
import { SERP_CACHE_TTL_MS } from "./options";
import type {
  SerpCheckDto,
  SerpCheckStatus,
  SerpDevice,
  SerpResults,
} from "./types";

export {
  DEFAULT_DEVICE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  SERP_CACHE_TTL_MS,
} from "./options";

/**
 * Organic results requested per task.
 *
 * DataForSEO bills the standard queue per result PAGE, not per task: $0.0006
 * buys depth 10, so depth 100 is $0.006 (verified live, Jul 2026 — see the
 * recorded task_post fixture). Lowering this to 10 cuts the unit cost 10x at
 * the price of the top-100 table this tool exists to show.
 */
const SERP_DEPTH = 100;

export interface SerpCheckParams {
  keyword: string;
  locationCode: number;
  languageCode: string;
  device: SerpDevice;
}

export class SerpQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly SERP check limit reached (${limit} on the ${plan} plan). Upgrade for more checks.`,
    );
    this.name = "SerpQuotaExceededError";
  }
}

/** Prisma row -> API shape. Decimal and Date never cross the wire raw. */
export function toSerpCheckDto(
  row: SerpCheck,
  extra?: { cached?: boolean },
): SerpCheckDto {
  return {
    id: row.id,
    keyword: row.keyword,
    locationCode: row.locationCode,
    languageCode: row.languageCode,
    device: row.device as SerpDevice,
    status: row.status as SerpCheckStatus,
    costUsd: Number(row.costUsd),
    itemCount: row.itemCount,
    serpFeatures: Array.isArray(row.serpFeatures) ? (row.serpFeatures as string[]) : [],
    results: (row.results as SerpResults | null) ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    ...(extra?.cached ? { cached: true } : {}),
  };
}

/** Newest completed check for this exact query inside the cache window. */
export async function findCachedCheck(
  tenantId: string,
  params: SerpCheckParams,
  now = new Date(),
): Promise<SerpCheck | null> {
  return prisma.serpCheck.findFirst({
    where: {
      tenantId,
      keyword: params.keyword,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      device: params.device,
      status: "completed",
      createdAt: { gte: new Date(now.getTime() - SERP_CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Cache hit -> the stored check; otherwise reserve quota, post a standard-queue
 * task and return the new `queued` row.
 *
 * Throws SerpQuotaExceededError (429), SerpQuotaUnavailableError (503), or
 * DataforseoError (mapped by seoErrorResponse).
 */
export async function submitSerpCheck(
  tenantId: string,
  plan: PlanType,
  params: SerpCheckParams,
): Promise<{ check: SerpCheckDto; cached: boolean }> {
  const cached = await findCachedCheck(tenantId, params);
  if (cached) {
    return { check: toSerpCheckDto(cached, { cached: true }), cached: true };
  }

  // Pooled monthly search quota (Postgres). Runs alongside the per-tool
  // reservation below and the USD cap inside the metered call — any of the
  // three can deny. Placed after the cache check on purpose: serving a
  // stored result costs nothing, so an exhausted tenant can still reopen
  // what they already paid for.
  await requireSeoQuota(tenantId, plan, "keyword_research");

  const quota = await reserveSerpCheck(tenantId, plan);
  if (!quota.allowed) {
    throw new SerpQuotaExceededError(quota.limit, plan);
  }

  let posted;
  try {
    posted = await seoMeteredCallResult<unknown[]>(tenantId, SERP.organicTaskPost, {
      keyword: params.keyword,
      location_code: params.locationCode,
      language_code: params.languageCode,
      device: params.device,
      os: params.device === "mobile" ? "android" : "windows",
      // priority 1 = standard queue (the cheap one). 2 would be "high".
      priority: 1,
      depth: SERP_DEPTH,
    });
  } catch (err) {
    // Nothing was queued, so the reservation must not be spent.
    await releaseSerpCheck(tenantId);
    throw err;
  }

  const row = await prisma.serpCheck.create({
    data: {
      tenantId,
      keyword: params.keyword,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      device: params.device,
      dataforseoTaskId: posted.taskId ?? null,
      status: "queued",
      // Bill from the envelope, never a price table (dataforseo/metering.ts).
      costUsd: posted.billing.costUsd,
    },
  });

  return { check: toSerpCheckDto(row), cached: false };
}
