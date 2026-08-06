// src/lib/free-tools/limits.ts
//
// Per-IP daily limits for the anonymous free tools.
//
// REDIS INCR + TTL, NEVER AN IN-PROCESS MAP. src/app/api/av/audit/route.ts
// still uses a module-scoped Map, and CLAUDE.md lists it as the standing
// counter-example: this box restarts several times a day, and every restart
// hands every visitor a fresh allowance. A counter that resets on deploy is not
// a cap. src/lib/rate-limit.ts is also unusable here — it falls back to an
// in-memory map when Redis is unavailable, which is the same bug arriving by a
// different door. When Redis is down these endpoints REFUSE rather than serve
// uncapped, because the alternative is an unmetered path to paid APIs.
//
// NO 'unknown' BUCKET. A request without cf-connecting-ip is refused outright.
// Bucketing those together would let anyone strip the header and share one
// generous counter; worse, behind a misconfigured proxy every visitor would
// land in it and the limit would apply to the whole internet at once.

import { getRedisConnection } from "@/infrastructure/redis/connection";

/** Everything under one prefix, so a flush of the free tier is one SCAN. */
const KEY_PREFIX = "free:rl";

export type LimitDenial = "no_ip" | "rate_limited" | "unavailable";

export interface LimitResult {
  ok: boolean;
  reason?: LimitDenial;
  /** Remaining calls in the window, when known. */
  remaining?: number;
  /** Seconds until the counter resets, when known. */
  resetSeconds?: number;
}

/**
 * The visitor's IP, or null.
 *
 * ONLY cf-connecting-ip. x-forwarded-for is client-controllable — anything that
 * reaches this app has passed through Cloudflare, which sets cf-connecting-ip
 * itself and strips spoofed copies. Accepting x-forwarded-for as a fallback
 * would make every limit here opt-out.
 */
export function visitorIp(req: Request): string | null {
  const ip = req.headers.get("cf-connecting-ip")?.trim();
  return ip ? ip : null;
}

/** Seconds until the next UTC midnight — the reset for a per-day limit. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
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

/** UTC day stamp, so a key rolls over at midnight rather than 24h after use. */
export function utcDayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Consume one unit of a tool's daily allowance for this IP.
 *
 * INCR-then-EXPIRE, and the TTL is only set when the counter is new (the INCR
 * returned 1). Setting it every call would slide the window forward on each
 * request and a busy visitor would never reset.
 *
 * Call this only for work that actually costs something. A cache hit must not
 * consume an allowance — see the note in cache.ts.
 */
export async function consumeDailyLimit(
  tool: string,
  ip: string,
  limit: number,
  now: Date = new Date(),
): Promise<LimitResult> {
  const key = `${KEY_PREFIX}:${tool}:${utcDayStamp(now)}:${ip}`;

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
    // Redis unreachable. Refuse rather than serve uncapped — these endpoints
    // reach paid APIs, and "fail open" here means "fail expensive".
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Give an allowance back.
 *
 * Used when the work turned out to cost nothing after all — an upstream that
 * refused us, say — so the visitor is not charged for our failure. Never drops
 * below zero.
 */
export async function refundDailyLimit(
  tool: string,
  ip: string,
  now: Date = new Date(),
): Promise<void> {
  const key = `${KEY_PREFIX}:${tool}:${utcDayStamp(now)}:${ip}`;
  try {
    const redis = getRedisConnection();
    const value = await redis.decr(key);
    if (value < 0) await redis.set(key, "0", "EX", secondsUntilUtcMidnight(now));
  } catch {
    /* a refund that fails costs the visitor one call, not correctness */
  }
}

/** Read the counter without consuming. For "you have N left" copy. */
export async function peekDailyLimit(
  tool: string,
  ip: string,
  limit: number,
  now: Date = new Date(),
): Promise<number> {
  try {
    const redis = getRedisConnection();
    const raw = await redis.get(`${KEY_PREFIX}:${tool}:${utcDayStamp(now)}:${ip}`);
    return Math.max(0, limit - Number(raw ?? 0));
  } catch {
    return 0;
  }
}
