// src/lib/assistant/cache.ts
//
// The assistant's cache service. Three layers, in the order they are consulted:
//
//   L0 — process/request-local memo. Deduplicates the SAME lookup inside ONE
//        turn (the agent asks for a domain's audit while formatting an answer
//        about it). It is created per request and thrown away with it; it is
//        NEVER the authoritative shared cache, because a Map on this box is
//        wiped by every pm2 restart.
//   L1 — Redis. The shared, cross-instance, cross-visitor cache. This is the
//        layer that stops two anonymous visitors buying the same answer twice.
//   L2 — the sidecar / database behind the caller.
//
// PUBLIC DATA ONLY. Everything stored here is keyed by a registrable domain and
// derived from that domain's own public pages. No tenant id, no session, no
// visitor input beyond the domain itself ever enters a key or a value — the
// entries are deliberately shared between strangers, and that is only safe
// because there is nothing private in them.
//
// SINGLE FLIGHT. Ten visitors pasting the same viral domain in the same ten
// seconds must produce one site fetch, not ten. The lock below is advisory and
// bounded: a waiter that never sees a result computes it itself rather than
// hanging, because a wedged lock must degrade to "slower", never to "down".

import { getRedisConnection } from "@/infrastructure/redis/connection";

const KEY_PREFIX = "echorank:assistant:cache";
const LOCK_PREFIX = "echorank:assistant:lock";

export const ONE_HOUR = 3600;
export const ONE_DAY = 86_400;

/** How long one holder may keep the single-flight lock. */
const LOCK_TTL_SECONDS = 45;
/** How long a waiter watches for the holder's result before doing the work. */
const LOCK_WAIT_MS = 12_000;
const LOCK_POLL_MS = 400;

/**
 * Build a cache key from parts.
 *
 * Parts are lowercased and whitespace-collapsed so "New York" and "new  york"
 * are one entry; `:` inside a part is escaped so a value containing a colon
 * cannot collide with another namespace.
 */
export function cacheKey(namespace: string, ...parts: (string | number)[]): string {
  const encoded = parts
    .map((p) => String(p).trim().toLowerCase().replace(/\s+/g, " ").replace(/:/g, "%3A"))
    .join(":");
  return `${KEY_PREFIX}:${namespace}:${encoded}`;
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedisConnection().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A miss, a parse failure and an unreachable Redis are all "no cached
    // answer" — degrade to doing the work, never to failing the request.
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
 * L0: one turn's memo.
 *
 * Deliberately a class rather than a module-level Map. A module-level Map would
 * outlive the request and quietly become an unbounded, unshared, restart-wiped
 * second cache — exactly the thing this file exists to keep out of production.
 */
export class TurnCache {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /** Run `compute` at most once per key for the life of this turn. */
  memo<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const started = compute();
    this.inFlight.set(key, started);
    return started;
  }

  /** How many distinct lookups this turn made. Reported as a cost signal. */
  get size(): number {
    return this.inFlight.size;
  }
}

export interface CachedResult<T> {
  value: T;
  /** True when the value came from L0 or L1 and cost nothing to produce. */
  cached: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquireLock(key: string): Promise<boolean> {
  try {
    const res = await getRedisConnection().set(
      `${LOCK_PREFIX}:${key}`,
      "1",
      "EX",
      LOCK_TTL_SECONDS,
      "NX",
    );
    return res === "OK";
  } catch {
    // No Redis means no coordination; proceed rather than block.
    return true;
  }
}

async function releaseLock(key: string): Promise<void> {
  try {
    await getRedisConnection().del(`${LOCK_PREFIX}:${key}`);
  } catch {
    /* the TTL cleans it up */
  }
}

/**
 * Cache-aside with single-flight, across all three layers.
 *
 * `compute` is called ONLY on a genuine miss. The caller decides what a miss
 * costs — that decision (spend an allowance, call an upstream) belongs above
 * this function, not inside it, which is why the result reports `cached`
 * instead of silently charging for a hit.
 */
export async function getOrCompute<T>(
  turn: TurnCache,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T | null>,
): Promise<CachedResult<T> | null> {
  return turn.memo(key, async () => {
    const hit = await readCache<T>(key);
    if (hit !== null) return { value: hit, cached: true };

    const mine = await acquireLock(key);
    if (!mine) {
      // Someone else is already buying this answer. Watch for it rather than
      // buying a second copy.
      const deadline = Date.now() + LOCK_WAIT_MS;
      while (Date.now() < deadline) {
        await sleep(LOCK_POLL_MS);
        const late = await readCache<T>(key);
        if (late !== null) return { value: late, cached: true };
      }
      // The holder died or is slower than our patience. Fall through and do the
      // work: a bounded duplicate fetch beats a hung request.
    }

    try {
      const fresh = await compute();
      if (fresh === null) return null;
      await writeCache(key, fresh, ttlSeconds);
      return { value: fresh, cached: false };
    } finally {
      if (mine) await releaseLock(key);
    }
  }) as Promise<CachedResult<T> | null>;
}
