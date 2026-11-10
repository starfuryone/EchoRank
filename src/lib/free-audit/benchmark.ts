// src/lib/free-audit/benchmark.ts — "Higher than X% of sites checked" for the
// free AI Readiness Audit (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2).
//
// COMPUTED ONCE PER UTC DAY. The distribution of stored scores for a score
// version (free_audit_scores: score-only rows, no domains) is read on the
// first request of the day and cached in Redis under a date-stamped key, so
// every visitor that day is compared against the same snapshot and the table
// is grouped at most once a day per version. No worker job, no restart.
//
// HIDDEN UNDER BENCHMARK_MIN_RESULTS: a percentile over a handful of audits
// says nothing. Fail-closed: when the distribution cannot be read, no line.

import "server-only";

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { prisma } from "@/lib/prisma";
import { BENCHMARK_MIN_RESULTS } from "./limits";

export interface Distribution {
  /** Results of this score version. */
  n: number;
  /** counts[s] = results that scored s (0..100). */
  counts: number[];
}

export interface Benchmark {
  /** Share of stored results strictly below this score, whole percent, rounded down. */
  higherThanPct: number;
  n: number;
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10);
export const benchmarkKey = (version: number, now = new Date()) => `echorank:free-audit:benchmark:v${version}:${utcDay(now)}`;

/** Pure: the line for one score, or null under the minimum. */
export function benchmarkFrom(dist: Distribution, score: number): Benchmark | null {
  if (dist.n < BENCHMARK_MIN_RESULTS) return null;
  const s = Math.max(0, Math.min(100, Math.round(score)));
  let below = 0;
  for (let i = 0; i < s; i++) below += dist.counts[i] ?? 0;
  return { higherThanPct: Math.floor((below / dist.n) * 100), n: dist.n };
}

async function readDistribution(version: number): Promise<Distribution> {
  const rows = await prisma.freeAuditScore.groupBy({ by: ["score"], where: { scoreVersion: version }, _count: { _all: true } });
  const counts = Array.from({ length: 101 }, () => 0);
  let n = 0;
  for (const r of rows) {
    if (r.score >= 0 && r.score <= 100) {
      counts[r.score] += r._count._all;
      n += r._count._all;
    }
  }
  return { n, counts };
}

/** Today's distribution for a version: Redis first, else Postgres (then cached until tomorrow). */
export async function distributionFor(version: number, now = new Date()): Promise<Distribution | null> {
  const key = benchmarkKey(version, now);
  try {
    const redis = getRedisConnection();
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as Distribution;
    const dist = await readDistribution(version);
    await redis.set(key, JSON.stringify(dist), "EX", 2 * 24 * 60 * 60);
    return dist;
  } catch {
    return null;
  }
}

export async function benchmarkFor(score: number, version: number, now = new Date()): Promise<Benchmark | null> {
  const dist = await distributionFor(version, now);
  return dist ? benchmarkFrom(dist, score) : null;
}
