// src/lib/site-crawler/capacity.ts
//
// How many crawls the box runs, where, and what that costs in Postgres
// connections. Dependency-free (env + arithmetic) so the pm2 ecosystem, the
// crawler entry point, /admin and the tests all read the same numbers.
//
// WHERE CRAWLS RUN. With CRAWL_PROCESSES >= 1 they run in their own pm2 app,
// echorank360-crawlers (src/infrastructure/queue/start-crawlers.ts): that many
// processes, CRAWL_CONCURRENCY_PER_PROCESS crawls each (4 × 12 = 48 by
// default), and echorank360-workers no longer starts the site-crawl worker, so
// AI checks, alerts and email never wait behind a crawl. Unset or 0 = the old
// shape: echorank360-workers runs CRAWL_MAX_CONCURRENT crawls (default 6). The
// unset default is the old shape on purpose: a deploy that lands before the
// pm2 change is applied must not leave crawls with no process to run them.
//
// CONNECTIONS. Every echorank process has its own pg Pool (DB_POOL_MAX,
// src/lib/prisma.ts). Their sum stays under PG_CONNECTION_SHARE (60%) of
// PG_MAX_CONNECTIONS (production's max_connections, 100), so psql, migrations
// and the other apps on that server keep room. crawlerPoolSize() is what each
// crawler process gets once the web app and the workers have theirs.

// The old single-process ceiling (echorank360-workers), kept for CRAWL_PROCESSES=0.
import { CRAWL_MAX_CONCURRENT_BOUNDS, CRAWL_MAX_CONCURRENT_DEFAULT } from "./constants";

/** process.env, or any plain map of the same names (the tests, the ecosystem). */
export type Env = Record<string, string | undefined>;

/** Bounded integer from env; the default when unset or not an integer. */
function envInt(raw: string | undefined, fallback: number, [min, max]: readonly [number, number]): number {
  const v = (raw ?? "").trim();
  const n = Number(v);
  if (!v || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** The pm2 ecosystem's instance count for echorank360-crawlers when CRAWL_PROCESSES is not given there. */
export const CRAWL_PROCESSES_DEFAULT = 4;
export const CRAWL_PROCESSES_BOUNDS = [0, 8] as const;
export const CRAWL_CONCURRENCY_PER_PROCESS_DEFAULT = 12;
export const CRAWL_CONCURRENCY_PER_PROCESS_BOUNDS = [1, 16] as const;

/** Crawler processes configured: CRAWL_PROCESSES, 0 (unset) = crawls stay in echorank360-workers. */
export function crawlProcesses(env: Env = process.env): number {
  return envInt(env.CRAWL_PROCESSES, 0, CRAWL_PROCESSES_BOUNDS);
}

/** Whether crawls run in echorank360-crawlers (and not in echorank360-workers). */
export function crawlsInOwnProcess(env: Env = process.env): boolean {
  return crawlProcesses(env) > 0;
}

/** Crawls one process runs at once: CRAWL_CONCURRENCY_PER_PROCESS, or CRAWL_MAX_CONCURRENT in the old shape. */
export function crawlConcurrencyPerProcess(env: Env = process.env): number {
  return crawlsInOwnProcess(env)
    ? envInt(env.CRAWL_CONCURRENCY_PER_PROCESS, CRAWL_CONCURRENCY_PER_PROCESS_DEFAULT, CRAWL_CONCURRENCY_PER_PROCESS_BOUNDS)
    : envInt(env.CRAWL_MAX_CONCURRENT, CRAWL_MAX_CONCURRENT_DEFAULT, CRAWL_MAX_CONCURRENT_BOUNDS);
}

/** Crawls the box runs at once, as configured (live processes may differ; see crawl-metrics.ts). */
export function crawlSlotsConfigured(env: Env = process.env): number {
  return Math.max(1, crawlProcesses(env)) * crawlConcurrencyPerProcess(env);
}

// ─── Finishing a crawl ──────────────────────────────────────────────────────
/**
 * Crawls one process finalises at once (link graph + aggregation, runner.ts).
 * A 2,000-page aggregation runs up to 7 queries in parallel for seconds; 12
 * crawls of the same size finishing together on a 7-connection pool waited
 * past the pool's 5 s connect timeout and lost their terminal write (load
 * test, 2026-11-10). The rest wait their turn, still RUNNING on screen.
 * Default: one per 7 pool connections, at least 1.
 */
export const CRAWL_FINALIZE_CONCURRENCY_BOUNDS = [1, 8] as const;
export function crawlFinalizeConcurrency(env: Env = process.env): number {
  const pool = envInt(env.DB_POOL_MAX, 20, [1, 500]);
  return envInt(env.CRAWL_FINALIZE_CONCURRENCY, Math.max(1, Math.floor(pool / 7)), CRAWL_FINALIZE_CONCURRENCY_BOUNDS);
}

// ─── Render pool ────────────────────────────────────────────────────────────
/**
 * Browser contexts the sidecar renders in at once, shared by every crawl
 * (av-service render.py reads the same RENDER_CONTEXTS). A crawl sends one
 * render at a time; the rest wait in the sidecar's queue, in order.
 */
export const RENDER_CONTEXTS_DEFAULT = 6;
export const RENDER_CONTEXTS_BOUNDS = [1, 12] as const;
export function renderContexts(env: Env = process.env): number {
  return envInt(env.RENDER_CONTEXTS ?? env.RENDER_POOL, RENDER_CONTEXTS_DEFAULT, RENDER_CONTEXTS_BOUNDS);
}

// ─── Postgres connections ───────────────────────────────────────────────────
export const PG_MAX_CONNECTIONS_DEFAULT = 100;
export const PG_CONNECTION_SHARE = 0.6;
/** pg Pool size of the web app and of echorank360-workers once crawls left it. */
export const WEB_POOL_DEFAULT = 20;
export const WORKERS_POOL_DEFAULT = 10;

export interface ConnectionBudget {
  maxConnections: number;
  /** The most every echorank pool may hold together and stay UNDER share × max_connections (59 of 100). */
  budget: number;
  web: number;
  workers: number;
  crawlerProcesses: number;
  /** Each crawler process's DB_POOL_MAX. */
  perCrawler: number;
  /** web + workers + crawlerProcesses × perCrawler. */
  total: number;
}

/** The pools that fit: what is left of the budget after web and workers, split over the crawler processes. */
export function connectionBudget(env: Env = process.env): ConnectionBudget {
  const maxConnections = envInt(env.PG_MAX_CONNECTIONS, PG_MAX_CONNECTIONS_DEFAULT, [10, 10_000]);
  const budget = Math.ceil(maxConnections * PG_CONNECTION_SHARE) - 1;
  const web = envInt(env.WEB_DB_POOL_MAX, WEB_POOL_DEFAULT, [1, 500]);
  const workers = envInt(env.WORKERS_DB_POOL_MAX, WORKERS_POOL_DEFAULT, [1, 500]);
  const crawlerProcesses = crawlProcesses(env);
  const left = budget - web - workers;
  const perCrawler = crawlerProcesses > 0 ? Math.max(1, Math.floor(left / crawlerProcesses)) : 0;
  return { maxConnections, budget, web, workers, crawlerProcesses, perCrawler, total: web + workers + crawlerProcesses * perCrawler };
}
