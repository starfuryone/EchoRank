// src/lib/api-daily-quota.ts — the public API's daily request allowance per
// workspace: PLAN_CONFIGS[plan].quotaDefaults.maxApiRequestsPerDay, counted in
// Redis per UTC day (CLAUDE.md "Data and limits": a day-keyed INCR with a TTL
// past the day, the shape of src/lib/site-audit/quota.ts).
//
// ALONGSIDE THE 60/MIN LIMIT, NOT INSTEAD OF IT. The per-minute window is per
// KEY and smooths bursts; this is per WORKSPACE (every key of the tenant draws
// on one allowance) and is the figure the pricing table sells
// (pricing-page/compare.ts: "10,000 requests/day" on Agency).
//
// FAILS OPEN when Redis is unreachable. The per-minute limiter still applies
// (it falls back to memory), and every endpoint that spends money behind the
// API keeps its own fail-closed quota (SEO searches, crawl pages). Refusing a
// paying Agency customer's whole API because Redis blinked is the worse
// failure for a request counter that costs us nothing to exceed by a few.
//
// Server-only: it opens a Redis connection.
import "server-only";
import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "api-daily-quota" });

/** Two days: past the UTC day the key counts, so it self-cleans. */
const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

export function apiDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function apiDailyQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:api:requests:${tenantId}:${apiDayKey(now)}`;
}

export function apiDailyLimit(plan: PlanType): number {
  return PLAN_CONFIGS[plan].quotaDefaults.maxApiRequestsPerDay;
}

/** The next 00:00 UTC, when the allowance resets. */
export function apiDailyResetsAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Requests counted today (read-only, for the plan hub). Null when Redis is down. */
export async function apiRequestsToday(tenantId: string, now = new Date()): Promise<number | null> {
  try {
    const raw = await getRedisConnection().get(apiDailyQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return null;
  }
}

export interface ApiDailyDecision {
  allowed: boolean;
  /** Requests counted today, this one included when allowed. */
  used: number;
  limit: number;
  resetsAt: Date;
}

/**
 * Count one request against today's allowance. INCR first and give the slot
 * back when over the line, so two concurrent calls cannot both take the last
 * one (the read-then-write alternative races).
 */
export async function consumeApiRequest(tenantId: string, plan: PlanType, now = new Date()): Promise<ApiDailyDecision> {
  const limit = apiDailyLimit(plan);
  const resetsAt = apiDailyResetsAt(now);
  const key = apiDailyQuotaKey(tenantId, now);
  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    if (used === 1) await redis.expire(key, KEY_TTL_SECONDS);
  } catch (err) {
    log.warn({ err, tenantId }, "API daily quota unavailable; allowing the request");
    return { allowed: true, used: 0, limit, resetsAt };
  }
  if (used > limit) {
    try {
      await getRedisConnection().decr(key);
    } catch {
      // The day key expires on its own; an over-count of one only ever errs
      // towards refusing, and only for the rest of this day.
    }
    return { allowed: false, used: limit, limit, resetsAt };
  }
  return { allowed: true, used, limit, resetsAt };
}
