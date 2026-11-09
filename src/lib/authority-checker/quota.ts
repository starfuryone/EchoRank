// src/lib/authority-checker/quota.ts
//
// Per-tenant monthly Link Authority Checker counter: Redis INCR on a
// month-scoped key (the site-audit/quota.ts shape), so the count survives
// `pm2 restart` and is shared by every process. The limit is the plan's
// linkAuthorityChecksPerMonth (plan-config.ts); null = unlimited.
//
// Reserved BEFORE the first purchase and released when nothing was bought, so
// a failed check costs no allowance. A check answered wholly from the 7-day
// domain cache never reaches here (service.ts). Fails closed: with no counter
// to enforce against, the check is refused rather than bought.

import "server-only";

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { linkAuthorityChecksLimit } from "@/lib/plan-config";
import type { LinkAuthorityUsage } from "./types";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function linkAuthorityMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function linkAuthorityQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:link-authority:checks:${tenantId}:${linkAuthorityMonth(now)}`;
}

/** When this month's allowance resets: the first instant of next month, UTC. */
export function linkAuthorityResetsAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export class LinkAuthorityQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Link Authority Checker quota is temporarily unavailable");
    this.name = "LinkAuthorityQuotaUnavailableError";
  }
}

export class LinkAuthorityQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(readonly usage: LinkAuthorityUsage) {
    super(`Monthly Link Authority Checker limit reached (${usage.limit}).`);
    this.name = "LinkAuthorityQuotaExceededError";
  }
}

/** Checks used this month, without reserving. 0 when Redis cannot answer. */
export async function linkAuthorityUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(linkAuthorityQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export async function linkAuthorityUsage(tenantId: string, plan: PlanType, now = new Date()): Promise<LinkAuthorityUsage> {
  return {
    used: await linkAuthorityUsed(tenantId, now),
    limit: linkAuthorityChecksLimit(plan),
    resetsAt: linkAuthorityResetsAt(now).toISOString(),
  };
}

/**
 * Reserve one check. INCR first, then roll back when over the line, so two
 * concurrent checks cannot both take the last slot. Throws
 * LinkAuthorityQuotaExceededError at the limit (check N+1 is refused), and
 * LinkAuthorityQuotaUnavailableError when Redis cannot count.
 */
export async function reserveLinkAuthorityCheck(tenantId: string, plan: PlanType, now = new Date()): Promise<LinkAuthorityUsage> {
  const limit = linkAuthorityChecksLimit(plan);
  const resetsAt = linkAuthorityResetsAt(now).toISOString();
  const key = linkAuthorityQuotaKey(tenantId, now);
  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new LinkAuthorityQuotaUnavailableError();
  }
  if (limit !== null && used > limit) {
    try {
      await getRedisConnection().decr(key);
    } catch {
      // Best-effort rollback: the key expires with the month.
    }
    throw new LinkAuthorityQuotaExceededError({ used: limit, limit, resetsAt });
  }
  return { used, limit, resetsAt };
}

/** Give a reserved check back (nothing was bought). Never throws. */
export async function releaseLinkAuthorityCheck(tenantId: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(linkAuthorityQuotaKey(tenantId, now));
  } catch {
    // Best-effort.
  }
}
