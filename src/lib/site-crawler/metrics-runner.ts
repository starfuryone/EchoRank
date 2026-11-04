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
//   ai         Phase 4e: up to 3 prompts per page on the top N pages' visible
//              text (re-fetched with the crawl's own credentials, truncated to
//              6,000 chars). Claude on the house key, metered on the Marketing
//              Studio token budget (input + output tokens, checked before
//              every call: a call that would cross it is not made, the step
//              stops with "token_budget"); OpenAI / Gemini on the tenant's key.
//              Two pages at a time, one retry per call, outputs (<= 1 KB) in
//              crawl_extractions kind ai. Prompts and outputs are never logged.
//   semantic   Phase 4g: the top N pages' visible text embedded with OpenAI
//              text-embedding-3-small (256 dims) on the tenant's own key, 100
//              pages a tick, 50 per call; the vector in crawl_pages.embedding
//              (an empty one = tried, nothing to embed). Once every target is
//              tried, nearest neighbours and centroid distance are computed in
//              memory over typed arrays and content.semantic_duplicate /
//              content.off_topic run on those pages.
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
import { DEFAULT_CRAWL_CONFIG, readStoredConfig, type TopPages } from "./crawl-config";
import { DataforseoError } from "@/lib/dataforseo/client";
import { BACKLINKS } from "@/lib/dataforseo/endpoints";
import { backlinksSummaryTask, parseBacklinksSummary, type BacklinksSummaryItem } from "@/lib/dataforseo/backlinks-summary";
import { monthlyCapUsd, seoMeteredCall, spentThisMonth } from "@/lib/dataforseo/metering";
import { recountIssues } from "./aggregate";
import { metricsForPages, upsertPageMetrics } from "./metrics";
import type { BacklinkMetric, PsiMetric, PsiRunSummary } from "./metrics-shared";
import { psiFactsForUrls } from "./psi";
import { issueRows, toStoredFacts } from "./stored";
import { openCrawlConfig } from "./crawl-config-secrets";
import { crawlSettings } from "./crawl-settings";
import { RateLimiter, fetchPage, isHtmlContentType } from "./fetch";
import { visibleText } from "./facts";
import { isFetchableUrl } from "./url";
import { AI_LIMITS, type AiConfig, type AiProvider } from "./ai-shared";
import { claudeCostUsd, parseGrammar, parseSuggestion, runPrompt } from "./ai-prompts";
import { openAiKey } from "./ai-keys";
import { EMBEDDING_DIMS, EMBEDDING_TEXT_CHARS, EmbeddingError, analyse, embedBatch, embeddingCostUsd, fromBytes, toBytes } from "./semantic";
import { MARKETING_MODEL } from "@/lib/marketing-templates";
import { marketingTokenLimit, marketingTokensUsed, recordMarketingTokens } from "@/lib/marketing/quota";
import type { AiFacts } from "@/lib/crawl-rules";
import type { PlanType } from "@/generated/prisma";

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
  /** Why it stopped early (backlinks: "usd_cap"; ai: "token_budget", "key_missing"). */
  stoppedReason?: string;
  /** semantic: pages with a vector. */
  embedded?: number;
  /** ai: tokens charged (Claude: to the Marketing Studio budget) and their list cost. */
  tokens?: number;
  costUsd?: number;
  updatedAt: string;
}

/** Backlink lookups per tick: live calls take a second or two. */
export const BACKLINK_PAGES_PER_TICK = 20;

