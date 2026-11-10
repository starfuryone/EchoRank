// scripts/crawl-load-test/run.ts — the crawl concurrency load test.
//
// 48 crawls at once, 2,000 pages each, against the 48 local sites of
// origins.mjs, through four real crawler processes (start-crawlers.ts, 12
// crawls each) at the normal 2 req/s per host. Measures total pages/s, CPU and
// RSS per crawler process (their heartbeats), peak box RAM, peak Redis memory,
// Postgres write latency (each batch's transaction as the crawler sees it, and
// pg_stat_statements per INSERT), and the web app's p95 during the test against
// an idle baseline. Midway it SIGTERMs one crawler process and SIGKILLs another,
// restarts both, and at the end checks every crawl for lost or doubled pages.
//
// THROWAWAY INFRASTRUCTURE ONLY. It refuses to run unless DATABASE_URL points
// at a local database whose name contains "loadtest" on a port other than
// 5432, and REDIS_URL at a local Redis on a port other than 6379 or 6380
// (production's).
//
//   node scripts/crawl-load-test/origins.mjs &
//   DATABASE_URL=… REDIS_URL=… LT_WEB=http://127.0.0.1:4497 LT_PG_CONTAINER=… LT_OUT=<dir> \
//     NODE_OPTIONS=--conditions=react-server npx tsx scripts/crawl-load-test/run.ts

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import Redis from "ioredis";

const run = promisify(execFile);
const DB = process.env.DATABASE_URL ?? "";
const REDIS_URL = process.env.REDIS_URL ?? "";
const db = new URL(DB);
const rd = new URL(REDIS_URL || "redis://x:6379");
if (!["127.0.0.1", "localhost"].includes(db.hostname) || db.port === "5432" || !db.pathname.includes("loadtest")) {
  throw new Error("Refusing: DATABASE_URL must be a local throwaway database (name contains 'loadtest', not port 5432).");
}
// 6380 is production's Redis (redis-echorank.service), 6379 the box's default instance (not ours).
if (!["127.0.0.1", "localhost"].includes(rd.hostname) || ["", "6379", "6380"].includes(rd.port)) {
  throw new Error("Refusing: REDIS_URL must be a local throwaway Redis (not port 6379 or 6380).");
}

const SITES = Number(process.env.LT_SITES ?? 48);
const PAGES = Number(process.env.LT_PAGES ?? 2000);
const PROCESSES = Number(process.env.LT_PROCESSES ?? 4);
const PER_PROCESS = Number(process.env.LT_PER_PROCESS ?? 12);
const POOL = Number(process.env.LT_POOL ?? 7);
const WEB = process.env.LT_WEB ?? "";
const PG_CONTAINER = process.env.LT_PG_CONTAINER ?? "";
const OUT = process.env.LT_OUT ?? "/tmp/crawl-load-test";
const DISRUPT = process.env.LT_DISRUPT !== "0";
const TIMEOUT_MS = 75 * 60_000;
mkdirSync(OUT, { recursive: true });
const SAMPLES = join(OUT, "samples.jsonl");
writeFileSync(SAMPLES, "");

// The package is CommonJS (no top-level await): everything runs inside main().
// Outside main(): the catch handler at the bottom stops them on a failed run.
const procs: (ChildProcess | null)[] = [];

