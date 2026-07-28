// src/lib/rank-tracker/quota.ts
//
// Two DIFFERENT limits live here, and conflating them is the bug this comment
// exists to prevent:
//
//  1. TRACKED KEYWORDS — current state. How many RankKeyword rows the tenant
//     holds right now. Counted from Postgres, never Redis: a counter would
//     never fall when a tenant deletes keywords, and would wrongly reset at
//     the month boundary. Enforced at project create/edit and re-checked by
//     the scheduler (a downgrade can put an existing project over its cap).
//
//  2. KEYWORD CHECKS PER MONTH — spend. How many task_posts the tenant has
//     made this month. Month-keyed Redis INCR, same pattern as serp/quota.ts,
//     so it survives `pm2 restart` and is shared by the web and worker
//     processes — both the scheduler and "Run now" reserve against it.
//
// Limit 1 bounds the schedule; limit 2 bounds everything including manual runs.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { prisma } from "@/lib/prisma";
import { checksPerMonthLimit, trackedKeywordLimit } from "./options";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function rankMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function rankQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:rank-tracker:checks:${tenantId}:${rankMonthKey(now)}`;
}

export class RankQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Rank Tracker quota is temporarily unavailable");
    this.name = "RankQuotaUnavailableError";
  }
}

export class RankCheckQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly rank check limit reached (${limit} on the ${plan} plan). Upgrade for more checks.`,
    );
    this.name = "RankCheckQuotaExceededError";
  }
}

export class RankKeywordCapExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly requested: number,
    readonly plan: PlanType,
  ) {
    super(
      `This would track ${requested} keywords; the ${plan} plan allows ${limit}. Upgrade to track more.`,
    );
    this.name = "RankKeywordCapExceededError";
  }
}

// ─── 1. Tracked keywords (Postgres, current state) ──────────────────────────

/**
 * Keywords this tenant currently tracks across every project.
 *
 * `excludeProjectId` is for the edit path: when a project is being rewritten,
 * its existing keywords must not be counted against the new list, or editing a
 * 50-keyword project at a 50 cap would always fail.
 */
export async function trackedKeywordCount(
  tenantId: string,
  excludeProjectId?: string,
): Promise<number> {
  return prisma.rankKeyword.count({
    where: {
      project: {
        tenantId,
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
      },
    },
  });
}

export interface KeywordCapDecision {
  allowed: boolean;
  /** Total the tenant would hold if this request were accepted. */
  requested: number;
  limit: number;
  /** Keywords already tracked in OTHER projects. */
  existing: number;
}

/** Would adding `incoming` keywords (replacing `excludeProjectId`'s) fit? */
export async function checkKeywordCap(
  tenantId: string,
  plan: PlanType,
  incoming: number,
  excludeProjectId?: string,
): Promise<KeywordCapDecision> {
  const limit = trackedKeywordLimit(plan);
  const existing = await trackedKeywordCount(tenantId, excludeProjectId);
  const requested = existing + incoming;
  return { allowed: requested <= limit, requested, limit, existing };
}

// ─── 2. Monthly keyword checks (Redis, spend) ───────────────────────────────

export interface CheckQuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
  /** How many of the requested checks fit. 0 when none do. */
  granted: number;
}

/**
 * Reserves `count` keyword checks against this month's allowance.
 *
 * INCRBY first, then roll back when over the line: the read-then-write
 * alternative races two concurrent runs past the last slot. A run is
 * all-or-nothing — a partially-run project would show a misleading history
 * gap — so an over-cap request is rejected outright rather than truncated.
 *
 * Fails closed when Redis is unreachable: with no counter to enforce against,
 * letting a 250-keyword daily project loose is the worse failure.
 */
export async function reserveRankChecks(
  tenantId: string,
  plan: PlanType,
  count: number,
  now = new Date(),
): Promise<CheckQuotaDecision> {
  const limit = checksPerMonthLimit(plan);
  if (count <= 0) return { allowed: true, used: 0, limit, granted: 0 };

  const key = rankQuotaKey(tenantId, now);
  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incrby(key, count);
    // Only the first write of the month needs the TTL; EXPIRE is idempotent
    // and cheap, so setting it unconditionally avoids a TTL-less key if the
    // very first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new RankQuotaUnavailableError();
  }

  if (used > limit) {
    try {
      await getRedisConnection().decrby(key, count);
    } catch {
      // Best-effort rollback: the counter self-heals at the month boundary.
    }
    return { allowed: false, used: Math.max(used - count, 0), limit, granted: 0 };
  }

  return { allowed: true, used, limit, granted: count };
}

/** Give reserved checks back (nothing was posted upstream). */
export async function releaseRankChecks(
  tenantId: string,
  count: number,
  now = new Date(),
): Promise<void> {
  if (count <= 0) return;
  try {
    await getRedisConnection().decrby(rankQuotaKey(tenantId, now), count);
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "x of y used" UI line. */
export async function rankChecksUsed(
  tenantId: string,
  now = new Date(),
): Promise<number> {
  try {
    const raw = await getRedisConnection().get(rankQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}
