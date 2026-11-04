// src/lib/site-crawler/metrics-runner.ts
//
// Phase 4d: the post-crawl opt-ins — PageSpeed (crawl.psi) and backlink
// metrics (crawl.backlinks) on the crawl's most-linked pages. Runs as a
// "metrics" job on the site-crawl queue after the crawl COMPLETES (inlinks
// exist only after aggregation), one short tick at a time so it never holds
// a crawl slot for long:
//
//   PSI        mobile + desktop per page through the Lighthouse tool's own
//              runAudit — same 6 h cache, same hourly allowance, rows land in
//              LighthouseAudit where the 3c performance rules read them. When
//              the allowance is spent the job waits for the next free slot
//              instead of failing; the crawl shows "waiting for Lighthouse".
//   backlinks  DataForSEO backlinks/summary/live per page URL, metered through
//              seoMeteredCall (SeoApiCall row, the tenant's monthly USD cap).
//              Runs FIRST: it takes seconds, PSI may wait hours for its
//              allowance. The cap is checked before every call; once it is
//              reached the step stops and the crawl says "usd_cap".
//              ARCHIVE: there is no seodata provider-response store in this
//              repo, so responses are not archived (the SeoApiCall row and
//              the parsed numbers are what is kept).
//   rules      once a source's targets are done (or it stopped), the rules
//              requiring its capability are re-evaluated for those pages
//              (earlier findings replaced) and the summary is re-tallied.

import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { flag } from "@/lib/flags";
import { RULES, evaluateSiteRules, type JobFacts, type PageSiteFacts } from "@/lib/crawl-rules";
import { LighthouseRateLimitedError, runAudit } from "@/lib/lighthouse/service";
import { msUntilNextAudit } from "@/lib/lighthouse/usage";
import type { LighthouseAuditDto } from "@/lib/lighthouse/types";
import { readStoredConfig, type TopPages } from "./crawl-config";
import { DataforseoError } from "@/lib/dataforseo/client";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { backlinksSummaryTask, parseBacklinksSummary, type BacklinksSummaryItem } from "@/lib/dataforseo/backlinks-summary";
import { monthlyCapUsd, seoMeteredCall, spentThisMonth } from "@/lib/dataforseo/metering";
import { recountIssues } from "./aggregate";
import { metricsForPages, upsertPageMetrics } from "./metrics";
import type { BacklinkMetric, PsiMetric, PsiRunSummary } from "./metrics-shared";
import { psiFactsForUrls } from "./psi";
import { issueRows, toStoredFacts } from "./stored";

const log = logger.child({ module: "crawl-metrics" });

export const METRICS_JOB_NAME = "metrics";
/** Lighthouse runs per tick: each takes 10–30 s, so a tick stays within a few minutes. */
export const PSI_RUNS_PER_TICK = 6;
const STRATEGIES = ["mobile", "desktop"] as const;

export type MetricsTick = { done: true } | { done: false; delayMs: number };

export interface SourceState {
  status: "running" | "waiting_quota" | "done" | "stopped";
  targets: number;
  /** PSI: runs finished (ok or failed); backlinks: pages looked up. */
  completed: number;
  failed: number;
  /** Why it stopped early (backlinks: "usd_cap"). */
  stoppedReason?: string;
  updatedAt: string;
}

/** Backlink lookups per tick: live calls take a second or two. */
export const BACKLINK_PAGES_PER_TICK = 20;

export interface MetricsDeps {
  runAudit: typeof runAudit;
  msUntilNextAudit: typeof msUntilNextAudit;
  backlinksSummary: (tenantId: string, url: string) => Promise<BacklinksSummaryItem[]>;
  budget: (tenantId: string) => Promise<{ spent: number; cap: number }>;
}
const DEFAULT_DEPS: MetricsDeps = {
  runAudit,
  msUntilNextAudit,
  backlinksSummary: (tenantId, url) => seoMeteredCall<BacklinksSummaryItem[]>(tenantId, BACKLINKS.summary, backlinksSummaryTask(url, { includeSubdomains: false })),
  budget: async (tenantId) => ({ spent: await spentThisMonth(tenantId), cap: await monthlyCapUsd(tenantId) }),
};