async function main(): Promise<void> {
const { prisma } = await import("@/lib/prisma");
const { startCrawl } = await import("@/lib/site-crawler/service");
const { readCrawlerProcesses, percentiles } = await import("@/lib/site-crawler/crawl-metrics");
const redis = new Redis(REDIS_URL);
const log = (...a: unknown[]) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Crawler processes ──────────────────────────────────────────────────────
const APP = process.cwd();
const PRELOAD = join(APP, "scripts/crawl-load-test/fetch-redirect.mjs");
function startCrawler(i: number): ChildProcess {
  const child = spawn(join(APP, "node_modules/.bin/tsx"), ["src/infrastructure/queue/start-crawlers.ts"], {
    cwd: APP,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NODE_OPTIONS: `--conditions=react-server --import ${PRELOAD}`,
      NODE_APP_INSTANCE: String(i),
      CRAWL_LOAD_TEST: "1",
      CRAWL_PROCESSES: String(PROCESSES),
      CRAWL_CONCURRENCY_PER_PROCESS: String(PER_PROCESS),
      DB_POOL_MAX: String(POOL),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const file = join(OUT, `crawler-${i}.log`);
  child.stdout!.on("data", (d) => appendFileSync(file, d));
  child.stderr!.on("data", (d) => appendFileSync(file, d));
  procs[i] = child;
  return child;
}
/** The node process tsx runs (the one that crawls), for a SIGKILL that skips every handler. */
async function nodeChildOf(pid: number): Promise<number | null> {
  const { stdout } = await run("ps", ["-o", "pid=", "--ppid", String(pid)]).catch(() => ({ stdout: "" }));
  const kids = stdout.trim().split(/\s+/).filter(Boolean).map(Number);
  return kids[0] ?? null;
}
const exited = (c: ChildProcess) => new Promise<void>((r) => (c.exitCode !== null ? r() : c.once("exit", () => r())));

// ─── Web probe ──────────────────────────────────────────────────────────────
const WEB_PATHS = ["/en", "/en/site-crawler", "/en/pricing", "/en/learn"];
const web: { at: number; ms: number; ok: boolean; phase: string }[] = [];
let webPhase = "idle";
let probing = Boolean(WEB);
async function probeWeb() {
  let i = 0;
  while (probing) {
    const path = WEB_PATHS[i++ % WEB_PATHS.length]!;
    const t = performance.now();
    let ok = false;
    try {
      const res = await fetch(`${WEB}${path}`, { signal: AbortSignal.timeout(30_000) });
      await res.arrayBuffer();
      ok = res.ok;
    } catch {
      ok = false;
    }
    web.push({ at: Date.now(), ms: Math.round(performance.now() - t), ok, phase: webPhase });
    await sleep(500);
  }
}

// ─── Sampling ───────────────────────────────────────────────────────────────
function memUsedMb(): number {
  const m = Object.fromEntries(
    readFileSync("/proc/meminfo", "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [k, v] = l.split(":");
        return [k!, Number.parseInt(v!, 10)];
      }),
  );
  return Math.round((m.MemTotal! - m.MemAvailable!) / 1024);
}
async function pgContainer(): Promise<{ cpu: number; memMb: number } | null> {
  if (!PG_CONTAINER) return null;
  const { stdout } = await run("docker", ["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}", PG_CONTAINER]).catch(() => ({ stdout: "" }));
  const [cpu, mem] = stdout.trim().split("|");
  if (!cpu || !mem) return null;
  const [num, unit] = /([\d.]+)\s*([KMG]i?B)/.exec(mem)!.slice(1);
  const mb = Number(num) * (unit!.startsWith("G") ? 1024 : unit!.startsWith("K") ? 1 / 1024 : 1);
  return { cpu: Number.parseFloat(cpu), memMb: Math.round(mb) };
}
const jobIds: string[] = [];
type Sample = Awaited<ReturnType<typeof sample>>;
async function sample(t0: number) {
  const [beats, info, counts, pages, pg] = await Promise.all([
    readCrawlerProcesses(redis),
    redis.info("memory"),
    // This run's crawls only (a database reused across runs keeps the earlier ones).
    prisma.crawlJob.groupBy({ by: ["status"], where: { id: { in: jobIds } }, _count: true }),
    prisma.crawlJob.aggregate({ where: { id: { in: jobIds } }, _sum: { pagesCrawled: true } }),
    pgContainer(),
  ]);
  const field = (k: string) => Number(info.match(new RegExp(`^${k}:(\\d+)`, "m"))?.[1] ?? 0);
  return {
    t: Math.round((Date.now() - t0) / 1000),
    pages: pages._sum.pagesCrawled ?? 0,
    status: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    procs: beats.filter((b) => b.role === "crawlers").map((b) => ({ i: b.instance, pid: b.pid, active: b.active, cpu: b.cpuPct, rss: b.rssMb, pps: b.pagesPerSec, w: b.writeMs, writes: b.writes, db: b.db })),
    redisMb: Math.round(field("used_memory") / 1048576),
    redisPeakMb: Math.round(field("used_memory_peak") / 1048576),
    boxUsedMb: memUsedMb(),
    load1: Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]),
    pg,
  };
}

