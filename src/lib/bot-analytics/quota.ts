// src/lib/bot-analytics/quota.ts
//
// Per-tenant monthly cap on active access checks. Redis INCR on a month-scoped
// key, deliberately parallel to src/lib/site-audit/quota.ts — same shape, same
// reasoning, independent allowance.
//
// Why cap something this cheap: an access check costs us nothing in vendor spend
// (no DataForSEO, no LLM) but it sends a dozen requests to a customer's origin,
// and the button that triggers it is one click. Uncapped, a bored tenant on a
// slow afternoon is a small, well-attributed flood aimed at their own site from
// our IP. Ten a month is far above any honest use of a signal that changes on
// human timescales, and low enough that the flood never happens.
//
// The counter lives in Redis rather than an in-process Map because this box
// restarts on every deploy and a Map would hand every tenant a fresh allowance
// several times a day.

import { getRedisConnection } from "@/infrastructure/redis/connection";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

/**
 * Flat across every plan. The cap exists to bound requests at a customer's
 * origin, not to sell upgrades, so tiering it would be charging for politeness.
 */
export const BOT_CHECK_MONTHLY_LIMIT = 10;

export function botCheckMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function botCheckQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:bot-analytics:checks:${tenantId}:${botCheckMonthKey(now)}`;
}

export class BotCheckQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Bot access-check quota is temporarily unavailable");
    this.name = "BotCheckQuotaUnavailableError";
  }
}

export class BotCheckQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(readonly limit: number) {
    super(`Monthly access-check limit reached (${limit}). It resets on the 1st.`);
    this.name = "BotCheckQuotaExceededError";
  }
}

export interface QuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
}

/**
 * Reserves one access check against this month's allowance.
 *
 * INCR first, then roll back when over the line: the read-then-write
 * alternative races two concurrent clicks past the last slot. Callers MUST
 * `releaseBotCheck` if no probe was actually run.
 *
 * Fails closed when Redis is unreachable. With no counter to enforce against,
 * the failure mode of allowing is an uncapped request loop at a customer's
 * origin, which is worse than a button that reports itself unavailable.
 */
export async function reserveBotCheck(
  tenantId: string,
  now = new Date(),
): Promise<QuotaDecision> {
  const limit = BOT_CHECK_MONTHLY_LIMIT;
  const key = botCheckQuotaKey(tenantId, now);

  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // Only the first write of the month needs the TTL, but EXPIRE is idempotent
    // and cheap, so setting it unconditionally avoids a TTL-less key if the very
    // first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new BotCheckQuotaUnavailableError();
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

/** Give a reserved check back (no probe ran, nothing hit the customer's origin). */
export async function releaseBotCheck(tenantId: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(botCheckQuotaKey(tenantId, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "x of y used" UI line. */
export async function botChecksUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(botCheckQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
