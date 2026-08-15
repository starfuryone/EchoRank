// src/lib/opportunity-scanner/quota.ts
//
// Per-tenant monthly BATCH allowance for the Agency Opportunity Scanner.
//
// Redis INCR on a month-scoped key, TTL past the longest month — the shape
// src/lib/site-audit/quota.ts established and the one CLAUDE.md points at. An
// in-process Map would reset on every `pm2 restart`, and this box restarts
// often enough that a Map would effectively be no limit at all.
//
// ── Batches, not rows ───────────────────────────────────────────────────────
// The counter is BATCHES submitted, and the row ceiling (MAX_BATCH_ROWS = 1000)
// bounds what one batch costs. Two limits rather than one pooled row budget,
// because they stop different things: the row cap stops one submit from pinning
// the worker fleet for an afternoon, and the batch cap stops a tenant from
// running the scanner as a continuous background crawler. A single "rows per
// month" figure would let 60 x 1000 through as easily as 60,000 x 1, and the
// first of those is the one that hurts.
//
// The Places spend is NOT capped here. That runs through the existing monthly
// USD cap on SeoApiCall (see places.ts), which is the cap that already governs
// every metered upstream call in the app. A second dollar ceiling owned by one
// tool is how two caps end up disagreeing about the same month.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

/**
 * Batches per month, by plan.
 *
 * Only AGENCY and ENTERPRISE can reach this code at all — the route is behind
 * requireFeature("whitelabel"). The lower tiers are present and zero so that
 * this map is exhaustive over PlanType: a new tier added to the enum is a
 * compile error here rather than an `undefined` limit that compares false
 * against every count and silently grants infinity.
 */
export const BATCH_LIMITS: Record<PlanType, number> = {
  AI_VISIBILITY: 0,
  STARTER: 0,
  GROWTH: 0,
  AGENCY: 20,
  ENTERPRISE: 100,
};

export function batchLimit(plan: PlanType): number {
  return BATCH_LIMITS[plan] ?? 0;
}

export function scanMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function scanQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:opportunity-scanner:batches:${tenantId}:${scanMonthKey(now)}`;
}

export class ScanQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Scanner quota is temporarily unavailable");
    this.name = "ScanQuotaUnavailableError";
  }
}

export class ScanQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly scan limit reached (${limit} batches on the ${plan} plan).`,
    );
    this.name = "ScanQuotaExceededError";
  }
}

export interface QuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
}

/**
 * Reserve one batch against this month's allowance.
 *
 * INCR first, roll back when over: read-then-write races two concurrent
 * submits past the last slot. Callers MUST releaseScanBatch() if the batch is
 * not actually created — a validation failure after the reserve would
 * otherwise burn a slot for a submit that scanned nothing.
 *
 * FAILS CLOSED when Redis is down, matching site-audit. With no counter to
 * enforce against, letting an unbounded number of 1000-domain batches through
 * is the worse failure — this is the one tool here that can put four workers
 * on external HTTP for hours.
 */
export async function reserveScanBatch(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<QuotaDecision> {
  const limit = batchLimit(plan);
  const key = scanQuotaKey(tenantId, now);

  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // EXPIRE is idempotent and cheap; setting it every time avoids a TTL-less
    // key if the month's very first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new ScanQuotaUnavailableError();
  }

  if (used > limit) {
    try {
      await getRedisConnection().decr(key);
    } catch {
      // Best-effort rollback; the counter self-heals at the month boundary.
    }
    return { allowed: false, used: limit, limit };
  }

  return { allowed: true, used, limit };
}

/** Give a reserved batch back (nothing was enqueued). */
export async function releaseScanBatch(tenantId: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(scanQuotaKey(tenantId, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "x of y used" line at submit. */
export async function scanBatchesUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(scanQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
