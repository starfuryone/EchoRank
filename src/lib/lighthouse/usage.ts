// src/lib/lighthouse/usage.ts
//
// The usage block the Lighthouse routes return and the page header renders.
//
// `used` is read from the SAME Redis sorted set the limiter writes to, without
// adding an entry — a separate counter would drift from the thing that
// actually gates requests.

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { hasApiKey } from "@/lib/pagespeed/client";
import { AUDITS_PER_HOUR, AUDIT_WINDOW_MS } from "./options";
import type { LighthouseUsage } from "./types";

/**
 * Audits inside the current rolling hour.
 *
 * rate-limit.ts stores one sorted-set member per request keyed
 * `ratelimit:lighthouse:<tenant>`, scored by timestamp. Counting members
 * inside the window is a read-only view of the real limiter state.
 */
export async function auditsUsedThisHour(tenantId: string, now = Date.now()): Promise<number> {
  try {
    const redis = getRedisConnection();
    const key = `ratelimit:lighthouse:${tenantId}`;
    const count = await redis.zcount(key, now - AUDIT_WINDOW_MS, "+inf");
    return typeof count === "number" ? count : 0;
  } catch {
    // The limiter itself falls back to in-memory when Redis is down; reporting
    // 0 here is honest ("we cannot see a count") and never blocks a request.
    return 0;
  }
}

export async function buildUsage(tenantId: string): Promise<LighthouseUsage> {
  return {
    used: await auditsUsedThisHour(tenantId),
    limit: AUDITS_PER_HOUR,
    apiKeyConfigured: hasApiKey(),
  };
}