export interface MetricsDeps {
  runAudit: typeof runAudit;
  msUntilNextAudit: typeof msUntilNextAudit;
  backlinksSummary: (tenantId: string, url: string) => Promise<BacklinksSummaryItem[]>;
  budget: (tenantId: string) => Promise<{ spent: number; cap: number }>;
  /** Phase 4e AI prompts. */
  aiCall: typeof runPrompt;
  aiFetchHtml: (url: string, settings: ReturnType<typeof crawlSettings>) => Promise<string | null>;
  aiKey: (tenantId: string, provider: AiProvider) => Promise<string | null>;
  tokenBudget: (tenantId: string, plan: PlanType) => Promise<{ used: number; limit: number | null }>;
  recordTokens: (tenantId: string, tokens: number) => Promise<void>;
  /** Phase 4g semantic duplicates. */
  embed: typeof embedBatch;
}
const DEFAULT_DEPS: MetricsDeps = {
  runAudit,
  msUntilNextAudit,
  backlinksSummary: (tenantId, url) => seoMeteredCall<BacklinksSummaryItem[]>(tenantId, BACKLINKS.summary, backlinksSummaryTask(url, { includeSubdomains: false })),
  budget: async (tenantId) => ({ spent: await spentThisMonth(tenantId), cap: await monthlyCapUsd(tenantId) }),
  aiCall: runPrompt,
  aiFetchHtml: async (url, settings) => {
    if (!isFetchableUrl(url)) return null;
    const res = await fetchPage(url, settings.fetchOpts);
    return res.statusCode === 200 && isHtmlContentType(res.contentType) ? res.html : null;
  },
  aiKey: async (tenantId, provider) => (provider === "claude" ? process.env.ANTHROPIC_API_KEY?.trim() || null : openAiKey(tenantId, provider)),
  tokenBudget: async (tenantId, plan) => ({ used: await marketingTokensUsed(tenantId), limit: marketingTokenLimit(plan) }),
  recordTokens: recordMarketingTokens,
  embed: embedBatch,
};

export const SEMANTIC_PAGES_PER_TICK = 100;
const EMBED_BATCH = 50;

/** AI pages per tick, and how many run at once. */
export const AI_PAGES_PER_TICK = 10;
export const AI_CONCURRENCY = 2;


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
export async function setSourceState(jobId: string, source: "psi" | "backlinks" | "ai" | "semantic", state: Omit<SourceState, "updatedAt">): Promise<void> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId }, select: { summary: true } });
  const summary = (job?.summary as Record<string, unknown> | null) ?? {};
  const metrics = (summary.metrics as Record<string, unknown> | undefined) ?? {};
  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { summary: { ...summary, metrics: { ...metrics, [source]: { ...state, updatedAt: new Date().toISOString() } } } as object },
  });
}

type Job = { id: string; tenantId: string; rootUrl: string; config?: unknown; summary?: unknown; tenant?: { planType: PlanType } | null };

export const AI_RULE_IDS = RULES.filter((r) => r.requires?.includes("ai")).map((r) => r.id);

/** What the title and grammar presets answered on one page (error values ignored). */
export function aiFactsOf(ai: AiConfig, values: Map<number, string>): AiFacts {
  const of = (preset: string) => {
    const i = ai.prompts.findIndex((p) => p.preset === preset);
    const v = i < 0 ? undefined : values.get(i);
    return v === undefined || v.startsWith("error: ") ? null : v;
  };
  const title = of("title");
  const grammar = of("grammar");
  return { suggestedTitle: title ? parseSuggestion(title).title : null, grammarIssues: grammar === null ? null : parseGrammar(grammar) };
}

/** Replace the ai rules' findings on these pages, from their stored answers. */
export async function reevaluateAiRules(jobId: string, rootUrl: string, ai: AiConfig, pages: Awaited<ReturnType<typeof targetPages>>): Promise<number> {
  if (pages.length === 0) return 0;
  const rows = await prisma.crawlExtraction.findMany({ where: { crawlJobId: jobId, kind: "ai", pageId: { in: pages.map((p) => p.id) } }, select: { pageId: true, extractorIndex: true, values: true } });
  const byPage = new Map<string, Map<number, string>>();
  for (const r of rows) byPage.set(r.pageId, (byPage.get(r.pageId) ?? new Map()).set(r.extractorIndex, r.values[0] ?? ""));
  await prisma.crawlIssue.deleteMany({ where: { crawlPageId: { in: pages.map((p) => p.id) }, ruleId: { in: AI_RULE_IDS } } });
  const keep = new Set(AI_RULE_IDS);
  const issues = pages.flatMap((page) => {
    const values = byPage.get(page.id);
    if (!values) return [];
    const found = evaluateSiteRules(toStoredFacts(page, rootUrl), { capabilities: ["ai"], metrics: { ai: aiFactsOf(ai, values) }, site: NO_SITE, job: NO_JOB, isRoot: false }).filter((f) => keep.has(f.ruleId));
    return issueRows(found, jobId).map((r) => ({ ...r, crawlPageId: page.id }));
  });
  if (issues.length) await prisma.crawlIssue.createMany({ data: issues });
  return issues.length;
}

