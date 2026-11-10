// src/lib/site-crawler/crawl-metrics.ts
//
// What the crawler processes are doing, for /admin/crawl-metrics and the
// queue-position estimate.
//
// Each process that runs the site-crawl worker (echorank360-crawlers, or
// echorank360-workers in the old shape) writes a heartbeat to Redis every
// HEARTBEAT_MS: its pid, slots, crawls running, CPU (% of one core over the
// last interval), RSS and pages/s. The key expires after HEARTBEAT_TTL_S, so a
// process that died drops out of the table on its own. Nothing here is in
// Postgres and nothing is kept: it is a live view, not history.

import "server-only";
import os from "node:os";
import type Redis from "ioredis";

export const HEARTBEAT_MS = 5_000;
export const HEARTBEAT_TTL_S = 20;
/** ZSET id → last beat (ms): the index of live processes. */
export const PROCESS_INDEX_KEY = "crawlers:procs";
export const processKey = (id: string) => `crawlers:proc:${id}`;

export interface CrawlerProcessBeat {
  id: string;
  pid: number;
  /** pm2's instance number (NODE_APP_INSTANCE), or null outside pm2. */
  instance: number | null;
  /** Which pm2 app: "crawlers" or "workers" (the old shape). */
  role: string;
  /** Crawls this process may run at once. */
  concurrency: number;
  /** Crawls running in it now. */
  active: number;
  /** CPU over the last interval, in % of one core (100 = one core busy). */
  cpuPct: number;
  rssMb: number;
  pagesTotal: number;
  pagesPerSec: number;
  /** Batch writes in the last interval: how many, rows, and their latency (ms). */
  writes: number;
  rowsWritten: number;
  writeMs: { p50: number; p95: number; max: number } | null;
  /** This process's pg pool: open connections and callers waiting for one. */
  db: { total: number; idle: number; waiting: number } | null;
  startedAt: number;
  at: number;
}

// ─── This process's counters (the runner and the worker call these) ─────────
let pagesTotal = 0;
let activeCrawls = 0;
/** Batch-write durations (ms) since the last beat: the Postgres write latency a crawl sees. */
let writeMs: number[] = [];
let rowsWritten = 0;
export function notePagesWritten(n: number): void {
  pagesTotal += n;
}
/** One batch's transaction (all its multi-row INSERTs), and the rows it wrote. */
export function noteBatchWrite(ms: number, rows: number): void {
  if (writeMs.length < 10_000) writeMs.push(ms);
  rowsWritten += rows;
}

/** p50 / p95 / max of a sample, null when empty. */
export function percentiles(sample: readonly number[]): { p50: number; p95: number; max: number } | null {
  if (sample.length === 0) return null;
  const s = [...sample].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]!;
  return { p50: at(0.5), p95: at(0.95), max: s[s.length - 1]! };
}
export function noteCrawlStarted(): void {
  activeCrawls += 1;
}
export function noteCrawlEnded(): void {
  activeCrawls = Math.max(0, activeCrawls - 1);
}

/** Start beating; returns the stop function (removes this process from the index). */
export function startCrawlerHeartbeat(
  redis: Redis,
  opts: { role: string; concurrency: number; poolStats?: () => { total: number; idle: number; waiting: number } },
): () => Promise<void> {
  const id = `${os.hostname()}:${process.pid}`;
  const startedAt = Date.now();
  const rawInstance = Number(process.env.NODE_APP_INSTANCE);
  const instance = Number.isInteger(rawInstance) ? rawInstance : null;
  let prevCpu = process.cpuUsage();
  let prevAt = Date.now();
  let prevPages = pagesTotal;

  const beat = async () => {
    const at = Date.now();
    const cpu = process.cpuUsage(prevCpu);
    const elapsedMs = Math.max(1, at - prevAt);
    const b: CrawlerProcessBeat = {
      id,
      pid: process.pid,
      instance,
      role: opts.role,
      concurrency: opts.concurrency,
      active: activeCrawls,
      cpuPct: Math.round(((cpu.user + cpu.system) / 1000 / elapsedMs) * 1000) / 10,
      rssMb: Math.round(process.memoryUsage.rss() / 1048576),
      pagesTotal,
      pagesPerSec: Math.round(((pagesTotal - prevPages) / (elapsedMs / 1000)) * 100) / 100,
      writes: writeMs.length,
      rowsWritten,
      writeMs: percentiles(writeMs),
      db: opts.poolStats ? opts.poolStats() : null,
      startedAt,
      at,
    };
    prevCpu = process.cpuUsage();
    prevAt = at;
    prevPages = pagesTotal;
    writeMs = [];
    rowsWritten = 0;
    await redis
      .multi()
      .set(processKey(id), JSON.stringify(b), "EX", HEARTBEAT_TTL_S)
      .zadd(PROCESS_INDEX_KEY, at, id)
      .zremrangebyscore(PROCESS_INDEX_KEY, 0, at - HEARTBEAT_TTL_S * 1000)
      .exec();
  };
  const timer = setInterval(() => void beat().catch(() => {}), HEARTBEAT_MS);
  timer.unref();
  void beat().catch(() => {});
  return async () => {
    clearInterval(timer);
    await redis.multi().del(processKey(id)).zrem(PROCESS_INDEX_KEY, id).exec().catch(() => {});
  };
}

/** The processes that beat within the TTL, by role then instance. */
export async function readCrawlerProcesses(redis: Redis, now: number = Date.now()): Promise<CrawlerProcessBeat[]> {
  const ids = await redis.zrangebyscore(PROCESS_INDEX_KEY, now - HEARTBEAT_TTL_S * 1000, "+inf");
  if (ids.length === 0) return [];
  const raw = await redis.mget(...ids.map(processKey));
  const out: CrawlerProcessBeat[] = [];
  for (const r of raw) {
    if (!r) continue;
    try {
      out.push(JSON.parse(r) as CrawlerProcessBeat);
    } catch {
      // A malformed beat is skipped; the next one replaces it.
    }
  }
  return out.sort((a, b) => a.role.localeCompare(b.role) || (a.instance ?? a.pid) - (b.instance ?? b.pid));
}

/** Crawl slots the live processes offer together; null when none is beating. */
export async function liveCrawlSlots(redis: Redis): Promise<number | null> {
  const procs = await readCrawlerProcesses(redis).catch(() => []);
  return procs.length ? procs.reduce((n, p) => n + p.concurrency, 0) : null;
}
