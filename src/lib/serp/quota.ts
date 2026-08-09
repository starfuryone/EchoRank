// src/lib/serp/quota.ts
//
// Per-tenant monthly SERP-check counter. Redis INCR on a month-scoped key, so
// the count survives web/worker restarts and is shared across processes — an
// in-process Map would reset on every `pm2 restart` and let a tenant re-spend
// its whole allowance.
//
// This is a COUNT limit (checks/month), separate from and stricter than the
// USD cap in dataforseo/metering.ts. Both are enforced: quota first (cheap,
// Redis), then the USD cap inside seoMeteredCall.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";

/**
 * Checks per calendar month, by plan.
 *
 * STARTER / GROWTH / AGENCY are the specified product limits. ENTERPRISE is
 * not part of the classic-SEO pricing sheet yet and gets a generous ceiling.
 * Retune here; nothing else reads these.
 */
export const SERP_CHECKS_PER_MONTH: Record<PlanType, number> = {
  /** @deprecated Retired tier; pinned to STARTER's value for legacy rows. */
  AI_VISIBILITY: 25,
  STARTER: 25,
  GROWTH: 200,
  AGENCY: 1000,
  ENTERPRISE: 5000,
};

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function serpMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function serpQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:serp:checks:${tenantId}:${serpMonthKey(now)}`;
}

export class SerpQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("SERP check quota is temporarily unavailable");
    this.name = "SerpQuotaUnavailableError";
  }
}

export interface QuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
}

/**
 * Reserves one check against this month's allowance.
 *
 * INCR first, then roll back when over the line: the read-then-write
 * alternative races two concurrent submissions past the last slot. Callers
 * MUST `releaseSerpCheck` if the reserved check is never actually posted to
 * DataForSEO (validation failure, upstream error).
 *
 * Fails closed when Redis is unreachable — there is no counter to enforce
 * against, and the worker that completes the check needs Redis anyway.
 */
export async function reserveSerpCheck(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<QuotaDecision> {
  const limit = SERP_CHECKS_PER_MONTH[plan] ?? SERP_CHECKS_PER_MONTH.STARTER;
  const key = serpQuotaKey(tenantId, now);

  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // Only the first write of the month needs the TTL; EXPIRE is idempotent
    // and cheap, so setting it unconditionally avoids a TTL-less key if the
    // very first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new SerpQuotaUnavailableError();
  }

  if (used > limit) {
    try {
      await getRedisConnection().decr(key);
    } catch {
      // Best-effort rollback: the counter self-heals at the month boundary.
    }
    return { allowed: false, used: limit, limit };
  }

  return { allowed: true, used, limit };
}

/** Give a reserved check back (post failed, nothing was billed). */
export async function releaseSerpCheck(
  tenantId: string,
  now = new Date(),
): Promise<void> {
  try {
    await getRedisConnection().decr(serpQuotaKey(tenantId, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "x of y used" UI line. */
export async function serpChecksUsed(
  tenantId: string,
  now = new Date(),
): Promise<number> {
  try {
    const raw = await getRedisConnection().get(serpQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
