// src/lib/partner/quota.ts
//
// Partner API counters. The shape is src/lib/site-audit/quota.ts: Redis INCR on
// a time-scoped key, roll back when over the line, fail closed when Redis is
// unreachable. Three families:
//   - per key, per kind, per month   → the allowance in limits.ts (429 when spent)
//   - per subject, per kind, per month → metering only, never refused
//   - per subject, per hour          → the 60 req/h fairness limit (429)
import "server-only";

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { PARTNER_MONTHLY_LIMITS, PARTNER_SUBJECT_HOURLY_LIMIT, type PartnerKind } from "./limits";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const MONTH_TTL_SECONDS = 40 * 24 * 60 * 60;
const HOUR_TTL_SECONDS = 2 * 60 * 60;

export function partnerMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function partnerHour(now: Date): string {
  return `${now.toISOString().slice(0, 13)}`; // 2026-10-06T07
}

export function keyQuotaKey(keyId: string, kind: PartnerKind, now = new Date()): string {
  return `echorank:partner:key:${keyId}:${kind}:${partnerMonth(now)}`;
}

export function subjectUsageKey(keyId: string, subject: string, kind: PartnerKind, now = new Date()): string {
  return `echorank:partner:subject:${keyId}:${subject}:${kind}:${partnerMonth(now)}`;
}

export function subjectHourKey(keyId: string, subject: string, now = new Date()): string {
  return `echorank:partner:subject-hour:${keyId}:${subject}:${partnerHour(now)}`;
}

/** Seconds until the first instant of next UTC month. */
export function secondsToNextMonth(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/** Seconds until the next UTC clock hour. */
export function secondsToNextHour(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export class PartnerQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Partner quota is temporarily unavailable");
    this.name = "PartnerQuotaUnavailableError";
  }
}

export interface PartnerDecision {
  allowed: boolean;
  used: number;
  limit: number;
  /** Seconds until the window resets; set when refused. */
  retryAfter?: number;
}

async function reserve(key: string, limit: number, ttl: number, retryAfter: number): Promise<PartnerDecision> {
  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    await redis.expire(key, ttl);
  } catch {
    throw new PartnerQuotaUnavailableError();
  }
  if (used > limit) {
    try {
      await getRedisConnection().decr(key);
    } catch {
      // Best-effort rollback: the counter self-heals at the window boundary.
    }
    return { allowed: false, used: limit, limit, retryAfter };
  }
  return { allowed: true, used, limit };
}

/** One request against the subject's hourly fairness limit. Every endpoint counts. */
export function reserveSubjectHour(keyId: string, subject: string, now = new Date()): Promise<PartnerDecision> {
  return reserve(subjectHourKey(keyId, subject, now), PARTNER_SUBJECT_HOURLY_LIMIT, HOUR_TTL_SECONDS, secondsToNextHour(now));
}

/**
 * One call of `kind` against the key's monthly allowance. Callers MUST
 * `releasePartnerCall` when nothing upstream ran (sidecar refused or failed).
 */
export async function reservePartnerCall(
  keyId: string,
  subject: string,
  kind: PartnerKind,
  now = new Date(),
): Promise<PartnerDecision> {
  const decision = await reserve(keyQuotaKey(keyId, kind, now), PARTNER_MONTHLY_LIMITS[kind], MONTH_TTL_SECONDS, secondsToNextMonth(now));
  if (decision.allowed) {
    try {
      const redis = getRedisConnection();
      const k = subjectUsageKey(keyId, subject, kind, now);
      await redis.incr(k);
      await redis.expire(k, MONTH_TTL_SECONDS);
    } catch {
      // Metering only: the ledger row (PartnerCall) is the durable record.
    }
  }
  return decision;
}

/** Give a reserved call back (nothing upstream ran, nothing was spent). */
export async function releasePartnerCall(keyId: string, subject: string, kind: PartnerKind, now = new Date()): Promise<void> {
  try {
    const redis = getRedisConnection();
    await redis.decr(keyQuotaKey(keyId, kind, now));
    await redis.decr(subjectUsageKey(keyId, subject, kind, now));
  } catch {
    // Best-effort — never turn a rollback failure into a request failure.
  }
}
