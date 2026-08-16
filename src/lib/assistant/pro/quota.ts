// src/lib/assistant/pro/quota.ts
//
// Per-tenant monthly output-token budget for the Pro assistant.
//
// THE MECHANISM IS MARKETING STUDIO'S. Same shape as src/lib/marketing/quota.ts
// — month-keyed Redis INCRBY with a TTL past the longest month, checked BEFORE
// the model call and incremented AFTER, failing closed when Redis is
// unreachable. That module is the house pattern for "a paid API behind a
// per-tenant ceiling" and reimplementing it differently here would mean two
// meters that disagree about what a month is.
//
// SEPARATE BUCKET, DELIBERATELY. Its own key namespace, so assistant traffic
// never draws down the 2M generation allowance Marketing Studio and the Action
// Agent share. `src/lib/action-agent/generate.ts` took the other choice — it
// calls assertMarketingBudget directly, so a draft and a generation come out of
// one pot. The assistant must not: a customer asking questions all afternoon
// would silently consume the budget they bought to write copy with, and the two
// numbers have to be readable apart when the bill arrives.
//
// THE LIMIT COMES FROM AN ENV VAR, NOT FROM PLAN_CONFIGS. Marketing Studio's
// ceiling is a per-plan table (MARKETING_MONTHLY_OUTPUT_TOKENS) because it is a
// sold quantity a customer can compare across tiers. This one is an operator
// backstop against runaway spend on a feature that ships dark — a single number
// an operator can arm with a restart, and 0 (the default) means unmetered.
//
// THE OVERSHOOT. Checked before, incremented after, because output length is
// not knowable in advance. A tenant one token under the limit can complete one
// final turn and end the month up to maxOutputTokens (4,000) over. Reserving
// the ceiling up front would charge a full reply for a one-line answer;
// refunding the difference reintroduces the race INCR-after avoids.

import { getRedisConnection } from "@/infrastructure/redis/connection";

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function assistantMonthKey(now: Date = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

/**
 * The tenant's counter key.
 *
 * TENANT ID IS PART OF THE KEY AND COMES FROM THE SESSION. Nothing the model
 * or the request body says can reach this function — see tools.ts for the same
 * rule applied to every data read.
 */
export function assistantBudgetKey(tenantId: string, now: Date = new Date()): string {
  return `echorank:assistant:pro:output-tokens:${tenantId}:${assistantMonthKey(now)}`;
}

/**
 * When the counter starts again: midnight UTC on the 1st of the next month.
 * Derived, not stored — a stored copy is a second source of truth that can
 * disagree with the key the INCRBY actually lands on.
 */
export function assistantBudgetResetsAt(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * The ceiling, in output tokens per tenant per calendar month.
 *
 * 0 means unmetered, and it is the default: the plan gate and the per-turn
 * budget are the primary controls, and this is the backstop an operator arms
 * without a rebuild.
 */
export function assistantTenantTokenLimit(): number {
  const raw = Number(process.env.AI_ASSISTANT_TENANT_MONTHLY_TOKENS);
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
}

export class AssistantBudgetExceededError extends Error {
  readonly statusCode = 429;
  constructor(readonly limit: number) {
    super(
      `This month's assistant allowance is used up (${limit.toLocaleString("en-US")} output tokens). It resets on the 1st, UTC.`,
    );
    this.name = "AssistantBudgetExceededError";
  }
}

export class AssistantBudgetUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("The assistant's usage meter is temporarily unavailable.");
    this.name = "AssistantBudgetUnavailableError";
  }
}

/** Output tokens this tenant has spent this month. Powers the usage line. */
export async function assistantTokensUsed(
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  try {
    const raw = await getRedisConnection().get(assistantBudgetKey(tenantId, now));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    // A read failure must not blank the usage line into "0 of 500,000" — but it
    // must not fail the page either. assertAssistantBudget does the strict check.
    return 0;
  }
}

/**
 * Throws when this tenant has no allowance left. Called before the model call.
 *
 * FAILS CLOSED when Redis is unreachable AND a limit is set: with no counter to
 * enforce against, an unbounded spend on someone else's API bill is the worse
 * failure. When no limit is set there is nothing to enforce, so a Redis outage
 * is irrelevant and the turn proceeds.
 */
export async function assertAssistantBudget(
  tenantId: string,
  now: Date = new Date(),
): Promise<{ used: number; limit: number | null }> {
  const limit = assistantTenantTokenLimit();
  if (limit === 0) return { used: 0, limit: null };

  let used: number;
  try {
    const raw = await getRedisConnection().get(assistantBudgetKey(tenantId, now));
    used = raw ? Number(raw) || 0 : 0;
  } catch {
    throw new AssistantBudgetUnavailableError();
  }

  if (used >= limit) throw new AssistantBudgetExceededError(limit);
  return { used, limit };
}

/**
 * Record what a completed turn produced.
 *
 * Best-effort by design: the tokens are already spent and the customer already
 * has their answer, so a Redis blip must not turn a successful turn into an
 * error. The durable record is the `ai_api_calls` row written alongside it —
 * if the two disagree, Postgres is the truth and this counter self-heals at the
 * month boundary.
 */
export async function recordAssistantTokens(
  tenantId: string,
  outputTokens: number,
  now: Date = new Date(),
): Promise<void> {
  if (!Number.isFinite(outputTokens) || outputTokens <= 0) return;
  try {
    const redis = getRedisConnection();
    const key = assistantBudgetKey(tenantId, now);
    await redis.incrby(key, Math.round(outputTokens));
    // Idempotent and cheap; set unconditionally so a key can never end up
    // TTL-less because one EXPIRE failed on the first write of the month.
    await redis.expire(key, KEY_TTL_SECONDS);
  } catch {
    // Intentionally swallowed. See above.
  }
}

export interface AssistantUsage {
  used: number;
  /** null = unmetered. */
  limit: number | null;
  /** ISO 8601, UTC. The copy that renders it names the timezone. */
  resetsAt: string;
}

export async function buildAssistantUsage(
  tenantId: string,
  now: Date = new Date(),
): Promise<AssistantUsage> {
  const limit = assistantTenantTokenLimit();
  return {
    used: await assistantTokensUsed(tenantId, now),
    limit: limit === 0 ? null : limit,
    resetsAt: assistantBudgetResetsAt(now).toISOString(),
  };
}
