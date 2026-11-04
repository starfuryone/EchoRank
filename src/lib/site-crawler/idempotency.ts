// src/lib/site-crawler/idempotency.ts
//
// Idempotency-Key for POST /api/public/v1/crawl, kept 24 hours in Redis per
// tenant. The first request claims the key ("pending"), then records the crawl
// it started with a hash of its body:
//
//   same key, same body, finished   → the same crawl again (no second start);
//   same key, while the first runs  → 409, try again in a moment;
//   same key, a different body      → 422 (a reused key, not a retry);
//   the first request failed        → the claim is released, a retry starts.
//
// The key itself is hashed before it becomes part of a Redis key.

import "server-only";
import { createHash } from "node:crypto";
import { getRedisConnection } from "@/infrastructure/redis/connection";

export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
export const IDEMPOTENCY_KEY_MAX = 200;

type Redis = Pick<ReturnType<typeof getRedisConnection>, "set" | "get" | "del">;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const idempotencyRedisKey = (tenantId: string, key: string) => `crawl-idem:${tenantId}:${sha(key)}`;

export type IdempotencyClaim = { state: "new" } | { state: "pending" } | { state: "done"; crawlId: string } | { state: "mismatch" };

export async function claimIdempotency(tenantId: string, key: string, body: string, redis: Redis = getRedisConnection()): Promise<IdempotencyClaim> {
  const k = idempotencyRedisKey(tenantId, key);
  const claimed = await redis.set(k, JSON.stringify({ pending: true, body: sha(body) }), "EX", IDEMPOTENCY_TTL_SECONDS, "NX");
  if (claimed === "OK") return { state: "new" };
  const raw = await redis.get(k);
  if (!raw) return { state: "pending" };
  const v = JSON.parse(raw) as { pending?: boolean; body?: string; crawlId?: string };
  if (v.body !== sha(body)) return { state: "mismatch" };
  if (v.pending || !v.crawlId) return { state: "pending" };
  return { state: "done", crawlId: v.crawlId };
}

export async function completeIdempotency(tenantId: string, key: string, body: string, crawlId: string, redis: Redis = getRedisConnection()): Promise<void> {
  await redis.set(idempotencyRedisKey(tenantId, key), JSON.stringify({ crawlId, body: sha(body) }), "EX", IDEMPOTENCY_TTL_SECONDS);
}

export async function releaseIdempotency(tenantId: string, key: string, redis: Redis = getRedisConnection()): Promise<void> {
  await redis.del(idempotencyRedisKey(tenantId, key));
}