export const SEMANTIC_RULE_IDS = RULES.filter((r) => r.requires?.includes("semantic")).map((r) => r.id);

/** Compare the embedded targets and replace the semantic rules' findings on them. */
export async function reevaluateSemanticRules(jobId: string, rootUrl: string, pages: Awaited<ReturnType<typeof targetPages>>): Promise<{ findings: number; embedded: number }> {
  if (pages.length === 0) return { findings: 0, embedded: 0 };
  const rows = await prisma.crawlPage.findMany({ where: { id: { in: pages.map((p) => p.id) } }, select: { id: true, embedding: true } });
  const withVec = rows.flatMap((r) => {
    const v = r.embedding ? fromBytes(r.embedding) : null;
    return v ? [{ id: r.id, v }] : [];
  });
  await prisma.crawlIssue.deleteMany({ where: { crawlPageId: { in: pages.map((p) => p.id) }, ruleId: { in: SEMANTIC_RULE_IDS } } });
  if (withVec.length < 2) return { findings: 0, embedded: withVec.length };
  const flat = new Float32Array(withVec.length * EMBEDDING_DIMS);
  withVec.forEach((w, i) => flat.set(w.v, i * EMBEDDING_DIMS));
  const found = analyse(flat, withVec.length);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const keep = new Set(SEMANTIC_RULE_IDS);
  const issues = withVec.flatMap((w, i) => {
    const page = byId.get(w.id)!;
    const f = found[i]!;
    const semantic = { nearestUrl: f.nearest >= 0 ? byId.get(withVec[f.nearest]!.id)!.url : null, nearestScore: f.nearest >= 0 ? f.nearestScore : null, distance: f.distance, offTopic: f.offTopic };
    const hits = evaluateSiteRules(toStoredFacts(page, rootUrl), { capabilities: ["semantic"], metrics: { semantic }, site: NO_SITE, job: NO_JOB, isRoot: false }).filter((x) => keep.has(x.ruleId));
    return issueRows(hits, jobId).map((r) => ({ ...r, crawlPageId: page.id }));
  });
  if (issues.length) await prisma.crawlIssue.createMany({ data: issues });
  return { findings: issues.length, embedded: withVec.length };
}

