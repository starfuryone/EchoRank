// src/lib/site-audit/quota.ts
//
// Per-tenant monthly Site Audit counter. Redis INCR on a month-scoped key, so
// the count survives `pm2 restart` and is shared across web and worker
// processes — an in-process Map would reset on every deploy and hand every
// tenant a fresh allowance of a per-page-billed crawl.
//
// This is a COUNT limit (audits/month), separate from the PAGE limit in
// options.ts (which bounds what one audit costs) and from the USD cap in
// dataforseo/metering.ts. All three are enforced.
//
// Deliberately parallel to the other tools' quota modules rather than shared:
// each tool has an independent allowance, and a shared helper would need a
// tool discriminator threaded through every call for no gain.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { auditLimit } from "./options";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function siteAuditMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function siteAuditQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:site-audit:audits:${tenantId}:${siteAuditMonthKey(now)}`;
}

export class SiteAuditQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Site Audit quota is temporarily unavailable");
    this.name = "SiteAuditQuotaUnavailableError";
  }
}

export class SiteAuditQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly Site Audit limit reached (${limit} on the ${plan} plan). Upgrade for more audits.`,
    );
    this.name = "SiteAuditQuotaExceededError";
  }
}

export interface QuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
}

/**
 * Reserves one audit against this month's allowance.
 *
 * INCR first, then roll back when over the line: the read-then-write
 * alternative races two concurrent submissions past the last slot. Callers
 * MUST `releaseSiteAudit` if no crawl was actually posted.
 *
 * Fails closed when Redis is unreachable — with no counter to enforce
 * against, letting a 500-page crawl through is the worse failure.
 */
export async function reserveSiteAudit(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<QuotaDecision> {
  const limit = auditLimit(plan);
  const key = siteAuditQuotaKey(tenantId, now);

  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // Only the first write of the month needs the TTL; EXPIRE is idempotent
    // and cheap, so setting it unconditionally avoids a TTL-less key if the
    // very first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new SiteAuditQuotaUnavailableError();
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

/** Give a reserved audit back (no crawl was posted, nothing was billed). */
export async function releaseSiteAudit(tenantId: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(siteAuditQuotaKey(tenantId, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "x of y used" UI line. */
export async function siteAuditsUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(siteAuditQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
