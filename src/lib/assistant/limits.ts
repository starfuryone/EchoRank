// src/lib/assistant/limits.ts
//
// Cost-aware per-IP daily limits for the anonymous AI Assistant.
//
// REDIS INCR + TTL, NEVER AN IN-PROCESS MAP. src/app/api/av/audit/route.ts is the
// standing counter-example in CLAUDE.md: a module-scoped Map on a box that
// restarts several times a day hands every visitor a fresh allowance on every
// deploy. A counter that resets on deploy is not a cap, and behind this one sits
// a paid model API. src/lib/rate-limit.ts is unusable for the same reason — it
// falls back to an in-memory map when Redis is down, which is the same bug
// arriving by a different door. When Redis is unreachable these buckets REFUSE.
//
// NO 'unknown' BUCKET. `visitorIp` (reused from the free tools) reads only
// cf-connecting-ip; a request without it is refused outright rather than sharing
// one generous counter with everyone who strips the header.
//
// SEPARATE BUCKETS, DELIBERATELY. A cheap cached answer, a heuristic-only answer
// and a live site fetch cost wildly different amounts, so they are metered
// separately: `chat` counts turns that reach the model, `scan` counts turns that
// fetch someone else's website. A cache hit consumes neither — the answer was
// already bought. Callers therefore consume AFTER deciding the work is real,
// which is why this module exposes consume/refund rather than a guard wrapper.

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { secondsUntilUtcMidnight, utcDayStamp, visitorIp } from "@/lib/free-tools/limits";

export { visitorIp };

/** Everything under one prefix, separate from `free:rl` and the token meters. */
const KEY_PREFIX = "echorank:assistant:rl";

/** What a turn is allowed to spend. Ordered cheapest first. */
export type AssistantBucket = "chat" | "scan";

export type LimitDenial = "no_ip" | "rate_limited" | "unavailable";

export interface LimitResult {
  ok: boolean;
  reason?: LimitDenial;
  /** Remaining units in the window, when known. */
  remaining?: number;
  /** Seconds until the counter resets, when known. */
  resetSeconds?: number;
}

export function limitKey(bucket: AssistantBucket, ip: string, now: Date = new Date()): string {
  return `${KEY_PREFIX}:${bucket}:${utcDayStamp(now)}:${ip}`;
}

/**
 * Consume one unit of a bucket's daily allowance for this IP.
 *
 * INCR-then-EXPIRE, and the TTL is set only when the counter is new (the INCR
 * returned 1). Setting it every call slides the window forward on each request
 * and a busy visitor never resets.
 */
export async function consume(
  bucket: AssistantBucket,
  ip: string,
  limit: number,
  now: Date = new Date(),
): Promise<LimitResult> {
  const key = limitKey(bucket, ip, now);

  try {
    const redis = getRedisConnection();
    const used = await redis.incr(key);
    if (used === 1) {
      await redis.expire(key, secondsUntilUtcMidnight(now));
    }

    if (used > limit) {
      const ttl = await redis.ttl(key);
      return {
        ok: false,
        reason: "rate_limited",
        remaining: 0,
        resetSeconds: ttl > 0 ? ttl : secondsUntilUtcMidnight(now),
      };
    }

    return { ok: true, remaining: Math.max(0, limit - used) };
  } catch {
    // Redis unreachable. Refuse rather than serve uncapped — "fail open" on a
    // path to a paid model API means "fail expensive".
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Give an allowance back when the work turned out to cost nothing — an upstream
 * that refused us, a model call that never happened. Never drops below zero.
 */
export async function refund(
  bucket: AssistantBucket,
  ip: string,
  now: Date = new Date(),
): Promise<void> {
  const key = limitKey(bucket, ip, now);
  try {
    const redis = getRedisConnection();
    const value = await redis.decr(key);
    if (value < 0) await redis.set(key, "0", "EX", secondsUntilUtcMidnight(now));
  } catch {
    /* a refund that fails costs the visitor one call, not correctness */
  }
}

// ─── Output-token meter ─────────────────────────────────────────────────────
//
// A SEPARATE BUCKET from Marketing Studio's. Same shape as
// src/lib/marketing/quota.ts — month-keyed INCRBY with a TTL past the longest
// month — but its own key, so anonymous assistant traffic never draws down a
// paying tenant's 2M generation-token allowance, and so the two figures can be
// read apart when the bill arrives.
//
// CHECKED BEFORE, INCREMENTED AFTER. Output length is not knowable in advance,
// so the last turn of the month can overshoot by at most one reply (~1000
// tokens). Reserving the ceiling up front would charge a full reply for a
// one-line answer; refunding the difference reintroduces the race the
// INCR-after pattern avoids.

/** 40 days — comfortably past the longest month, so the key self-cleans. */
const MONTH_KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

export function monthStamp(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function outputTokenKey(now: Date = new Date()): string {
  return `echorank:assistant:output-tokens:public:${monthStamp(now)}`;
}

/**
 * The monthly ceiling on anonymous output tokens. 0 (the default) means no
 * ceiling — the per-IP limits are the primary control and this is the backstop
 * an operator can arm without a deploy.
 */
export function monthlyOutputBudget(): number {
  const raw = Number(process.env.AI_ASSISTANT_MONTHLY_OUTPUT_TOKENS);
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
}

/** True when the shared monthly budget is spent. Never blocks when unset. */
export async function outputBudgetExhausted(now: Date = new Date()): Promise<boolean> {
  const budget = monthlyOutputBudget();
  if (budget === 0) return false;
  try {
    const raw = await getRedisConnection().get(outputTokenKey(now));
    return Number(raw ?? 0) >= budget;
  } catch {
    // Unreadable meter on a metered deployment: refuse rather than spend blind.
    return true;
  }
}

/** Record what a turn actually cost. Best effort — never fails the request. */
export async function recordOutputTokens(tokens: number, now: Date = new Date()): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const key = outputTokenKey(now);
  try {
    const redis = getRedisConnection();
    const total = await redis.incrby(key, Math.round(tokens));
    if (total === Math.round(tokens)) await redis.expire(key, MONTH_KEY_TTL_SECONDS);
  } catch {
    /* a meter we could not write is a reporting gap, not a failed answer */
  }
}

/** Read a counter without consuming. For "you have N left" copy. */
export async function peek(
  bucket: AssistantBucket,
  ip: string,
  limit: number,
  now: Date = new Date(),
): Promise<number> {
  try {
    const raw = await getRedisConnection().get(limitKey(bucket, ip, now));
    return Math.max(0, limit - Number(raw ?? 0));
  } catch {
    return 0;
  }
}