async function semanticTick(job: Job, top: TopPages, deps: MetricsDeps): Promise<MetricsTick> {
  const pages = await targetPages(job.id, top, { htmlOnly: true });
  const tried = await prisma.crawlPage.findMany({ where: { id: { in: pages.map((p) => p.id) }, embedding: { not: null } }, select: { id: true } });
  const done = new Set(tried.map((t) => t.id));
  const prev = ((job.summary as { metrics?: { semantic?: SourceState } } | null)?.metrics?.semantic) ?? null;
  let tokens = prev?.tokens ?? 0;
  const state = (extra: Partial<SourceState> = {}) => ({
    status: "running" as const,
    targets: pages.length,
    completed: done.size,
    failed: 0,
    tokens,
    costUsd: Math.round(embeddingCostUsd(tokens) * 1e6) / 1e6,
    ...extra,
  });
  const finish = async (s: Pick<SourceState, "status" | "stoppedReason">) => {
    const r = await reevaluateSemanticRules(job.id, job.rootUrl, pages);
    await recountIssues(job.id);
    await setSourceState(job.id, "semantic", { ...state(s), embedded: r.embedded, failed: done.size - r.embedded });
    log.info({ jobId: job.id, embedded: r.embedded, findings: r.findings }, "crawl semantic done");
    return { done: true } as const;
  };
  const todo = pages.filter((p) => !done.has(p.id)).slice(0, SEMANTIC_PAGES_PER_TICK);
  if (todo.length === 0) return finish({ status: "done" });
  const key = await deps.aiKey(job.tenantId, "openai");
  if (!key) return finish({ status: "stopped", stoppedReason: "key_missing" });

  const stored0 = readStoredConfig(job.config);
  const settings = crawlSettings(stored0 ? openCrawlConfig(stored0) : { ...DEFAULT_CRAWL_CONFIG }, job.rootUrl);
  const limiter = new RateLimiter(stored0?.speed ?? 2, 0);
  const texts: { id: string; text: string }[] = [];
  const mark = async (id: string, bytes: Buffer) => {
    await prisma.crawlPage.update({ where: { id }, data: { embedding: new Uint8Array(bytes) } });
    done.add(id);
  };
  for (const page of todo) {
    await limiter.acquire();
    const html = await deps.aiFetchHtml(page.url, settings).catch(() => null);
    const text = html ? visibleText(html, page.url, job.rootUrl).slice(0, EMBEDDING_TEXT_CHARS).trim() : "";
    if (text) texts.push({ id: page.id, text });
    else await mark(page.id, Buffer.alloc(0));
  }
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    try {
      const r = await deps.embed(key, batch.map((b) => b.text));
      tokens += r.tokens;
      for (const [j, b] of batch.entries()) await mark(b.id, toBytes(r.vectors[j]!));
    } catch (err) {
      const status = err instanceof EmbeddingError ? err.status : null;
      if (status === 401 || status === 403) return finish({ status: "stopped", stoppedReason: "key_invalid" });
      if (status === null || status === 429 || status >= 500) {
        await setSourceState(job.id, "semantic", state());
        return { done: false, delayMs: 60_000 };
      }
      for (const b of batch) await mark(b.id, Buffer.alloc(0));
    }
  }
  await setSourceState(job.id, "semantic", state());
  return { done: false, delayMs: 0 };
}

