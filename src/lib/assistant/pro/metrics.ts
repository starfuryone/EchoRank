// src/lib/assistant/pro/metrics.ts
//
// Phase 8 observability: what the assistant did today, and what it cost.
//
// ONE REDIS HASH PER DAY PER TIER. `HINCRBY` into
// `echorank:assistant:metrics:{tier}:{YYYY-MM-DD}` rather than a key per
// counter, for two reasons: a whole day reads in one `HGETALL` instead of a
// key scan, and the TTL is set once on the hash instead of racing across a
// dozen sibling keys. Same INCR-and-expire shape as the rate limiters
// (src/lib/assistant/limits.ts) and for the same reason — a Map in this
// process would reset on every deploy, and this box restarts several times a
// day.
//
// COUNTERS ONLY. No tenant id, no user id, no message text, no domain. This is
// how many, not who: it exists to answer "is the cache working" and "what is
// this costing", and both are answerable from totals. A per-tenant breakdown
// is a different feature with a different privacy review.
//
// NEVER FAILS A REQUEST. Every write is best-effort and every read degrades to
// an empty map. A metric we could not record is a reporting gap; a metric that
// throws is an outage.

import { getRedisConnection } from "@/infrastructure/redis/connection";

const KEY_PREFIX = "echorank:assistant:metrics";

/** 35 days — a full month of history plus slack, then the key self-cleans. */
const TTL_SECONDS = 35 * 24 * 60 * 60;

/** Which surface produced the event. Kept apart so cost can be attributed. */
export type MetricTier = "public" | "pro";

/**
 * The fixed vocabulary. Tool calls and token counts add a suffix
 * (`tool.gscQueryStats`, `tokens.claude-sonnet-5`); everything else is exactly
 * one of these.
 */
export const METRIC_NAMES = [
  "cache_hit",
  "cache_miss",
  "heuristic_answer",
  "llm_answer",
  "llm_avoided",
  "budget_exceeded",
  "errors",
  "turns",
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function metricsKey(tier: MetricTier, now: Date = new Date()): string {
  return `${KEY_PREFIX}:${tier}:${utcDay(now)}`;
}

/**
 * Field name for one tool's call count.
 *
 * The tool name is namespaced rather than written bare so a tool called
 * "errors" could never overwrite the error counter.
 */
export function toolField(tool: string): string {
  return `tool.${tool}`;
}

/** Field name for one model's output-token total. */
export function tokensField(model: string): string {
  return `tokens.${model}`;
}

/**
 * Add to one or more counters on today's hash.
 *
 * Batched deliberately: a Pro turn increments `turns`, `llm_answer`, three
 * tool fields and a token field, and doing that as six round trips on the
 * request path is five more than it needs to be.
 */
export async function record(
  tier: MetricTier,
  fields: Record<string, number>,
  now: Date = new Date(),
): Promise<void> {
  const entries = Object.entries(fields).filter(
    ([, value]) => Number.isFinite(value) && value !== 0,
  );
  if (entries.length === 0) return;

  const key = metricsKey(tier, now);
  try {
    const redis = getRedisConnection();
    const pipeline = redis.pipeline();
    for (const [field, value] of entries) {
      pipeline.hincrby(key, field, Math.round(value));
    }
    // Set unconditionally rather than only on the first write: idempotent,
    // cheap, and it cannot leave a key TTL-less because one EXPIRE lost a race.
    pipeline.expire(key, TTL_SECONDS);
    await pipeline.exec();
  } catch {
    // See the header: a counter we could not write is a reporting gap.
  }
}

/** Shorthand for the common single-counter case. */
export function bump(tier: MetricTier, field: string, now: Date = new Date()): Promise<void> {
  return record(tier, { [field]: 1 }, now);
}

/** One day's counters for one tier. Empty when nothing happened or Redis is down. */
export async function readDay(
  tier: MetricTier,
  now: Date = new Date(),
): Promise<Record<string, number>> {
  try {
    const raw = await getRedisConnection().hgetall(metricsKey(tier, now));
    const out: Record<string, number> = {};
    for (const [field, value] of Object.entries(raw ?? {})) {
      const n = Number(value);
      if (Number.isFinite(n)) out[field] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export interface MetricsWindow {
  /** UTC day, newest last. */
  days: Array<{ day: string; public: Record<string, number>; pro: Record<string, number> }>;
}

/**
 * The last `days` UTC days for both tiers.
 *
 * Sequential rather than one big pipeline: this is an internal read endpoint
 * called by a human or a cron, not a request-path query, and the readable
 * version is worth more here than the fast one.
 */
export async function readWindow(days = 7, now: Date = new Date()): Promise<MetricsWindow> {
  const bounded = Math.max(1, Math.min(90, Math.trunc(days)));
  const out: MetricsWindow["days"] = [];
  for (let back = bounded - 1; back >= 0; back--) {
    const at = new Date(now.getTime() - back * 24 * 60 * 60 * 1000);
    out.push({
      day: utcDay(at),
      public: await readDay("public", at),
      pro: await readDay("pro", at),
    });
  }
  return { days: out };
}