const PAGE_SELECT = {
  id: true, url: true, depth: true, statusCode: true, redirectTarget: true, contentType: true, title: true,
  metaDescription: true, h1First: true, h2First: true, canonical: true, canonicalHeader: true, noindex: true,
  metaRobots: true, inSitemap: true, inlinkCount: true, hreflang: true, langAttr: true, relNext: true, relPrev: true,
} as const;

/** The top N pages by inlinks (ties by id), in one segment when given. PSI takes indexable HTML pages only. */
export async function targetPages(jobId: string, top: TopPages, opts: { htmlOnly: boolean }) {
  return prisma.crawlPage.findMany({
    where: {
      crawlJobId: jobId,
      ...(top.segment !== null ? { segmentIds: { has: top.segment } } : {}),
      ...(opts.htmlOnly ? { statusCode: 200, noindex: { not: true }, contentType: { contains: "html", mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ inlinkCount: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: top.pages,
    select: PAGE_SELECT,
  });
}

/** One Lighthouse audit as the join's summary. */
export function psiRunSummary(a: LighthouseAuditDto): PsiRunSummary {
  const lab = (k: string) => a.metrics.find((m) => m.key === k)?.value ?? null;
  const field = (k: string) => a.crux?.metrics.find((m) => m.key === k)?.p75 ?? null;
  return {
    performance: a.scores.performance,
    accessibility: a.scores.accessibility,
    bestPractices: a.scores.bestPractices,
    seo: a.scores.seo,
    lcpMs: lab("LCP"),
    cls: lab("CLS"),
    fieldLcpMs: field("LCP"),
    fieldCls: field("CLS"),
    fieldInpMs: field("INP"),
    fetchedAt: a.fetchedAt,
  };
}

/** Neutral site/job facts: rules re-run here require a capability and read none of them. */
const NO_SITE: PageSiteFacts = {
  duplicateTitleCount: 1, duplicateMetaCount: 1, duplicateH1Count: 1, duplicateH2Count: 1, duplicateContentCount: 1,
  nearDuplicateCount: 0, h1MatchesOtherTitleCount: 0, nofollowInlinkCount: 0, redirectLoop: null, outlinksToRedirect: 0,
  orphan: false, canonicalTarget: null,
  hreflang: { targets: 0, non200: 0, noindex: 0, notCanonical: 0, missingReturn: 0, langMismatch: 0, unlinked: 0, sample: null },
  pagination: { non200: 0, sequenceErrors: 0, sample: null },
};
const NO_JOB: JobFacts = {
  pagesCrawled: 0,
  langsSeen: 1,
  sitemap: { found: false, urlCount: 0, largestFileUrls: 0, notCrawled: 0, notCrawledSample: null, declaredInRobots: false },
};

export const PSI_RULE_IDS = RULES.filter((r) => r.requires?.includes("psi")).map((r) => r.id);
export const BACKLINK_RULE_IDS = RULES.filter((r) => r.requires?.includes("backlinks")).map((r) => r.id);

/** Replace the backlinks rules' findings on these pages, from their stored lookups. */
export async function reevaluateBacklinkRules(jobId: string, rootUrl: string, pages: Awaited<ReturnType<typeof targetPages>>): Promise<number> {
  if (pages.length === 0) return 0;
  const have = await metricsForPages(pages.map((p) => p.id));
  await prisma.crawlIssue.deleteMany({ where: { crawlPageId: { in: pages.map((p) => p.id) }, ruleId: { in: BACKLINK_RULE_IDS } } });
  const keep = new Set(BACKLINK_RULE_IDS);
  const rows = pages.flatMap((page) => {
    const b = have.get(page.id)?.backlinks as (BacklinkMetric & { error?: string }) | undefined;
    if (!b || b.error) return [];
    const found = evaluateSiteRules(toStoredFacts(page, rootUrl), { capabilities: ["backlinks"], metrics: { backlinks: b }, site: NO_SITE, job: NO_JOB, isRoot: false }).filter((f) => keep.has(f.ruleId));
    return issueRows(found, jobId).map((r) => ({ ...r, crawlPageId: page.id }));
  });
  if (rows.length) await prisma.crawlIssue.createMany({ data: rows });
  return rows.length;
}

/** Replace the "psi" rules' findings on these pages with ones from their newest runs. */
export async function reevaluatePsiRules(jobId: string, tenantId: string, rootUrl: string, pages: Awaited<ReturnType<typeof targetPages>>): Promise<number> {
  if (pages.length === 0) return 0;
  const psi = await psiFactsForUrls(tenantId, pages.map((p) => p.url));
  await prisma.crawlIssue.deleteMany({ where: { crawlPageId: { in: pages.map((p) => p.id) }, ruleId: { in: PSI_RULE_IDS } } });
  const keep = new Set(PSI_RULE_IDS);
  const rows = pages.flatMap((page) => {
    const facts = psi.get(page.url);
    if (!facts) return [];
    const found = evaluateSiteRules(toStoredFacts(page, rootUrl), { capabilities: ["psi"], psi: facts, site: NO_SITE, job: NO_JOB, isRoot: false }).filter((f) => keep.has(f.ruleId));
    return issueRows(found, jobId).map((r) => ({ ...r, crawlPageId: page.id }));
  });
  if (rows.length) await prisma.crawlIssue.createMany({ data: rows });
  return rows.length;
}

/** Read-modify-write one source's state under summary.metrics. */
export async function setSourceState(jobId: string, source: "psi" | "backlinks", state: Omit<SourceState, "updatedAt">): Promise<void> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId }, select: { summary: true } });
  const summary = (job?.summary as Record<string, unknown> | null) ?? {};
  const metrics = (summary.metrics as Record<string, unknown> | undefined) ?? {};
  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { summary: { ...summary, metrics: { ...metrics, [source]: { ...state, updatedAt: new Date().toISOString() } } } as object },
  });
}