async function aiTick(job: Job, ai: AiConfig, deps: MetricsDeps): Promise<MetricsTick> {
  const pages = await targetPages(job.id, ai.top, { htmlOnly: true });
  const stored = await prisma.crawlExtraction.findMany({ where: { crawlJobId: job.id, kind: "ai", pageId: { in: pages.map((p) => p.id) } }, select: { pageId: true, extractorIndex: true, values: true } });
  const have = new Map<string, Map<number, string>>();
  for (const r of stored) have.set(r.pageId, (have.get(r.pageId) ?? new Map()).set(r.extractorIndex, r.values[0] ?? ""));
  const prev = ((job.summary as { metrics?: { ai?: SourceState } } | null)?.metrics?.ai) ?? null;
  let tokens = prev?.tokens ?? 0;
  let costUsd = prev?.costUsd ?? 0;
  const state = (extra: Partial<SourceState> = {}) => {
    const done = pages.filter((p) => (have.get(p.id)?.size ?? 0) >= ai.prompts.length);
    const failed = done.filter((p) => [...have.get(p.id)!.values()].some((v) => v.startsWith("error: "))).length;
    return { status: "running" as const, targets: pages.length, completed: done.length, failed, tokens, costUsd: Math.round(costUsd * 1e6) / 1e6, ...extra };
  };
  const finish = async (s: Pick<SourceState, "status" | "stoppedReason">) => {
    await reevaluateAiRules(job.id, job.rootUrl, ai, pages.filter((p) => have.has(p.id)));
    await recountIssues(job.id);
    await setSourceState(job.id, "ai", state(s));
    return { done: true } as const;
  };
  const todo = pages.filter((p) => (have.get(p.id)?.size ?? 0) < ai.prompts.length);
  if (todo.length === 0) return finish({ status: "done" });

  const key = await deps.aiKey(job.tenantId, ai.provider);
  if (!key) return finish({ status: "stopped", stoppedReason: "key_missing" });
  const plan = job.tenant?.planType ?? "STARTER";
  const stored0 = readStoredConfig(job.config);
  // The crawl's own credentials and user agent (decrypted in memory only), so a staging site answers as it did.
  const settings = crawlSettings(stored0 ? openCrawlConfig(stored0) : { ...DEFAULT_CRAWL_CONFIG }, job.rootUrl);
  const limiter = new RateLimiter(stored0?.speed ?? 2, 0);
  let budgetHit = false;

  const save = async (pageId: string, index: number, value: string) => {
    await prisma.crawlExtraction.createMany({ data: [{ crawlJobId: job.id, pageId, kind: "ai", extractorIndex: index, values: [value] }], skipDuplicates: true });
    have.set(pageId, (have.get(pageId) ?? new Map()).set(index, value));
  };
  const onePage = async (page: (typeof pages)[number]) => {
    await limiter.acquire();
    const html = await deps.aiFetchHtml(page.url, settings).catch(() => null);
    const text = html ? visibleText(html, page.url, job.rootUrl).slice(0, AI_LIMITS.textChars) : "";
    for (const [index, prompt] of ai.prompts.entries()) {
      if (budgetHit) return;
      if (have.get(page.id)?.has(index)) continue;
      if (!text) {
        await save(page.id, index, html ? "error: no visible text" : "error: page could not be fetched");
        continue;
      }
      if (ai.provider === "claude") {
        const b = await deps.tokenBudget(job.tenantId, plan);
        if (b.limit !== null && b.used + AI_LIMITS.tokensPerCall > b.limit) {
          budgetHit = true;
          return;
        }
      }
      try {
        const r = await deps.aiCall(ai.provider, key, prompt, { url: page.url, text });
        const spent = r.inputTokens + r.outputTokens;
        tokens += spent;
        if (ai.provider === "claude") {
          costUsd += claudeCostUsd(r.inputTokens, r.outputTokens);
          await deps.recordTokens(job.tenantId, spent);
          await prisma.aiApiCall
            .create({ data: { tenantId: job.tenantId, categoryId: "site_crawler_ai", model: MARKETING_MODEL, inputTokens: r.inputTokens, outputTokens: r.outputTokens } })
            .catch(() => undefined);
        }
        await save(page.id, index, r.text || "(empty)");
      } catch (err) {
        await save(page.id, index, `error: ${err instanceof Error ? err.message.slice(0, 120) : "failed"}`);
      }
    }
  };

  const batch = todo.slice(0, AI_PAGES_PER_TICK);
  for (let i = 0; i < batch.length; i += AI_CONCURRENCY) {
    await Promise.all(batch.slice(i, i + AI_CONCURRENCY).map(onePage));
    if (budgetHit) return finish({ status: "stopped", stoppedReason: "token_budget" });
  }
  log.info({ jobId: job.id, pages: batch.length, tokens }, "crawl AI tick");
  await setSourceState(job.id, "ai", state());
  return { done: false, delayMs: 0 };
}

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
    select: { id: true, tenantId: true, rootUrl: true, config: true, summary: true, tenant: { select: { planType: true } } },
  });
  if (!job) return { done: true };
  const add = readStoredConfig(job.config)?.addData;
  const ai = readStoredConfig(job.config)?.ai;
  const states = ((job.summary as { metrics?: Record<string, SourceState> } | null)?.metrics ?? {}) as Record<string, SourceState | undefined>;
  const settled = (s: SourceState | undefined) => s?.status === "done" || s?.status === "stopped";
  if (add?.backlinks && flag("crawl.backlinks") && !settled(states.backlinks)) {
    const tick = await backlinksTick(job, add.backlinks, deps);
    if (!tick.done) return tick;
  }
  const semantic = readStoredConfig(job.config)?.semantic;
  if (semantic && flag("crawl.semantic") && !settled(states.semantic)) {
    const tick = await semanticTick(job, semantic, deps);
    if (!tick.done) return tick;
  }
  if (ai && flag("crawl.ai") && !settled(states.ai)) {
    const tick = await aiTick(job, ai, deps);
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
  const stored = readStoredConfig(config);
  const add = stored?.addData;
  return Boolean((add?.psi && flag("crawl.psi")) || (add?.backlinks && flag("crawl.backlinks")) || (stored?.ai && flag("crawl.ai")) || (stored?.semantic && flag("crawl.semantic")));
}
