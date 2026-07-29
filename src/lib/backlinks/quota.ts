// src/lib/backlinks/quota.ts
//
// Per-tenant monthly Backlinks-analysis counter. Redis INCR on a month-scoped
// key, so the count survives `pm2 restart` and is shared across web processes —
// an in-process Map would reset on every deploy and hand every tenant a fresh
// allowance, which for a five-call tool is the expensive kind of bug.
//
// This is a COUNT limit (analyses/month), separate from and stricter than the
// USD cap in dataforseo/metering.ts. Both are enforced: quota first (cheap,
// Redis), then the USD cap inside seoMeteredCall.
//
// Deliberately parallel to site-explorer/quota.ts rather than shared with it:
// the two tools have independent allowances, and a shared helper would need a
// tool discriminator threaded through every call for no gain.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { backlinksAnalysisLimit } from "./options";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function backlinksMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function backlinksQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:backlinks:analyses:${tenantId}:${backlinksMonthKey(now)}`;
}

export class BacklinksQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Backlinks quota is temporarily unavailable");
    this.name = "BacklinksQuotaUnavailableError";
  }
}

export class BacklinksQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly Backlinks limit reached (${limit} on the ${plan} plan). Upgrade for more analyses.`,
    );
    this.name = "BacklinksQuotaExceededError";
  }
}

/** The tool is not in this plan at all — the UI shows the locked card. */
export class BacklinksPlanLockedError extends Error {
  readonly statusCode = 403;
  constructor(readonly plan: PlanType) {
    super("Backlinks is not included in this plan");
    this.name = "BacklinksPlanLockedError";
  }
}

export interface QuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
}

/**
 * Reserves one analysis against this month's allowance.
 *
 * INCR first, then roll back when over the line: the read-then-write
 * alternative races two concurrent submissions past the last slot. Callers
 * MUST `releaseBacklinksAnalysis` if nothing was actually spent upstream.
 *
 * Fails closed when Redis is unreachable — with no counter to enforce against,
 * letting five billed calls through is the worse failure.
 */
export async function reserveBacklinksAnalysis(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<QuotaDecision> {
  const limit = backlinksAnalysisLimit(plan);
  const key = backlinksQuotaKey(tenantId, now);

  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // Only the first write of the month needs the TTL; EXPIRE is idempotent
    // and cheap, so setting it unconditionally avoids a TTL-less key if the
    // very first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new BacklinksQuotaUnavailableError();
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

/** Give a reserved analysis back (nothing was billed). */
export async function releaseBacklinksAnalysis(
  tenantId: string,
  now = new Date(),
): Promise<void> {
  try {
    await getRedisConnection().decr(backlinksQuotaKey(tenantId, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "x of y used" UI line. */
export async function backlinksAnalysesUsed(
  tenantId: string,
  now = new Date(),
): Promise<number> {
  try {
    const raw = await getRedisConnection().get(backlinksQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
