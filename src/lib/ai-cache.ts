// src/lib/ai-cache.ts
//
// Redis result cache for AI calls whose inputs are deterministic.
//
// THIS IS THE LAYER THAT ACTUALLY SAVES MONEY. Prompt caching (cache_control)
// cannot engage anywhere in this codebase — Haiku 4.5's minimum cacheable
// prefix is 4096 tokens and our largest system prompt is ~105 — so an exact
// repeat either costs full price or costs nothing, and this is what makes it
// nothing. Generalized from the Marketing Studio implementation
// (src/lib/marketing/cache.ts), which stays separate because its key has to
// fold in a per-tenant brand voice guide.
//
// WHERE IT GOES. The av-service sidecar has neither redis nor cachetools
// installed, and an in-process Python dict would reset on every `pm2 restart`
// on a box that restarts often — the same reasoning CLAUDE.md gives for
// keeping counters in Redis. So the sidecar's AI calls are cached HERE, on the
// app side, in front of sidecarPost(). The app already owns the Redis
// connection, the cache survives restarts, and skipping the sidecar call skips
// the Anthropic call inside it. It also means no new Python dependency and no
// sidecar restart to get caching.
//
// WHAT IS NOT CACHED. Anything whose value comes from being fresh per request.
// A cache is only correct here because the same input genuinely implies the
// same answer within the TTL.

import { createHash } from "node:crypto";
import { getRedisConnection } from "@/infrastructure/redis/connection";

/** 24 hours, matching Content Explorer and Marketing Studio. */
export const AI_CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Build a cache key from a namespace, a tenant scope and the inputs.
 *
 * TENANT-SCOPED ALWAYS. Two tenants can submit byte-identical inputs, and one
 * reading the other's stored generation would be a cross-tenant leak even
 * though the content is identical — the fact that they asked is itself theirs.
 */
export function aiCacheKey(
  namespace: string,
  tenantId: string,
  inputs: unknown,
): string {
  const canonical = JSON.stringify(inputs, canonicalize);
  const digest = createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  return `echorank:ai-cache:${namespace}:${tenantId}:${digest}`;
}

/** Sort object keys so JS insertion order cannot produce two keys for one input. */
function canonicalize(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

export async function readAiCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedisConnection().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A miss and a broken cache are the same to the caller: pay for the call.
    return null;
  }
}

export async function writeAiCache(key: string, value: unknown): Promise<void> {
  try {
    await getRedisConnection().set(
      key,
      JSON.stringify(value),
      "EX",
      AI_CACHE_TTL_SECONDS,
    );
  } catch {
    // Best-effort. The caller already has its answer.
  }
}

export interface CachedCallOptions {
  namespace: string;
  tenantId: string;
  inputs: unknown;
  /** Skip the read, still write. The `fresh: true` bypass. */
  fresh?: boolean;
}

/**
 * Run `compute` unless an identical call is already cached.
 *
 * Returns `cached: true` when nothing was spent. Callers surface that so a
 * "this was free" note is truthful rather than decorative.
 */
export async function cachedAiCall<T>(
  options: CachedCallOptions,
  compute: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  const key = aiCacheKey(options.namespace, options.tenantId, options.inputs);

  if (!options.fresh) {
    const hit = await readAiCache<T>(key);
    if (hit !== null) return { value: hit, cached: true };
  }

  const value = await compute();
  await writeAiCache(key, value);
  return { value, cached: false };
}
