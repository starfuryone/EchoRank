// src/lib/memory/quota.ts
//
// AI memory counters, in Redis (CLAUDE.md "Data and limits"):
//   - adds per tenant per calendar month (UTC), against PLAN_CONFIGS[plan].memory.addsPerMonth;
//   - extraction tokens across all tenants per UTC day, against MEM0_DAILY_TOKEN_BUDGET.
// Same shape as src/lib/site-audit/quota.ts: INCR first, roll back when over,
// a TTL past the longest period. The adds counter fails CLOSED (no counter, no
// spend); the read-only helpers fail to 0.

import "server-only";

import type { PlanType } from "@/generated/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { memoryAllowance, memoryDailyTokenBudget } from "./limits";

const MONTH_TTL_SECONDS = 40 * 24 * 60 * 60;
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;

const month = (now: Date) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const day = (now: Date) => now.toISOString().slice(0, 10);

export const memoryAddsKey = (tenantId: string, now = new Date()) => `echorank:memory:adds:${tenantId}:${month(now)}`;
export const memoryTokensKey = (now = new Date()) => `echorank:memory:tokens:${day(now)}`;

export class MemoryQuotaUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("The AI memory allowance is temporarily unavailable.");
    this.name = "MemoryQuotaUnavailableError";
  }
}

export interface MemoryQuotaDecision {
  allowed: boolean;
  used: number;
  /** null = no plan ceiling (ENTERPRISE). */
  limit: number | null;
}

/** Reserve one add. Callers MUST releaseMemoryAdd() when nothing was extracted or the call failed. */
export async function reserveMemoryAdd(tenantId: string, plan: PlanType, now = new Date()): Promise<MemoryQuotaDecision> {
  const { addsPerMonth: limit } = memoryAllowance(plan);
  if (limit === 0) return { allowed: false, used: 0, limit: 0 };
  const key = memoryAddsKey(tenantId, now);
  let used: number;
  try {
    const redis = getRedisConnection();
    used = await redis.incr(key);
    await redis.expire(key, MONTH_TTL_SECONDS);
  } catch {
    throw new MemoryQuotaUnavailableError();
  }
  if (limit !== null && used > limit) {
    await getRedisConnection().decr(key).catch(() => undefined);
    return { allowed: false, used: limit, limit };
  }
  return { allowed: true, used, limit };
}

export async function releaseMemoryAdd(tenantId: string, now = new Date()): Promise<void> {
  try {
    await getRedisConnection().decr(memoryAddsKey(tenantId, now));
  } catch {
    // Best effort: the key expires with the month.
  }
}

export async function memoryAddsUsed(tenantId: string, now = new Date()): Promise<number> {
  try {
    const raw = await getRedisConnection().get(memoryAddsKey(tenantId, now));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

/** True when today's extraction budget (all tenants) is spent, or set to 0. Fails CLOSED. */
export async function memoryBudgetExhausted(now = new Date(), env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const budget = memoryDailyTokenBudget(env);
  if (budget === 0) return true;
  try {
    const raw = await getRedisConnection().get(memoryTokensKey(now));
    return (raw ? Number(raw) : 0) >= budget;
  } catch {
    return true;
  }
}

export async function recordMemoryTokens(tokens: number, now = new Date()): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  try {
    const redis = getRedisConnection();
    const key = memoryTokensKey(now);
    await redis.incrby(key, Math.round(tokens));
    await redis.expire(key, DAY_TTL_SECONDS);
  } catch {
    // The add already happened; a lost count only loosens tomorrow's kill switch.
  }
}