// ─── The run ────────────────────────────────────────────────────────────────
const PLANS = ["STARTER", "GROWTH", "AGENCY"] as const;
log(`seeding ${SITES} workspaces`);
for (let i = 1; i <= SITES; i++) {
  const id = `lt_tenant_${String(i).padStart(2, "0")}`;
  await prisma.tenant.upsert({ where: { id }, update: {}, create: { id, name: `Load test ${i}`, slug: id, planType: PLANS[i % 3] } });
}
await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_stat_statements").catch(() => {});

for (let i = 0; i < PROCESSES; i++) startCrawler(i);
log(`started ${PROCESSES} crawler processes × ${PER_PROCESS}`);
if (WEB) void probeWeb();
await sleep(60_000); // the idle baseline for the web app, and the processes' warm-up

await prisma.$queryRawUnsafe("SELECT pg_stat_statements_reset()").catch(() => {});
webPhase = "load";
const t0 = Date.now();
for (let i = 1; i <= SITES; i++) {
  const tenantId = `lt_tenant_${String(i).padStart(2, "0")}`;
  const job = await startCrawl(tenantId, PLANS[i % 3], `https://lt${String(i).padStart(2, "0")}.crawl-loadtest.zz/`);
  jobIds.push(job.id);
}
log(`started ${jobIds.length} crawls`);

const samples: Sample[] = [];
let termAt = DISRUPT ? 6 * 60_000 : Infinity;
let killAt = DISRUPT ? 10 * 60_000 : Infinity;
const disruptions: string[] = [];
for (;;) {
  const s = await sample(t0);
  samples.push(s);
  appendFileSync(SAMPLES, `${JSON.stringify(s)}\n`);
  const done = (s.status.COMPLETED ?? 0) + (s.status.FAILED ?? 0) + (s.status.CANCELLED ?? 0);
  if (s.t % 30 < 5) log(`t=${s.t}s pages=${s.pages} running=${s.status.RUNNING ?? 0} queued=${s.status.QUEUED ?? 0} done=${done} redis=${s.redisMb}MB box=${s.boxUsedMb}MB`);
  if (done >= jobIds.length) break;
  if (Date.now() - t0 > TIMEOUT_MS) {
    log("timeout");
    break;
  }
  if (Date.now() - t0 > termAt) {
    termAt = Infinity;
    const c = procs[1]!;
    log(`SIGTERM crawler 1 (pid ${c.pid}): its crawls should write what they hold and go back to the queue`);
    const started = Date.now();
    c.kill("SIGTERM");
    await exited(c);
    disruptions.push(`SIGTERM crawler 1 at t=${s.t}s, exited after ${Math.round((Date.now() - started) / 1000)} s`);
    startCrawler(1);
    log(disruptions.at(-1), "; restarted");
  }
  if (Date.now() - t0 > killAt) {
    killAt = Infinity;
    const c = procs[2]!;
    const nodePid = await nodeChildOf(c.pid!);
    log(`SIGKILL crawler 2 (node pid ${nodePid}): no handler runs; BullMQ's stalled check re-queues its crawls`);
    if (nodePid) process.kill(nodePid, "SIGKILL");
    await exited(c);
    disruptions.push(`SIGKILL crawler 2 at t=${s.t}s`);
    startCrawler(2);
  }
  await sleep(5_000);
}
const wall = (Date.now() - t0) / 1000;
probing = false;

// ─── Results ────────────────────────────────────────────────────────────────
const jobs = await prisma.crawlJob.findMany({
  where: { id: { in: jobIds } },
  select: { id: true, status: true, pagesCrawled: true, stoppedReason: true, startedAt: true, finishedAt: true, createdAt: true },
});
const integrity = await prisma.$queryRawUnsafe<{ id: string; rows: bigint; urls: bigint }[]>(
  `SELECT "crawlJobId" AS id, count(*) AS rows, count(DISTINCT url) AS urls FROM crawl_pages WHERE "crawlJobId" = ANY($1) GROUP BY 1`,
  jobIds,
);
const stmts = await prisma
  .$queryRawUnsafe<{ query: string; calls: bigint; mean: number; max: number; rows: bigint }[]>(
    `SELECT left(query, 60) AS query, calls, round(mean_exec_time::numeric, 2)::float AS mean, round(max_exec_time::numeric, 1)::float AS max, rows
       FROM pg_stat_statements WHERE query ILIKE 'INSERT INTO "public"."crawl_%' ORDER BY total_exec_time DESC LIMIT 8`,
  )
  .catch(() => []);

