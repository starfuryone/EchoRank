// src/lib/funnel/quota.ts
//
// Per-tenant monthly allowance for funnel audits.
//
// Redis INCR on a month-scoped key with a TTL past the longest month — the
// shape src/lib/site-audit/quota.ts established, that CLAUDE.md points at, and
// that src/lib/opportunity-scanner/quota.ts already copies. An in-process Map
// would reset on every `pm2 restart`, and this box restarts several times a day.
//
// ── This is a SECOND, unrelated limit ───────────────────────────────────────
// The public free-audit widget on our own landing page is capped at 1 per IP
// per day (src/app/api/av/audit/route.ts). That cap protects us from a stranger;
// this one protects us from a CUSTOMER — an agency whose funnel goes viral, or
// who points a load test at it, spends our sidecar time on every submission.
// They stop different things and neither substitutes for the other, so the
// funnel endpoint enforces both: a per-key+IP burst limit for the stranger and
// this monthly tenant ceiling for the account that owns the widget.
//
// The tenant is charged for AUDITS, not for leads. A submission that was rate
// limited, refused by the origin allowlist or rejected for a bad domain never
// reaches the reserve below, because none of those cost a sidecar call — and
// the sidecar call is the only thing here that costs anything.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

/**
 * Funnel audits per month, by plan.
 *
 * Only AGENCY and ENTERPRISE can reach this code — the config routes are behind
 * requireFeature("whitelabel"), and a funnel cannot exist without a config. The
 * lower tiers are present and zero so this map stays exhaustive over PlanType:
 * a tier added to the enum becomes a compile error here rather than an
 * `undefined` limit that compares false against every count and silently grants
 * infinity.
 */
export const FUNNEL_AUDIT_LIMITS: Record<PlanType, number> = {
  AI_VISIBILITY: 0,
  STARTER: 0,
  GROWTH: 0,
  AGENCY: 500,
  ENTERPRISE: 2500,
};

export function funnelAuditLimit(plan: PlanType): number {
  return FUNNEL_AUDIT_LIMITS[plan] ?? 0;
}

export function funnelMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function funnelQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:funnel:audits:${tenantId}:${funnelMonthKey(now)}`;
}

export interface FunnelQuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
  /** Set when Redis itself was the reason we refused. */
  unavailable?: boolean;
}

/**
 * Reserve one funnel audit against this month's allowance.
 *
 * INCR first and roll back when over: read-then-write races two concurrent
 * submissions past the last slot, and this endpoint is public, so concurrent
 * submissions are the expected case rather than the unlucky one.
 *
 * FAILS CLOSED when Redis is down, matching site-audit and the scanner. With no
 * counter to enforce against, an anonymous endpoint that fans out to the sidecar
 * is the worst possible thing to leave uncapped.
 *
 * Callers MUST releaseFunnelAudit() if the audit never happened — see the
 * ordering note in the route.
 */
export async function reserveFunnelAudit(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<FunnelQuotaDecision> {
  const limit = funnelAuditLimit(plan);
  const key = funnelQuotaKey(tenantId, now);

  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // EXPIRE is idempotent and cheap; setting it every time avoids a TTL-less
    // key if the month's very first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    return { allowed: false, used: 0, limit, unavailable: true };
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

/** Give a reserved audit back (the sidecar never ran). */
export async function releaseFunnelAudit(tenantId: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(funnelQuotaKey(tenantId, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}

/** Current usage without reserving. Powers the "n of m used" line on the page. */
export async function funnelAuditsUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(funnelQuotaKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

// ─── Per-widget burst limit ─────────────────────────────────────────────────

/** Submissions per key+IP per day. Generous for a human, useless for a script. */
export const FUNNEL_IP_LIMIT_PER_DAY = 5;

/** Seconds until the next UTC midnight — matches free-tools/limits.ts. */
function secondsUntilUtcMidnight(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function funnelIpKey(key: string, ip: string, now = new Date()): string {
  return `echorank:funnel:ip:${key}:${now.toISOString().slice(0, 10)}:${ip}`;
}

/**
 * Consume one of this IP's daily submissions against one funnel.
 *
 * Keyed on key+ip TOGETHER, per the spec: one visitor hitting two different
 * agencies' widgets is two different people as far as either agency is
 * concerned, and a shared corporate NAT should not let the first widget exhaust
 * the second one's allowance.
 *
 * FAILS CLOSED, for the same reason as the monthly counter and stated at length
 * in src/lib/free-tools/limits.ts: this is an unauthenticated path to a metered
 * upstream, and "fail open" here means "fail expensive".
 */
export async function consumeFunnelIpLimit(
  key: string,
  ip: string,
  now = new Date(),
): Promise<{ ok: boolean; remaining: number }> {
  const redisKey = funnelIpKey(key, ip, now);
  try {
    const redis = getRedisConnection();
    const used = await redis.incr(redisKey);
    // Only on the first hit: setting it every call slides the window forward and
    // a busy visitor would never reset.
    if (used === 1) await redis.expire(redisKey, secondsUntilUtcMidnight(now));
    if (used > FUNNEL_IP_LIMIT_PER_DAY) return { ok: false, remaining: 0 };
    return { ok: true, remaining: Math.max(0, FUNNEL_IP_LIMIT_PER_DAY - used) };
  } catch {
    return { ok: false, remaining: 0 };
  }
}
