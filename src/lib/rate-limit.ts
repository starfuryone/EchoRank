import { getRedisConnection } from "@/infrastructure/redis/connection";

// ─── In-memory fallback ─────────────────────────────────────────────────────

const rateMap = new Map<string, { count: number; resetTime: number }>();

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

// ─── Redis sliding-window rate limiter ──────────────────────────────────────

/**
 * Sliding window rate limiter backed by Redis sorted sets.
 * Falls back to in-memory rate limiting if Redis is unavailable.
 *
 * @param key   - Unique key for this rate limit bucket (e.g. `webhook:127.0.0.1`)
 * @param limit - Maximum number of requests allowed within the window
 * @param windowMs - Window size in milliseconds
 * @returns `{ success, remaining }` indicating whether the request is allowed
 */
export async function rateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60_000
): Promise<{ success: boolean; remaining: number }> {
  try {
    const redis = getRedisConnection();
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use a pipeline for atomicity and performance
    const pipeline = redis.pipeline();

    // 1. Remove entries outside the current window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    // 2. Add the current request with timestamp as score
    // Use a unique member to avoid collisions: timestamp + random suffix
    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
    pipeline.zadd(redisKey, now, member);

    // 3. Count entries in the current window
    pipeline.zcard(redisKey);

    // 4. Set expiry on the key to auto-clean
    pipeline.pexpire(redisKey, windowMs);

    const results = await pipeline.exec();

    if (!results) {
      // Pipeline returned null — fall back to in-memory
      return inMemoryRateLimit(key, limit, windowMs);
    }

    // results[2] is the ZCARD result: [error, count]
    const zcardResult = results[2];
    const currentCount =
      zcardResult && zcardResult[1] !== null && zcardResult[1] !== undefined
        ? (zcardResult[1] as number)
        : 0;

    if (currentCount > limit) {
      // We already added the entry above, so remove it since it exceeds the limit
      await redis.zrem(redisKey, member);
      return { success: false, remaining: 0 };
    }

    const remaining = Math.max(0, limit - currentCount);
    return { success: true, remaining };
  } catch {
    // Redis unavailable — fall back to in-memory
    return inMemoryRateLimit(key, limit, windowMs);
  }
}
