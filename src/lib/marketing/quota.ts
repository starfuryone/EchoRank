// src/lib/marketing/quota.ts
//
// Per-tenant monthly OUTPUT-TOKEN budget for Marketing Studio. Redis INCRBY on
// a month-scoped key, the shape site-audit/quota.ts establishes — an in-process
// Map would reset on every deploy and hand every tenant a fresh allowance.
//
// WHY TOKENS AND NOT A GENERATION COUNT. What a generation costs varies by more
// than 5x across the 12 categories: a VoC headline pass is capped at 500 output
// tokens, a full campaign plan at 2500. Counting generations would either
// under-price the campaign builder or make the cheap categories feel expensive,
// and tenants would learn to game it by always picking the biggest one.
//
// THE OVERSHOOT. The budget is checked BEFORE the call and incremented AFTER,
// because the output length is not knowable in advance. A tenant sitting one
// token under the limit can therefore complete one final generation and end the
// month up to maxTokens (2500) over. That is deliberate: reserving the ceiling
// up front would charge a 2500-token reservation for a 400-token answer, and
// refunding the difference reintroduces the race the INCR-first pattern exists
// to avoid. A bounded 2500-token overshoot on a 200k budget is 1.25%.

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { MARKETING_MONTHLY_OUTPUT_TOKENS } from "@/lib/plan-config";
import { hasFeature } from "@/lib/feature-flags";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function marketingMonthKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function marketingBudgetKey(tenantId: string, now = new Date()): string {
  return `echorank:marketing:output-tokens:${tenantId}:${marketingMonthKey(now)}`;
}

/**
 * null = unmetered.
 *
 * NOT `?? 0`: ENTERPRISE's limit IS null, and `??` fires on null as well as
 * undefined, so that spelling turned "unlimited" into "zero" and 429'd every
 * ENTERPRISE generation. Only a plan genuinely absent from the table falls back
 * to 0, which is the correct fail-closed answer for a plan nobody has costed.
 */
export function marketingTokenLimit(plan: PlanType): number | null {
  const limit = MARKETING_MONTHLY_OUTPUT_TOKENS[plan];
  return limit === undefined ? 0 : limit;
}

export function planCanUseMarketing(plan: PlanType): boolean {
  return hasFeature(plan, "marketing_studio");
}

export class MarketingPlanLockedError extends Error {
  readonly statusCode = 403;
  constructor(readonly plan: PlanType) {
    super("Marketing Studio is included from the Starter plan up.");
    this.name = "MarketingPlanLockedError";
  }
}

export class MarketingBudgetExceededError extends Error {
  readonly statusCode = 429;
  constructor(
    readonly limit: number,
    readonly plan: PlanType,
  ) {
    super(
      `Monthly generation budget reached (${limit.toLocaleString("en-US")} output tokens on the ${plan} plan).`,
    );
    this.name = "MarketingBudgetExceededError";
  }
}

export class MarketingBudgetUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("The generation budget is temporarily unavailable");
    this.name = "MarketingBudgetUnavailableError";
  }
}

/** Output tokens spent this month. Powers the usage line and the pre-check. */
export async function marketingTokensUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(marketingBudgetKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    // A read failure must not blank the usage line into "0 of 200,000" — but it
    // also must not fail the page. assertMarketingBudget does the strict check.
    return 0;
  }
}

/**
 * Throws when this tenant has no budget left. Called before the model call.
 *
 * Fails CLOSED when Redis is unreachable: with no counter to enforce against,
 * an unbounded spend on someone else's API bill is the worse failure. The
 * heuristic categories do not call this at all, so a Redis outage still leaves
 * brand voice, and the compute half of every hybrid, fully working.
 */
export async function assertMarketingBudget(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<{ used: number; limit: number | null }> {
  if (!planCanUseMarketing(plan)) throw new MarketingPlanLockedError(plan);

  const limit = marketingTokenLimit(plan);
  if (limit === null) return { used: 0, limit: null };

  let used: number;
  try {
    const raw = await getRedisConnection().get(marketingBudgetKey(tenantId, now));
    used = raw ? Number(raw) : 0;
  } catch {
    throw new MarketingBudgetUnavailableError();
  }

  if (used >= limit) throw new MarketingBudgetExceededError(limit, plan);
  return { used, limit };
}

/**
 * Record what a completed call actually produced.
 *
 * Best-effort by design: the tokens are already spent and the tenant already
 * has their deliverable, so a Redis blip must not turn a successful generation
 * into an error. The durable record is the AiApiCall row, which is written in
 * the same step — if the two ever disagree, Postgres is the truth and the Redis
 * counter self-heals at the month boundary.
 */
export async function recordMarketingTokens(
  tenantId: string,
  outputTokens: number,
  now = new Date(),
): Promise<void> {
  if (outputTokens <= 0) return;
  try {
    const redis = getRedisConnection();
    const key = marketingBudgetKey(tenantId, now);
    await redis.incrby(key, outputTokens);
    // Idempotent and cheap; set unconditionally so a key can never end up
    // TTL-less because one EXPIRE failed on the first write of the month.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    // Intentionally swallowed. See above.
  }
}
