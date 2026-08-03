// src/lib/marketing/cache.ts
//
// Caching layer 2: the finished deliverable, in Redis, keyed on everything that
// went into producing it.
//
// This is the layer that actually saves money in this module. Layer 1 (prompt
// caching on the shared system prefix) cannot engage — see the comment on
// HAIKU_MIN_CACHEABLE_PREFIX_TOKENS in marketing-templates.ts — but an exact
// repeat here costs nothing at all, which beats the 90% discount layer 1 would
// have given. Re-submitting an unchanged form is the single most common way a
// tenant spends money twice for one answer: they tweak nothing, hit generate
// again, and expect a different result.
//
// TENANT-SCOPED. The key includes tenantId even though it also includes a hash
// of every input, because the brand voice guide is per-tenant and is part of
// the prompt. Two tenants submitting byte-identical forms must not share an
// answer shaped by one of their voice guides.

import { createHash } from "node:crypto";
import { getRedisConnection } from "@/infrastructure/redis/connection";

/** 24 hours, matching Content Explorer's window. Long enough to cover a working
 *  session and a re-submit; short enough that yesterday's brief is regenerated
 *  rather than served stale. */
export const MARKETING_CACHE_TTL_SECONDS = 24 * 60 * 60;

export interface CachedGeneration {
  output: string;
  /** Output tokens the ORIGINAL call spent. Reported as 0 to the caller on a
   *  hit — nothing was spent this time — but kept so the saving is auditable. */
  originalOutputTokens: number;
}

/**
 * Key inputs: category, the variable values verbatim, the response language,
 * and the voice guide. Anything that changes the prompt must change the key, or
 * a tenant who edits their voice guide keeps getting the old voice back.
 */
export function marketingCacheKey(input: {
  tenantId: string;
  categoryId: string;
  values: Record<string, string>;
  language: string;
  voiceGuide: string | null;
}): string {
  // Sorted keys: the client sends a form object, and JS object order is not a
  // contract. Without sorting, the same form could hash two ways.
  const canonical = JSON.stringify({
    c: input.categoryId,
    v: Object.keys(input.values)
      .sort()
      .map((k) => [k, input.values[k]]),
    l: input.language,
    // The guide can be long; its hash is enough to detect a change.
    g: input.voiceGuide ? createHash("sha256").update(input.voiceGuide).digest("hex") : null,
  });
  const digest = createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  return `echorank:marketing:result:${input.tenantId}:${digest}`;
}

export async function readCachedGeneration(key: string): Promise<CachedGeneration | null> {
  try {
    const raw = await getRedisConnection().get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedGeneration>;
    if (typeof parsed.output !== "string" || !parsed.output) return null;
    return {
      output: parsed.output,
      originalOutputTokens: Number(parsed.originalOutputTokens) || 0,
    };
  } catch {
    // A cache miss and a broken cache are the same thing to the caller: pay for
    // the call. Never fail a generation because the cache is down.
    return null;
  }
}

export async function writeCachedGeneration(
  key: string,
  value: CachedGeneration,
): Promise<void> {
  try {
    await getRedisConnection().set(key, JSON.stringify(value), "EX", MARKETING_CACHE_TTL_SECONDS);
  } catch {
    // Best-effort. The tenant already has their deliverable.
  }
}
