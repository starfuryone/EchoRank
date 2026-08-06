// src/lib/free-tools/cache.ts
//
// Redis result cache for the free tools.
//
// A CACHE HIT COSTS THE VISITOR NOTHING. Neither an allowance nor a cent — the
// answer was already bought. Every route here therefore reads the cache BEFORE
// touching the limiter, which is the opposite of the usual order and the whole
// reason these helpers are separate from limits.ts. Getting it backwards would
// charge three visitors for one keyword.
//
// Values are JSON. A cache miss, a parse failure and an unreachable Redis are
// all "no cached answer" — the caller does the work and tries to store it.

import { getRedisConnection } from "@/infrastructure/redis/connection";

const KEY_PREFIX = "free:cache";

export const ONE_HOUR = 3600;
export const ONE_DAY = 86_400;
export const SEVEN_DAYS = 7 * ONE_DAY;

/**
 * Build a cache key from parts.
 *
 * Parts are lowercased and stripped of whitespace runs so "New York" and
 * "new  york" are one entry. `:` inside a part is escaped, otherwise a keyword
 * containing a colon could collide with a different tool's namespace.
 */
export function cacheKey(tool: string, ...parts: (string | number)[]): string {
  const encoded = parts
    .map((p) => String(p).trim().toLowerCase().replace(/\s+/g, " ").replace(/:/g, "%3A"))
    .join(":");
  return `${KEY_PREFIX}:${tool}:${encoded}`;
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedisConnection().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedisConnection().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // A cache we could not write is a slower next request, not a failure.
  }
}

/**
 * Cache-aside with the spend/limit decision left to the caller.
 *
 * Deliberately NOT a "getOrCompute" that also handles limiting: the caller must
 * see the hit/miss distinction to decide whether to consume an allowance, and
 * hiding that behind one call is exactly how a cache hit starts costing a
 * visitor their daily quota.
 */
export async function cached<T>(key: string): Promise<{ hit: boolean; value: T | null }> {
  const value = await readCache<T>(key);
  return { hit: value !== null, value };
}
