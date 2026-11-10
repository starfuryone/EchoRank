// src/lib/site-crawler/crawl-admin-metrics.ts
//
// /admin/crawl-metrics in one read: crawls running and queued (Postgres and
// the site-crawl queue), each crawler process's heartbeat (pages/s, CPU, RSS,
// batch-write latency, pool), Redis memory, the sidecar's render queue, and
// the Postgres connection budget the pools are sized to. Every part degrades
// to null on its own failure, so one unreachable piece never blanks the page.

import "server-only";
import type Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { getQueue } from "@/infrastructure/queue/registry";
import { connectionBudget, crawlSlotsConfigured, renderContexts, type ConnectionBudget } from "./capacity";
import { readCrawlerProcesses, type CrawlerProcessBeat } from "./crawl-metrics";

export interface RenderPoolStats {
  contexts: number;
  running: number;
  queued: number;
  queueWaitS: number;
}

export interface CrawlAdminMetrics {
  at: string;
  crawls: { running: number; queued: number } | null;
  queue: Record<string, number> | null;
  processes: CrawlerProcessBeat[];
  slots: { live: number; configured: number };
  pagesPerSec: number;
  redis: { usedMb: number; peakMb: number; maxMb: number | null; policy: string | null } | null;
  render: RenderPoolStats | null;
  renderContextsConfigured: number;
  db: ConnectionBudget;
}

/** INFO memory → the three numbers that matter, in MB. */
export function parseRedisMemory(info: string): { usedMb: number; peakMb: number; maxMb: number | null; policy: string | null } {
  const field = (k: string) => info.match(new RegExp(`^${k}:(.*)$`, "m"))?.[1]?.trim() ?? null;
  const mb = (v: string | null) => (v === null ? 0 : Math.round((Number(v) / 1048576) * 10) / 10);
  const max = Number(field("maxmemory") ?? 0);
  return { usedMb: mb(field("used_memory")), peakMb: mb(field("used_memory_peak")), maxMb: max > 0 ? mb(String(max)) : null, policy: field("maxmemory_policy") };
}

/** The sidecar's GET /render/stats, or null (down, older sidecar, slow). */
export async function fetchRenderStats(fetchImpl: typeof fetch = fetch): Promise<RenderPoolStats | null> {
  try {
    const res = await fetchImpl(`${process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500"}/render/stats`, {
      headers: { "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "" },
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RenderPoolStats;
  } catch {
    return null;
  }
}

export async function crawlAdminMetrics(redis: Redis = getRedisConnection()): Promise<CrawlAdminMetrics> {
  const [crawls, queue, processes, info, render] = await Promise.all([
    Promise.all([prisma.crawlJob.count({ where: { status: "RUNNING" } }), prisma.crawlJob.count({ where: { status: "QUEUED" } })])
      .then(([running, queued]) => ({ running, queued }))
      .catch(() => null),
    getQueue("site-crawl")
      .getJobCounts("active", "waiting", "prioritized", "delayed", "failed")
      .catch(() => null),
    readCrawlerProcesses(redis).catch(() => [] as CrawlerProcessBeat[]),
    redis.info("memory").catch(() => null),
    fetchRenderStats(),
  ]);
  return {
    at: new Date().toISOString(),
    crawls,
    queue,
    processes,
    slots: { live: processes.reduce((n, p) => n + p.concurrency, 0), configured: crawlSlotsConfigured() },
    pagesPerSec: Math.round(processes.reduce((n, p) => n + p.pagesPerSec, 0) * 100) / 100,
    redis: info ? parseRedisMemory(info) : null,
    render,
    renderContextsConfigured: renderContexts(),
    db: connectionBudget(),
  };
}
