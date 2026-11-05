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
import { RULE_BY_ID, RULES } from "@/lib/crawl-rules";
import { prisma } from "@/lib/prisma";
import type { CrawlStatus, Prisma } from "@/generated/prisma";
import { crawlMaxConcurrent, TENANT_CRAWL_CONCURRENCY_DEFAULT, tenantOverrides } from "./tenant-caps";
import { healthOf } from "./site-health";
import { legacyTypesFor, ruleTalliesFor } from "./rule-summary";
import { crawlDataState, rowsReadable, type CrawlDataState } from "./data-state";
import { ruleIdOf } from "./legacy-map";
import { issueInSegment, segmentOverview, segmentScope } from "./segment-filter";

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
  /** Where the full data is: "hot" (readable), "archived" (restore it in the dashboard), "purged" (summary only, for good). */
  data: CrawlDataState;
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
  tenantId: true,
  storageState: true,
  dataPurgedAt: true,
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
    data: crawlDataState(row),
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
  // Totals from the summary's cache when the rows are archived or purged; segments need the rows.
  const [tallies, segments] = await Promise.all([ruleTalliesFor(row.id, row.summary, row), rowsReadable(row) ? segmentOverview(row.id, defs) : []]);
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
 * ahead take the box's recent average and run crawlMaxConcurrent() at a time
 * (CRAWL_MAX_CONCURRENT, default 6) — and, with fair share, that the crawl's
 * own workspace runs only its concurrency (default 1) at a time, so the later
 * of the two waits wins.
 */
export async function queueEstimate(
  job: { id: string; tenantId?: string; status: CrawlStatus; createdAt: Date; startedAt: Date | null },
  now: Date = new Date(),
  slots: number = crawlMaxConcurrent(),
): Promise<{ queuePosition: number | null; estimatedStart: string | null }> {
  if (job.status === "RUNNING") return { queuePosition: 0, estimatedStart: (job.startedAt ?? now).toISOString() };
  if (job.status !== "QUEUED") return { queuePosition: null, estimatedStart: null };
  const before = { OR: [{ createdAt: { lt: job.createdAt } }, { createdAt: job.createdAt, id: { lt: job.id } }] };
  const [ahead, running, recent, own] = await Promise.all([
    prisma.crawlJob.count({ where: { status: "QUEUED", ...before } }),
    prisma.crawlJob.count({ where: { status: "RUNNING" } }),
    prisma.crawlJob.findMany({
      where: { status: "COMPLETED", startedAt: { not: null }, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 20,
      select: { startedAt: true, finishedAt: true },
    }),
    job.tenantId
      ? Promise.all([
          prisma.crawlJob.count({ where: { tenantId: job.tenantId, OR: [{ status: "RUNNING" }, { status: "QUEUED", ...before }] } }),
          tenantOverrides(job.tenantId),
        ]).then(([n, o]) => ({ n, limit: o.crawlConcurrencyOverride ?? TENANT_CRAWL_CONCURRENCY_DEFAULT }))
      : null,
  ]);
  const avg = recent.length
    ? Math.max(60_000, recent.reduce((n, r) => n + (r.finishedAt!.getTime() - r.startedAt!.getTime()), 0) / recent.length)
    : DEFAULT_CRAWL_MS;
  const waits = (busy: number, width: number) => (busy < width ? 0 : Math.floor((busy - width) / width) + 1);
  const waves = Math.max(waits(running + ahead, slots), own ? waits(own.n, own.limit) : 0);
  return { queuePosition: ahead + 1, estimatedStart: new Date(now.getTime() + waves * avg).toISOString() };
}

// ─── Issues (findings), cursor-paged ─────────────────────────────────────────

export const ISSUES_PAGE_DEFAULT = 100;
export const ISSUES_PAGE_MAX = 200;
const KINDS = ["issue", "warning", "opportunity"] as const;

export interface PublicIssue {
  id: string;
  ruleId: string;
  family: string | null;
  kind: string | null;
  priority: string | null;
  url: string;
  statusCode: number | null;
  foundOn: string | null;
  evidence: Record<string, unknown>;
}

export class PublicApiInputError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PublicApiInputError";
  }
}

/**
 * Findings of one crawl, oldest first, keyset-paged on the finding id.
 * Filters narrow to a set of rule ids (ruleId, family, kind combine); rows
 * from before rule ids (pre-3a) match through their legacy type.
 */
export async function publicIssues(
  crawl: { id: string; config: unknown },
  q: { ruleId?: string | null; family?: string | null; kind?: string | null; segment?: string | null; cursor?: string | null; limit?: number | null },
): Promise<{ issues: PublicIssue[]; nextCursor: string | null }> {
  if (q.ruleId && !RULE_BY_ID.has(q.ruleId)) throw new PublicApiInputError("unknown_rule");
  if (q.family && !RULES.some((r) => r.family === q.family)) throw new PublicApiInputError("unknown_family");
  if (q.kind && !(KINDS as readonly string[]).includes(q.kind)) throw new PublicApiInputError("unknown_kind");
  const limit = Math.max(1, Math.min(ISSUES_PAGE_MAX, Math.floor(q.limit ?? ISSUES_PAGE_DEFAULT) || ISSUES_PAGE_DEFAULT));
  const scope = segmentScope(new URL(`https://x.invalid/?${q.segment ? `segment=${encodeURIComponent(q.segment)}` : ""}`), crawl.config);

  let ruleFilter: Prisma.CrawlIssueWhereInput = {};
  if (q.ruleId || q.family || q.kind) {
    const ids = RULES.filter((r) => (!q.ruleId || r.id === q.ruleId) && (!q.family || r.family === q.family) && (!q.kind || r.kind === q.kind)).map(
      (r) => r.id,
    );
    const legacy = ids.flatMap(legacyTypesFor);
    ruleFilter = { OR: [{ ruleId: { in: ids } }, ...(legacy.length ? [{ ruleId: null, type: { in: legacy } }] : [])] };
  }
  const rows = await prisma.crawlIssue.findMany({
    where: { crawlJobId: crawl.id, ...ruleFilter, ...issueInSegment(scope), ...(q.cursor ? { id: { gt: q.cursor } } : {}) },
    orderBy: { id: "asc" },
    take: limit + 1,
    select: {
      id: true,
      ruleId: true,
      type: true,
      kind: true,
      priority: true,
      evidence: true,
      detail: true,
      crawlPage: { select: { url: true, statusCode: true, foundOn: true } },
    },
  });
  const page = rows.slice(0, limit);
  return {
    issues: page.map((r) => {
      const ruleId = ruleIdOf(r) ?? r.type;
      const rule = RULE_BY_ID.get(ruleId);
      return {
        id: r.id,
        ruleId,
        family: rule?.family ?? null,
        kind: r.kind ?? rule?.kind ?? null,
        priority: r.priority ?? rule?.priority ?? null,
        url: r.crawlPage.url,
        statusCode: r.crawlPage.statusCode,
        foundOn: r.crawlPage.foundOn,
        evidence: (r.evidence as Record<string, unknown> | null) ?? (r.detail ? { detail: r.detail } : {}),
      };
    }),
    nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
  };
}
