// src/lib/av-free-limit.ts
//
// The free AI Readiness Audit's per-IP allowance (/api/av/audit):
// 1 SUCCESSFUL audit per IP per 24 h, the window starting at the first success.
// Was an in-process Map, which every `pm2 restart` emptied (CLAUDE.md "Data and
// limits"). Same behaviour, now in Redis:
//   - check before the sidecar call (GET), record only after a success (INCR,
//     TTL set on the first hit so the window does not slide);
//   - Redis down → allow and log. The audit calls no paid API, so failing
//     closed would take the lead magnet offline to protect nothing billable.
// The numbers live in src/lib/free-audit/limits.ts, which the page reads too.
import "server-only";

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { FREE_AUDITS_PER_DAY, FREE_AUDIT_WINDOW_HOURS } from "@/lib/free-audit/limits";

export const AV_FREE_AUDITS_PER_DAY = FREE_AUDITS_PER_DAY;
const WINDOW_SECONDS = FREE_AUDIT_WINDOW_HOURS * 60 * 60;

export function avFreeKey(ip: string): string {
  return `echorank:av-free-audit:${ip}`;
}

export async function avFreeLimited(ip: string): Promise<boolean> {
  try {
    const raw = await getRedisConnection().get(avFreeKey(ip));
    return Number(raw ?? 0) >= AV_FREE_AUDITS_PER_DAY;
  } catch (err) {
    console.error("[av/audit] limit check failed, allowing", err);
    return false;
  }
}

/**
 * When this IP can run its next free audit: now + the key's remaining TTL.
 * Null when Redis cannot say (the page then states the rule without a time).
 */
export async function avFreeRetryAt(ip: string, now = new Date()): Promise<Date | null> {
  try {
    const ttl = await getRedisConnection().ttl(avFreeKey(ip));
    return ttl > 0 ? new Date(now.getTime() + ttl * 1000) : null;
  } catch {
    return null;
  }
}

export async function avFreeRecord(ip: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const n = await redis.incr(avFreeKey(ip));
    if (n === 1) await redis.expire(avFreeKey(ip), WINDOW_SECONDS);
  } catch (err) {
    console.error("[av/audit] limit record failed", err);
  }
}