const crawling = samples.filter((s) => (s.status.RUNNING ?? 0) > 0);
const byProc = new Map<number, { cpu: number[]; rss: number[] }>();
const writeP95: number[] = [];
const writeMax: number[] = [];
for (const s of crawling) {
  for (const p of s.procs) {
    const e = byProc.get(p.i ?? -1) ?? { cpu: [], rss: [] };
    e.cpu.push(p.cpu);
    e.rss.push(p.rss);
    byProc.set(p.i ?? -1, e);
    if (p.w) {
      writeP95.push(p.w.p95);
      writeMax.push(p.w.max);
    }
  }
}
const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
const totalPages = jobs.reduce((n, j) => n + j.pagesCrawled, 0);
const rolling = samples.map((s, i) => (i >= 6 ? (s.pages - samples[i - 6]!.pages) / (s.t - samples[i - 6]!.t) : 0));
const webStats = (phase: string) => {
  const w = web.filter((x) => x.phase === phase);
  return { requests: w.length, failed: w.filter((x) => !x.ok).length, ...percentiles(w.map((x) => x.ms)) };
};
const summary = {
  config: { sites: SITES, pagesPerSite: PAGES, processes: PROCESSES, perProcess: PER_PROCESS, dbPoolPerProcess: POOL },
  wallSeconds: Math.round(wall),
  totalPages,
  pagesPerSecOverall: Math.round((totalPages / wall) * 10) / 10,
  pagesPerSecPeak30s: Math.round(Math.max(0, ...rolling) * 10) / 10,
  crawls: Object.fromEntries(
    ["COMPLETED", "FAILED", "CANCELLED", "RUNNING", "QUEUED"].map((st) => [st, jobs.filter((j) => j.status === st).length]),
  ),
  stoppedReasons: [...new Set(jobs.map((j) => j.stoppedReason ?? "none"))],
  crawlMinutes: percentiles(jobs.filter((j) => j.finishedAt && j.startedAt).map((j) => (j.finishedAt!.getTime() - j.startedAt!.getTime()) / 60_000)),
  integrity: {
    jobsChecked: integrity.length,
    pagesShort: jobs.filter((j) => j.pagesCrawled !== PAGES).map((j) => [j.id, j.pagesCrawled]),
    doubled: integrity.filter((r) => r.rows !== r.urls).map((r) => [r.id, Number(r.rows), Number(r.urls)]),
    rowsVsCounter: integrity.filter((r) => Number(r.rows) !== jobs.find((j) => j.id === r.id)!.pagesCrawled).length,
  },
  disruptions,
  cpuPerProcess: Object.fromEntries([...byProc].map(([i, e]) => [`crawler ${i}`, { avgPct: avg(e.cpu), maxPct: Math.max(...e.cpu), avgRssMb: avg(e.rss), maxRssMb: Math.max(...e.rss) }])),
  peakBoxUsedMb: Math.max(...samples.map((s) => s.boxUsedMb)),
  baselineBoxUsedMb: samples[0]?.boxUsedMb ?? null,
  peakRedisMb: Math.max(...samples.map((s) => s.redisPeakMb)),
  peakLoad1: Math.max(...samples.map((s) => s.load1)),
  postgres: {
    batchWriteMs: { medianP95: percentiles(writeP95)?.p50 ?? null, worstP95: Math.max(0, ...writeP95), worstMax: Math.max(0, ...writeMax) },
    container: { maxCpuPct: Math.max(0, ...samples.map((s) => s.pg?.cpu ?? 0)), maxMemMb: Math.max(0, ...samples.map((s) => s.pg?.memMb ?? 0)) },
    inserts: stmts.map((s) => ({ ...s, calls: Number(s.calls), rows: Number(s.rows) })),
    maxPoolWaiting: Math.max(0, ...crawling.flatMap((s) => s.procs.map((p) => p.db?.waiting ?? 0))),
  },
  web: WEB ? { idle: webStats("idle"), underLoad: webStats("load") } : null,
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

for (const c of procs) if (c && c.exitCode === null) c.kill("SIGTERM");
await Promise.all(procs.map((c) => (c ? exited(c) : null)));
await redis.quit();
await prisma.$disconnect();
process.exit(0);
}

main().catch((err) => {
  console.error(err);
  // Never leave a crawler process behind on a failed run.
  for (const c of procs) if (c && c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(1), 15_000).unref();
});
