// src/lib/site-crawler/public-api.ts
//
// Phase 3d-A: what the public crawl API (/api/public/v1/crawl*) and the MCP
// crawl tools answer with. One module, so the REST routes, the MCP tools and
// the completion callback describe a crawl the same way:
//
//   status    queued | crawling | completed | failed | cancelled, plus the
//             stored status and stop reason;
//   progress  pages crawled / the crawl's URL cap, rendered / render cap;
//   health    the site health score (site-health.ts), null until settled;
//   totals    findings by kind and by rule family (the stored per-rule tally);
//   segments  pages and findings per segment, for a crawl that ran with them.
//
// Every read is scoped to the tenant: findFirst on { id, tenantId }.

import "server-only";
import { RULE_BY_ID } from "@/lib/crawl-rules";
import { prisma } from "@/lib/prisma";
import type { CrawlStatus, Prisma } from "@/generated/prisma";
import { CRAWL_JOB_CONCURRENCY } from "./constants";
import { healthOf } from "./site-health";
import { ruleTalliesFor } from "./rule-summary";
import { segmentOverview, segmentScope } from "./segment-filter";

export type PublicPhase = "queued" | "crawling" | "completed" | "failed" | "cancelled";

export interface PublicCrawl {
  crawlId: string;
  rootUrl: string;
  host: string;
  mode: "spider" | "list";
  status: PublicPhase;
  stoppedReason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: { phase: PublicPhase; pagesCrawled: number; urlCap: number; pagesRendered: number; renderCap: number };
  health: number | null;
  scheduled: boolean;
  viaApi: boolean;
}

export interface PublicCrawlDetail extends PublicCrawl {
  summary: {
    issueCount: number;
    durationMs: number | null;
    statusCodes: Record<string, number> | null;
    highPriorityPages: number | null;
  } | null;
  totals: { byKind: Record<string, number>; byFamily: Record<string, number> } | null;
  segments: { index: number; name: string; pages: number; findings: number }[];
}

const PHASE: Record<CrawlStatus, PublicPhase> = { QUEUED: "queued", RUNNING: "crawling", COMPLETED: "completed", FAILED: "failed", CANCELLED: "cancelled" };

export const PUBLIC_CRAWL_SELECT = {
  id: true,
  rootUrl: true,
  mode: true,
  status: true,
  stoppedReason: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  pagesCrawled: true,
  urlCap: true,
  pagesRendered: true,
  renderCap: true,
  issueCount: true,
  summary: true,
  config: true,
  scheduleId: true,
  apiKeyId: true,
} satisfies Prisma.CrawlJobSelect;

export type PublicCrawlRow = Prisma.CrawlJobGetPayload<{ select: typeof PUBLIC_CRAWL_SELECT }>;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function toPublicCrawl(row: PublicCrawlRow): PublicCrawl {
  const phase = PHASE[row.status];
  return {
    crawlId: row.id,
    rootUrl: row.rootUrl,
    host: hostOf(row.rootUrl),
    mode: row.mode === "list" ? "list" : "spider",
    status: phase,
    // A failure's reason is an internal error message: say failed, not why.
    stoppedReason: row.status === "FAILED" ? null : row.stoppedReason,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    progress: { phase, pagesCrawled: row.pagesCrawled, urlCap: row.urlCap, pagesRendered: row.pagesRendered, renderCap: row.renderCap },
    health: healthOf(row.summary),
    scheduled: Boolean(row.scheduleId),
    viaApi: Boolean(row.apiKeyId),
  };
}

/** Findings per rule family from per-rule tallies; rules the registry no longer has count as "other". */
export function familyTotals(issues: Record<string, { count: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ruleId, t] of Object.entries(issues)) {
    const f = RULE_BY_ID.get(ruleId)?.family ?? "other";
    out[f] = (out[f] ?? 0) + t.count;
  }
  return out;
}