type Job = { id: string; tenantId: string; rootUrl: string };

async function psiTick(job: Job, top: TopPages, deps: MetricsDeps): Promise<MetricsTick> {
  const pages = await targetPages(job.id, top, { htmlOnly: true });
  const have = await metricsForPages(pages.map((p) => p.id));
  const todo = pages.flatMap((p) => STRATEGIES.filter((s) => !(have.get(p.id)?.psi as PsiMetric | undefined)?.[s]).map((s) => ({ page: p, strategy: s })));
  const count = () => {
    let completed = 0;
    let failed = 0;
    for (const p of pages) {
      const d = have.get(p.id)?.psi as PsiMetric | undefined;
      for (const s of STRATEGIES) {
        const r = d?.[s];
        if (r) completed++;
        if (r && "error" in r) failed++;
      }
    }
    return { targets: pages.length, completed, failed };
  };

  if (todo.length === 0) {
    const n = await reevaluatePsiRules(job.id, job.tenantId, job.rootUrl, pages);
    await recountIssues(job.id);
    await setSourceState(job.id, "psi", { status: "done", ...count() });
    log.info({ jobId: job.id, pages: pages.length, findings: n }, "crawl PSI done");
    return { done: true };
  }

  for (const { page, strategy } of todo.slice(0, PSI_RUNS_PER_TICK)) {
    let result: PsiMetric[typeof strategy];
    try {
      result = psiRunSummary((await deps.runAudit(job.tenantId, { url: page.url, strategy })).audit);
    } catch (err) {
      if (err instanceof LighthouseRateLimitedError) {
        await setSourceState(job.id, "psi", { status: "waiting_quota", ...count() });
        return { done: false, delayMs: await deps.msUntilNextAudit(job.tenantId) };
      }
      result = { error: err instanceof Error ? err.message.slice(0, 160) : "failed" };
    }
    const data = { ...((have.get(page.id)?.psi as PsiMetric | undefined) ?? {}), [strategy]: result };
    have.set(page.id, { ...(have.get(page.id) ?? {}), psi: data });
    await upsertPageMetrics(job.id, "psi", [{ pageId: page.id, data }]);
  }
  await setSourceState(job.id, "psi", { status: "running", ...count() });
  return { done: false, delayMs: 0 };
}

