// src/lib/content-explorer/quota.ts
//
// Per-tenant monthly Content Explorer search counter. Redis INCR on a
// month-scoped key so the count survives `pm2 restart` and is shared across web
// processes — an in-process Map would reset on every deploy and hand every
// tenant a fresh allowance of a five-cent call.
//
// This is a COUNT limit (searches/month), separate from and stricter than the
// USD cap in dataforseo/metering.ts. Both are enforced: quota first (cheap,
// Redis), then the USD cap inside seoMeteredCall.
//
// Deliberately parallel to backlinks/quota.ts and site-explorer/quota.ts rather
// than shared with them: each tool has an independent allowance, and a shared
// helper would need a tool discriminator threaded through every call for no gain.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { contentSearchLimit } from "./options";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function contentMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function contentQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:content-explorer:searches:${tenantId}:${contentMonthKey(now)}`;
}

export class ContentQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Content Explorer quota is temporarily unavailable");
    this.name = "ContentQuotaUnavailableError";
  }
}

export class ContentQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly Content Explorer limit reached (${limit} on the ${plan} plan). Upgrade for more searches.`,
    );
    this.name = "ContentQuotaExceededError";
  }
}

/** The tool is not in this plan at all — the UI shows the locked card. */
export class ContentPlanLockedError extends Error {
  readonly statusCode = 403;
  constructor(readonly plan: PlanType) {
    super("Content Explorer is not included in this plan");
    this.name = "ContentPlanLockedError";
  }
}

export interface QuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
}

/**
 * Reserves one search against this month's allowance.
 *
 * INCR first, then roll back when over the line: the read-then-write
 * alternative races two concurrent submissions past the last slot, and each one
 * that gets through costs ~5 cents. Callers MUST `releaseContentSearch` if no
 * upstream call was actually made.
 *
 * Fails closed when Redis is unreachable. With no counter to enforce against,
 * letting searches through spends real money with no ceiling, which is the worse
 * failure for a tool whose every call bills whether it finds anything or not.
 */
export async function reserveContentSearch(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<QuotaDecision> {
  const limit = contentSearchLimit(plan);
  if (limit <= 0) throw new ContentPlanLockedError(plan);

  const key = contentQuotaKey(tenantId, now);
  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // Only the first write of the month needs the TTL, but EXPIRE is idempotent
    // and cheap, so setting it unconditionally avoids a TTL-less key if the very
    // first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new ContentQuotaUnavailableError();
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

/** Give a reserved search back (nothing was spent upstream). */
export async function releaseContentSearch(
  tenantId: string,
  now = new Date(),
): Promise<void> {
  try {
    await getRedisConnection().decr(contentQuotaKey(tenantId, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "x of y used" UI line. */
export async function contentSearchesUsed(
  tenantId: string,
  now = new Date(),
): Promise<number> {
  try {
    const raw = await getRedisConnection().get(contentQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