/** The detail view: status, progress, health, summary, totals by kind and family, segments. */
export async function publicCrawlDetail(row: PublicCrawlRow): Promise<PublicCrawlDetail> {
  const base = toPublicCrawl(row);
  const settled = row.status === "COMPLETED" || row.status === "CANCELLED";
  if (!settled) return { ...base, summary: null, totals: null, segments: [] };
  const s = (row.summary ?? {}) as { statusCodes?: Record<string, number>; highPages?: number };
  const defs = segmentScope(new URL("https://x.invalid/"), row.config).defs;
  const [tallies, segments] = await Promise.all([ruleTalliesFor(row.id, row.summary), segmentOverview(row.id, defs)]);
  return {
    ...base,
    summary: {
      issueCount: row.issueCount,
      durationMs: row.startedAt && row.finishedAt ? row.finishedAt.getTime() - row.startedAt.getTime() : null,
      statusCodes: s.statusCodes ?? null,
      highPriorityPages: typeof s.highPages === "number" ? s.highPages : null,
    },
    totals: { byKind: tallies.issuesByKind, byFamily: familyTotals(tallies.issues) },
    segments: segments.map((g) => ({ index: g.index, name: g.name, pages: g.pages, findings: g.totals.ERROR + g.totals.WARNING + g.totals.NOTICE })),
  };
}

/** One of the tenant's crawls, or null (another workspace's id is null too). */
export async function findPublicCrawl(tenantId: string, crawlId: string): Promise<PublicCrawlRow | null> {
  return prisma.crawlJob.findFirst({ where: { id: crawlId, tenantId }, select: PUBLIC_CRAWL_SELECT });
}

export const LIST_LIMIT_DEFAULT = 20;
export const LIST_LIMIT_MAX = 100;

/** The tenant's crawls, newest first; `host` is an exact site (either scheme, any path). */
export async function listPublicCrawls(tenantId: string, opts: { host?: string | null; limit?: number | null } = {}): Promise<PublicCrawl[]> {
  const host = (opts.host ?? "").trim().toLowerCase().slice(0, 200);
  const limit = Math.max(1, Math.min(LIST_LIMIT_MAX, Math.floor(opts.limit ?? LIST_LIMIT_DEFAULT) || LIST_LIMIT_DEFAULT));
  const rows = await prisma.crawlJob.findMany({
    where: {
      tenantId,
      ...(host
        ? {
            OR: ["http", "https"].flatMap((scheme) => [
              { rootUrl: { startsWith: `${scheme}://${host}/`, mode: "insensitive" as const } },
              { rootUrl: { equals: `${scheme}://${host}`, mode: "insensitive" as const } },
            ]),
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: PUBLIC_CRAWL_SELECT,
  });
  return rows.map(toPublicCrawl);
}

/** Assumed crawl length before the box has history to average. */
export const DEFAULT_CRAWL_MS = 10 * 60_000;

/**
 * Where a crawl sits in the box-wide queue and roughly when it starts.
 * Position 1 = next; 0 = already running. The estimate assumes the crawls
 * ahead take the box's recent average and run CRAWL_JOB_CONCURRENCY at a time.
 */
export async function queueEstimate(
  job: { id: string; status: CrawlStatus; createdAt: Date; startedAt: Date | null },
  now: Date = new Date(),
): Promise<{ queuePosition: number | null; estimatedStart: string | null }> {
  if (job.status === "RUNNING") return { queuePosition: 0, estimatedStart: (job.startedAt ?? now).toISOString() };
  if (job.status !== "QUEUED") return { queuePosition: null, estimatedStart: null };
  const [ahead, running, recent] = await Promise.all([
    prisma.crawlJob.count({ where: { status: "QUEUED", OR: [{ createdAt: { lt: job.createdAt } }, { createdAt: job.createdAt, id: { lt: job.id } }] } }),
    prisma.crawlJob.count({ where: { status: "RUNNING" } }),
    prisma.crawlJob.findMany({
      where: { status: "COMPLETED", startedAt: { not: null }, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 20,
      select: { startedAt: true, finishedAt: true },
    }),
  ]);
  const avg = recent.length
    ? Math.max(60_000, recent.reduce((n, r) => n + (r.finishedAt!.getTime() - r.startedAt!.getTime()), 0) / recent.length)
    : DEFAULT_CRAWL_MS;
  const busy = running + ahead;
  const waves = busy < CRAWL_JOB_CONCURRENCY ? 0 : Math.floor((busy - CRAWL_JOB_CONCURRENCY) / CRAWL_JOB_CONCURRENCY) + 1;
  return { queuePosition: ahead + 1, estimatedStart: new Date(now.getTime() + waves * avg).toISOString() };
}