async function backlinksTick(job: Job, top: TopPages, deps: MetricsDeps): Promise<MetricsTick> {
  const pages = await targetPages(job.id, top, { htmlOnly: false });
  const have = await metricsForPages(pages.map((p) => p.id));
  const todo = pages.filter((p) => !have.get(p.id)?.backlinks);
  const state = (extra: Partial<SourceState> = {}) => {
    const done = pages.filter((p) => have.get(p.id)?.backlinks);
    const failed = done.filter((p) => (have.get(p.id)?.backlinks as { error?: string }).error).length;
    return { status: "running" as const, targets: pages.length, completed: done.length, failed, ...extra };
  };
  const finish = async (s: Pick<SourceState, "status" | "stoppedReason">) => {
    await reevaluateBacklinkRules(job.id, job.rootUrl, pages.filter((p) => have.get(p.id)?.backlinks));
    await recountIssues(job.id);
    await setSourceState(job.id, "backlinks", state(s));
    return { done: true } as const;
  };
  if (todo.length === 0) return finish({ status: "done" });

  for (const page of todo.slice(0, BACKLINK_PAGES_PER_TICK)) {
    const { spent, cap } = await deps.budget(job.tenantId);
    if (spent >= cap) return finish({ status: "stopped", stoppedReason: "usd_cap" });
    let data: BacklinkMetric | { error: string };
    try {
      const s = parseBacklinksSummary(await deps.backlinksSummary(job.tenantId, page.url));
      data = { referringDomains: s.referringDomains, backlinks: s.backlinks, rank: s.rank };
    } catch (err) {
      if (err instanceof DataforseoError && err.code === "RATE_LIMITED") {
        const b = await deps.budget(job.tenantId);
        if (b.spent >= b.cap) return finish({ status: "stopped", stoppedReason: "usd_cap" });
        await setSourceState(job.id, "backlinks", state());
        return { done: false, delayMs: 60_000 };
      }
      data = { error: err instanceof Error ? err.message.slice(0, 160) : "failed" };
    }
    have.set(page.id, { ...(have.get(page.id) ?? {}), backlinks: data });
    await upsertPageMetrics(job.id, "backlinks", [{ pageId: page.id, data }]);
  }
  await setSourceState(job.id, "backlinks", state());
  return { done: false, delayMs: 0 };
}

/** One tick of a crawl's post-crawl metrics. Done when every opted-in source is. */
export async function runCrawlMetrics(jobId: string, overrides: Partial<MetricsDeps> = {}): Promise<MetricsTick> {
  const deps: MetricsDeps = { ...DEFAULT_DEPS, ...overrides };
  const job = await prisma.crawlJob.findFirst({
    where: { id: jobId, status: "COMPLETED", dataPurgedAt: null },
    select: { id: true, tenantId: true, rootUrl: true, config: true, summary: true },
  });
  if (!job) return { done: true };
  const add = readStoredConfig(job.config)?.addData;
  const states = ((job.summary as { metrics?: Record<string, SourceState> } | null)?.metrics ?? {}) as Record<string, SourceState | undefined>;
  const settled = (s: SourceState | undefined) => s?.status === "done" || s?.status === "stopped";
  if (add?.backlinks && flag("crawl.backlinks") && !settled(states.backlinks)) {
    const tick = await backlinksTick(job, add.backlinks, deps);
    if (!tick.done) return tick;
  }
  if (add?.psi && flag("crawl.psi") && !settled(states.psi)) {
    const tick = await psiTick(job, add.psi, deps);
    if (!tick.done) return tick;
  }
  return { done: true };
}

/** Whether a finished crawl has post-crawl work to queue. */
export function needsMetrics(config: unknown): boolean {
  const add = readStoredConfig(config)?.addData;
  return Boolean((add?.psi && flag("crawl.psi")) || (add?.backlinks && flag("crawl.backlinks")));
}
