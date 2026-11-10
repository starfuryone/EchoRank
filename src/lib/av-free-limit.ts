// src/lib/av-free-limit.ts
//
// The free AI Readiness Audit's per-IP allowance (/api/av/audit):
// FREE_AUDIT_DAILY_LIMIT audits per cf-connecting-ip per 24 h, the window
// starting at the first audit and not sliding. In Redis, never in-process: a
// Map empties on every `pm2 restart` (CLAUDE.md "Data and limits").
//
// RESERVE, THEN REFUND. A slot is taken (INCR) before the sidecar is called and
// handed back (DECR) when the audit returns no score, so only an audit with a
// result uses the allowance, and N parallel requests cannot all pass a GET
// that each of them read before any of them recorded (the old check-then-INCR
// let a burst through). The TTL is set on the first slot and repaired if a
// crash left the key without one; a refund never moves it.
//
// Redis down → allow and log (remaining unknown). The audit calls no paid API,
// so failing closed would take the lead magnet offline to protect nothing
// billable.
import "server-only";

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { FREE_AUDIT_DAILY_LIMIT, FREE_AUDIT_WINDOW_HOURS } from "@/lib/free-audit/limits";

export const AV_FREE_AUDITS_PER_DAY = FREE_AUDIT_DAILY_LIMIT;
const WINDOW_SECONDS = FREE_AUDIT_WINDOW_HOURS * 60 * 60;

export function avFreeKey(ip: string): string {
  return `echorank:av-free-audit:${ip}`;
}

export type AllowanceState = {
  limit: number;
  /** Audits left in this window; null when Redis could not say. */
  remaining: number | null;
  /** When the window resets; null when nothing has been used (or Redis could not say). */
  retryAt: Date | null;
};

function retryAtFrom(ttl: number, now: Date): Date | null {
  return ttl > 0 ? new Date(now.getTime() + ttl * 1000) : null;
}

/** Read-only: what this IP has left (GET /api/av/audit, the page's "N of 3 left"). */
export async function avFreeState(ip: string, now = new Date()): Promise<AllowanceState> {
  try {
    const redis = getRedisConnection();
    const [raw, ttl] = await Promise.all([redis.get(avFreeKey(ip)), redis.ttl(avFreeKey(ip))]);
    const used = Math.max(0, Number(raw ?? 0));
    return { limit: FREE_AUDIT_DAILY_LIMIT, remaining: Math.max(0, FREE_AUDIT_DAILY_LIMIT - used), retryAt: used > 0 ? retryAtFrom(ttl, now) : null };
  } catch (err) {
    console.error("[av/audit] allowance read failed", err);
    return { limit: FREE_AUDIT_DAILY_LIMIT, remaining: null, retryAt: null };
  }
}

export type Reservation =
  | { ok: true; remaining: number | null; release: () => Promise<void> }
  | { ok: false; retryAt: Date | null };

/** Take one slot. `release()` hands it back when the audit produced no score. */
export async function avFreeReserve(ip: string, now = new Date()): Promise<Reservation> {
  const key = avFreeKey(ip);
  let redis: ReturnType<typeof getRedisConnection>;
  let n: number;
  try {
    redis = getRedisConnection();
    n = await redis.incr(key);
    if (n === 1) await redis.expire(key, WINDOW_SECONDS);
    else if ((await redis.ttl(key)) === -1) await redis.expire(key, WINDOW_SECONDS);
  } catch (err) {
    console.error("[av/audit] allowance reserve failed, allowing", err);
    return { ok: true, remaining: null, release: async () => {} };
  }
  if (n > FREE_AUDIT_DAILY_LIMIT) {
    let retryAt: Date | null = null;
    try {
      await redis.decr(key);
      retryAt = retryAtFrom(await redis.ttl(key), now);
    } catch {
      /* the over-count expires with the key */
    }
    return { ok: false, retryAt };
  }
  let released = false;
  return {
    ok: true,
    remaining: FREE_AUDIT_DAILY_LIMIT - n,
    release: async () => {
      if (released) return;
      released = true;
      // DECR only: the key and its TTL stay, so the window still ends 24 h
      // after the first audit. (A DEL at zero would race a parallel INCR.)
      try {
        await redis.decr(key);
      } catch (err) {
        console.error("[av/audit] allowance release failed", err);
      }
    },
  };
}
