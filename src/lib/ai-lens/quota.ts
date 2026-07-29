// src/lib/ai-lens/quota.ts
//
// Per-tenant monthly AI Lens counter. Redis INCR on a month-scoped key, so the
// count survives `pm2 restart` and is shared between the web process and
// anything else that calls the sidecar — an in-process Map would reset on every
// deploy and this box restarts often.
//
// What is being rationed is chromium renders on a single box, not upstream
// spend: there is no vendor bill behind AI Lens. Two renders can run at once
// (the sidecar's own semaphore), so the monthly cap is what stops one tenant
// from making the sidecar the slowest thing in the product for everyone else.
//
// Deliberately parallel to src/lib/site-explorer/quota.ts rather than shared
// with it: each tool has an independent allowance, and a shared helper would
// need a tool discriminator threaded through every call for no gain.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { AI_LENS_ANALYSES_PER_MONTH } from "./options";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function aiLensMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function aiLensQuotaKey(tenantId: string, now = new Date()): string {
  return `echorank:ai-lens:analyses:${tenantId}:${aiLensMonthKey(now)}`;
}

export class AiLensQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("The AI Lens allowance is temporarily unavailable. Try again in a minute.");
    this.name = "AiLensQuotaUnavailableError";
  }
}

export class AiLensQuotaExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly AI Lens limit reached (${limit} on the ${plan} plan). Upgrade for more analyses.`,
    );
    this.name = "AiLensQuotaExceededError";
  }
}

export interface QuotaDecision {
  allowed: boolean;
  /** Count AFTER this reservation (or the current count when rejected). */
  used: number;
  limit: number;
}

export function aiLensLimit(plan: PlanType): number {
  return AI_LENS_ANALYSES_PER_MONTH[plan] ?? AI_LENS_ANALYSES_PER_MONTH.STARTER;
}

export async function aiLensAnalysesUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const redis = getRedisConnection();
    const raw = await redis.get(aiLensQuotaKey(tenantId, now));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    // A usage READ failing is cosmetic — the reservation is what enforces.
    return 0;
  }
}

/**
 * Reserves one analysis against this month's allowance.
 *
 * INCR first, then roll back when over the line: the read-then-write
 * alternative races two concurrent submissions past the last slot. Callers MUST
 * `releaseAiLensAnalysis` if no render was actually spent (cache hit, or the
 * sidecar refused before rendering).
 *
 * Fails CLOSED when Redis is unreachable. With no counter to enforce against,
 * letting unbounded chromium renders through is the worse failure: the sidecar
 * also serves /audit and /track, and starving it takes down features that have
 * nothing to do with this tool.
 */
export async function reserveAiLensAnalysis(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<QuotaDecision> {
  const limit = aiLensLimit(plan);
  const key = aiLensQuotaKey(tenantId, now);

  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    // Only the first write of the month needs the TTL, but EXPIRE is idempotent
    // and cheap, so setting it unconditionally avoids a TTL-less key if the very
    // first EXPIRE ever failed.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    throw new AiLensQuotaUnavailableError();
  }

  if (used > limit) {
    // Undo our own increment so a rejected attempt does not permanently consume
    // a slot; the counter is shared, so DECR (not SET) is the only safe undo.
    try {
      const redis = getRedisConnection();
      await redis.decr(key);
    } catch {
      /* the TTL will clear it within 40 days; nothing better to do here */
    }
    throw new AiLensQuotaExceededError(limit, plan);
  }

  return { allowed: true, used, limit };
}

/** Give back a reserved slot. Never throws — the caller is already on a path. */
export async function releaseAiLensAnalysis(tenantId: string, now = new Date()): Promise<void> {
  try {
    const redis = getRedisConnection();
    const key = aiLensQuotaKey(tenantId, now);
    const value = await redis.decr(key);
    // Guard against a DECR landing below zero if the key expired mid-request.
    if (value < 0) await redis.set(key, "0", "EX", KEY_TTL_SECONDS);
  } catch {
    /* best effort */
  }
}
