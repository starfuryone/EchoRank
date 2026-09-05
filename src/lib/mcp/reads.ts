// src/lib/mcp/reads.ts
//
// The real data behind every MCP tool: one function per capability, each
// tenant-scoped, each returning the exact payload its output schema declares.
//
// ── WHY THIS IS A SEPARATE MODULE FROM THE ROUTE ───────────────────────────
// The route's job is auth. This module's job is data. Splitting them is what
// lets the tenant-isolation tests exercise these functions directly with two
// tenant ids and no HTTP, and what keeps the route at the twenty lines it
// should be.
//
// ── TENANT SCOPING IS NOT OPTIONAL ─────────────────────────────────────────
// Every query here filters on tenantId, and every lookup that takes a caller-
// supplied id uses `findFirst({ where: { id, tenantId } })` — never
// `findUnique({ where: { id } })`. CLAUDE.md's rule, and the reason is sharper
// on this surface than anywhere else: an API key is a long-lived bearer token
// handed to a third-party agent, so a missing tenant filter is not a bug a
// signed-in user might stumble into, it is a cross-workspace read available to
// anyone holding any key.
//
// ── SPEND ──────────────────────────────────────────────────────────────────
// Exactly one function here spends: startSerpCheck, through the SERP
// Checker's own service, which carries the cache probe, the pooled search
// quota, the tool's monthly limit and the USD cap. Nothing is reimplemented —
// this module supplies a tenant id and a keyword and lets the existing gates
// decide. Every other read is over rows the tenant already paid for.
//
// ── RELATIONSHIP TO THE PRO ASSISTANT'S TOOL TABLE ─────────────────────────
// src/lib/assistant/pro/tools.ts asks some of the same questions of the same
// tables. The shapes are deliberately NOT shared: that surface returns prose
// `note` fields written to steer a language model mid-answer, and caches every
// result behind a TTL keyed to a conversation. This one returns rows for a
// protocol client. Where the underlying QUERY is subtle — Search Console's
// `page: ""` aggregate row, a null rank position — the reasoning is repeated
// in both places rather than referenced, because getting it wrong in one is
// silent.

import "server-only";

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plan-config";
import { seoQuotaUsage } from "@/lib/seo-quota";
import { monthlyCapUsd, spentThisMonth } from "@/lib/dataforseo/metering";
import {
  analysisAllowanceFor,
} from "@/lib/keyword-opportunity/entitlement";
import { analysesUsedThisMonth } from "@/lib/keyword-opportunity/store";
import { creditBalance } from "@/lib/keyword-opportunity/credits";
import { readAnalysis } from "@/lib/keyword-opportunity/read";
import {
  DEFAULT_DEVICE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
} from "@/lib/serp/options";
import { submitSerpCheck, toSerpCheckDto } from "@/lib/serp/service";
import type { SerpDevice } from "@/lib/serp/types";
import {
  getProjectDetail,
  listProjects,
  updateProject,
} from "@/lib/rank-tracker/service";
import { trackedKeywordCount } from "@/lib/rank-tracker/quota";
import { trackedKeywordLimit as rankTrackedKeywordLimit } from "@/lib/rank-tracker/options";
import type { RankDevice, RankFrequency } from "@/lib/rank-tracker/options";
import { toAnalysisDto as toBacklinksDto } from "@/lib/backlinks/service";
import { toAnalysisDto as toSiteExplorerDto } from "@/lib/site-explorer/service";
import { readLatestAiCitations } from "@/lib/ai-citations/service";
import { aiCitationsEnabled } from "@/lib/ai-citations/options";
import { readResearchLog } from "@/lib/research-log/store";
import {
  RESEARCH_REUSE_WINDOW_DAYS,
  type ResearchFeature,
} from "@/lib/research-log/types";

// ─── Shared helpers ──────────────────────────────────────────────────────────

export interface McpTenant {
  id: string;
  name: string;
  plan: PlanType;
}

/** The tenant behind an API key. Throws rather than returning null: every tool
 *  needs it, and "tenant not found" is a broken key, not an empty result. */
export async function loadMcpTenant(tenantId: string): Promise<McpTenant> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!row) throw new Error("Workspace not found for this API key.");
  return { id: row.id, name: row.name, plan: row.planType };
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function hoursSince(then: Date, now: Date): number {
  return Math.max(0, (now.getTime() - then.getTime()) / 3_600_000);
}

/** Clip untrusted text — anchors, page titles, search queries — before it goes
 *  into a result an agent will read as if we wrote it. */
function clip(value: string | null | undefined, max: number): string {
  if (typeof value !== "string") return "";
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Bounded row count with a per-tool default. Zod already bounded the range. */
function limitOf(args: Record<string, unknown>, fallback: number): number {
  const raw = args.limit;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : fallback;
}

/** Rows of an array-shaped section of a stored JSON column. */
function sectionItems(section: unknown): Record<string, unknown>[] {
  if (typeof section !== "object" || section === null) return [];
  const items = (section as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

// ─── whoami ──────────────────────────────────────────────────────────────────

/**
 * Every allowance that bounds the other tools, read from the code that
 * enforces them.
 *
 * NOT ONE NUMBER IS COMPUTED HERE. `seoQuotaUsage` is what the tool pages
 * render, `spentThisMonth`/`monthlyCapUsd` are what the metered call checks
 * before it fetches, `analysesUsedThisMonth` is what the Keyword Opportunity
 * Finder's entitlement reads. An agent told "3 searches left" by this tool and
 * then refused by the real gate would be worse than not being told at all, and
 * a second implementation of "how many are left" is exactly how that happens.
 */
export async function whoami(tenant: McpTenant, now = new Date()) {
  const [searches, kofUsed, credits, tracked, spent, cap] = await Promise.all([
    seoQuotaUsage(tenant.id, tenant.plan, now),
    analysesUsedThisMonth(tenant.id, now),
    creditBalance(tenant.id),
    trackedKeywordCount(tenant.id),
    spentThisMonth(tenant.id),
    monthlyCapUsd(tenant.id),
  ]);

  const kofTotal = analysisAllowanceFor(tenant.plan);

  return {
    workspace: { name: tenant.name, plan: tenant.plan },
    seoSearches: {
      used: searches.used,
      limit: searches.limit,
      remaining: searches.remaining,
      unlimited: searches.unlimited,
      resetsAt: searches.resetsAt,
    },
    keywordOpportunity: {
      allowanceTotal: kofTotal,
      allowanceUsed: kofUsed,
      allowanceRemaining: kofTotal === null ? null : Math.max(0, kofTotal - kofUsed),
      credits,
    },
    trackedKeywords: {
      used: tracked,
      limit: rankTrackedKeywordLimit(tenant.plan),
    },
    dataforseoSpend: {
      monthUsd: Number(spent.toFixed(6)),
      capUsd: cap,
      remainingUsd: Number(Math.max(0, cap - spent).toFixed(6)),
    },
    note:
      planConfig(tenant.plan).seoSearchesPerMonth === 0
        ? "This plan includes no pooled SEO searches. Read tools still work on stored results."
        : undefined,
  };
}

// ─── SERP Checker ────────────────────────────────────────────────────────────

export async function getSerpCheck(tenant: McpTenant, args: Record<string, unknown>) {
  const id = typeof args.id === "string" ? args.id : undefined;

  // findFirst with BOTH ids. A bare findUnique on the id would hand any key
  // holder any workspace's SERP check.
  const row = id
    ? await prisma.serpCheck.findFirst({ where: { id, tenantId: tenant.id } })
    : await prisma.serpCheck.findFirst({
        where: {
          tenantId: tenant.id,
          ...(typeof args.keyword === "string" ? { keyword: args.keyword } : {}),
          ...(typeof args.locationCode === "number"
            ? { locationCode: args.locationCode }
            : {}),
          ...(typeof args.languageCode === "string"
            ? { languageCode: args.languageCode }
            : {}),
          ...(typeof args.device === "string" ? { device: args.device } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

  if (!row) {
    return {
      found: false,
      check: null,
      note: id
        ? "No SERP check with that id belongs to this workspace."
        : "No stored SERP check matches. Run start_serp_check to queue one.",
    };
  }

  const dto = toSerpCheckDto(row);
  return {
    found: true,
    check: {
      id: dto.id,
      keyword: dto.keyword,
      locationCode: dto.locationCode,
      languageCode: dto.languageCode,
      device: dto.device,
      status: dto.status,
      costUsd: dto.costUsd,
      itemCount: dto.itemCount,
      serpFeatures: dto.serpFeatures,
      createdAt: dto.createdAt,
      completedAt: dto.completedAt,
      results: dto.results,
    },
    note:
      dto.status === "queued"
        ? "Still with the provider. The standard queue usually delivers in a few minutes; poll this tool again with the same id."
        : dto.status === "failed"
          ? (dto.error ?? "The provider could not complete this check.")
          : undefined,
  };
}

/**
 * The one spending tool on this surface.
 *
 * Every gate lives in submitSerpCheck: the 24h cache probe (free replay), the
 * pooled monthly search quota, the SERP Checker's own monthly limit, and the
 * USD cap inside the metered call. Nothing is re-checked here — a second copy
 * of a quota rule is a second thing to get wrong, and the denials it throws
 * already carry messages written for a person.
 */
export async function startSerpCheck(tenant: McpTenant, args: Record<string, unknown>) {
  const { check, cached } = await submitSerpCheck(tenant.id, tenant.plan, {
    keyword: args.keyword as string,
    locationCode:
      typeof args.locationCode === "number" ? args.locationCode : DEFAULT_LOCATION_CODE,
    languageCode:
      typeof args.languageCode === "string" ? args.languageCode : DEFAULT_LANGUAGE_CODE,
    device: (typeof args.device === "string" ? args.device : DEFAULT_DEVICE) as SerpDevice,
  });

  return {
    id: check.id,
    keyword: check.keyword,
    status: check.status,
    cached,
    note: cached
      ? "An identical check from the last 24 hours was replayed. Nothing was spent; read it with get_serp_check."
      : "Queued. The provider's standard queue usually delivers in a few minutes — poll get_serp_check with this id.",
  };
}

// ─── Rank Tracker ────────────────────────────────────────────────────────────

export async function getRankTracker(tenant: McpTenant, args: Record<string, unknown>) {
  const limit = limitOf(args, 100);
  const projectId = typeof args.projectId === "string" ? args.projectId : undefined;

  if (!projectId) {
    const projects = await listProjects(tenant.id);
    return {
      projects,
      project: null,
      keywords: [],
      note: projects.length
        ? undefined
        : "No rank-tracking projects on this workspace. Create one on the Rank Tracker page.",
    };
  }

  // getProjectDetail is already tenant-scoped and throws
  // RankProjectNotFoundError, which the handler surfaces as a tool error.
  const detail = await getProjectDetail(tenant.id, projectId);
  const { keywords, chart: _chart, totalCostUsd: _cost, ...project } = detail;
  void _chart;
  void _cost;

  return {
    projects: [project],
    project,
    keywords: keywords.slice(0, limit).map((k) => ({
      keyword: k.keyword,
      // null = not in the top 100. A real answer; never coerced to 0.
      position: k.position,
      url: k.url,
      deltaPrevious: k.deltaPrevious,
      delta30d: k.delta30d,
      pending: k.pending,
    })),
    note:
      keywords.length > limit
        ? `Showing ${limit} of ${keywords.length} keywords. Raise \`limit\` for more.`
        : undefined,
  };
}

/**
 * Add or remove tracked keywords by editing the project's set.
 *
 * WHY IT GOES THROUGH updateProject RATHER THAN prisma DIRECTLY. That function
 * carries the plan lock, the frequency check and the tracked-keyword cap (with
 * `excludeProjectId`, so the project's own keywords are not counted twice), and
 * it preserves the id — and therefore the whole position history — of every
 * keyword that survives the edit. A direct `createMany`/`deleteMany` here would
 * skip all four, and the fourth is silent: the history would simply be gone.
 */
async function editRankKeywords(
  tenant: McpTenant,
  args: Record<string, unknown>,
  mode: "add" | "remove",
) {
  const projectId = args.projectId as string;
  const supplied = args.keywords as string[];

  const existing = await prisma.rankProject.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      domain: true,
      locationCode: true,
      languageCode: true,
      device: true,
      frequency: true,
      keywords: { select: { keyword: true } },
    },
  });
  if (!existing) throw new Error("No rank-tracking project with that id in this workspace.");

  const current = new Set(existing.keywords.map((k) => k.keyword));
  const changed = supplied.filter((k) => (mode === "add" ? !current.has(k) : current.has(k)));
  const ignored = supplied.filter((k) => !changed.includes(k));

  const next =
    mode === "add"
      ? [...current, ...changed]
      : [...current].filter((k) => !changed.includes(k));

  if (mode === "remove" && next.length === 0) {
    throw new Error(
      "Removing these would leave the project with no keywords. Delete the project on the Rank Tracker page instead.",
    );
  }

  if (changed.length > 0) {
    await updateProject(tenant.id, tenant.plan, projectId, {
      name: existing.name,
      domain: existing.domain,
      keywords: next,
      locationCode: existing.locationCode,
      languageCode: existing.languageCode,
      device: existing.device as RankDevice,
      frequency: existing.frequency as RankFrequency,
    });
  }

  const tracked = await trackedKeywordCount(tenant.id);
  return {
    projectId,
    changed,
    ignored,
    keywordCount: next.length,
    trackedKeywords: tracked,
    trackedKeywordLimit: rankTrackedKeywordLimit(tenant.plan),
    note:
      changed.length === 0
        ? mode === "add"
          ? "Every keyword supplied was already tracked in this project. Nothing changed."
          : "None of the keywords supplied were tracked in this project. Nothing changed."
        : mode === "remove"
          ? "Position history for the removed keywords was deleted with them."
          : undefined,
  };
}

export function addRankTrackingKeywords(tenant: McpTenant, args: Record<string, unknown>) {
  return editRankKeywords(tenant, args, "add");
}

export function removeRankTrackingKeywords(tenant: McpTenant, args: Record<string, unknown>) {
  return editRankKeywords(tenant, args, "remove");
}

// ─── Stored analyses (read-only) ─────────────────────────────────────────────

export async function getBacklinksOverview(
  tenant: McpTenant,
  args: Record<string, unknown>,
  now = new Date(),
) {
  const target = typeof args.target === "string" ? args.target.trim() : undefined;
  const row = await prisma.backlinksAnalysis.findFirst({
    where: { tenantId: tenant.id, ...(target ? { target } : {}) },
    orderBy: { createdAt: "desc" },
  });

  if (!row) {
    return {
      found: false,
      analysis: null,
      referringDomains: [],
      anchors: [],
      pages: [],
      note: target
        ? `No stored backlinks analysis for ${target}. Run one on the Backlinks page — this tool never spends.`
        : "No stored backlinks analysis on this workspace. Run one on the Backlinks page — this tool never spends.",
    };
  }

  const dto = toBacklinksDto(row);
  return {
    found: true,
    analysis: {
      id: dto.id,
      target: dto.target,
      mode: dto.mode,
      status: dto.status,
      costUsd: dto.costUsd,
      createdAt: dto.createdAt,
      ageHours: Number(hoursSince(row.createdAt, now).toFixed(2)),
      failedSections: dto.failedSections,
      summary: dto.summary,
    },
    referringDomains: sectionItems(dto.referringDomains).map((item) => ({
      domain: clip(item.domain as string, 200),
      rank: num(item.rank),
      backlinks: num(item.backlinks),
      spamScore: num(item.spamScore),
      firstSeen: (item.firstSeen as string | null) ?? null,
    })),
    // Anchor text is written by whoever built the link. Untrusted, and clipped.
    anchors: sectionItems(dto.anchors).map((item) => ({
      anchor: clip(item.anchor as string, 200),
      backlinks: num(item.backlinks),
      referringDomains: num(item.referringDomains),
      dofollowDomains: num(item.dofollowDomains),
    })),
    pages: sectionItems(dto.pages).map((item) => ({
      url: clip(item.url as string, 500),
      title: clip(item.title as string, 200),
      backlinks: num(item.backlinks),
      referringDomains: num(item.referringDomains),
      rank: num(item.rank),
      statusCode: (item.statusCode as number | null) ?? null,
    })),
    note:
      dto.failedSections.length > 0
        ? `Sections that did not load when this ran: ${dto.failedSections.join(", ")}.`
        : undefined,
  };
}

export async function getDomainOverview(
  tenant: McpTenant,
  args: Record<string, unknown>,
  now = new Date(),
) {
  const domain = typeof args.domain === "string" ? args.domain.trim().toLowerCase() : undefined;
  const limit = limitOf(args, 50);

  const row = await prisma.siteExplorerAnalysis.findFirst({
    where: { tenantId: tenant.id, ...(domain ? { domain } : {}) },
    orderBy: { createdAt: "desc" },
  });

  if (!row) {
    return {
      found: false,
      analysis: null,
      keywords: [],
      competitors: [],
      note: domain
        ? `No stored Site Explorer analysis for ${domain}. Run one on the Site Explorer page — this tool never spends.`
        : "No stored Site Explorer analysis on this workspace. Run one on the Site Explorer page — this tool never spends.",
    };
  }

  const dto = toSiteExplorerDto(row);
  return {
    found: true,
    analysis: {
      id: dto.id,
      domain: dto.domain,
      locationCode: dto.locationCode,
      languageCode: dto.languageCode,
      status: dto.status,
      costUsd: dto.costUsd,
      createdAt: dto.createdAt,
      ageHours: Number(hoursSince(row.createdAt, now).toFixed(2)),
      failedSections: dto.failedSections,
      overview: dto.overview,
    },
    keywords: sectionItems(dto.rankedKeywords)
      .slice(0, limit)
      .map((item) => ({
        keyword: clip(item.keyword as string, 300),
        position: num(item.position),
        searchVolume: num(item.searchVolume),
        etv: num(item.etv),
        url: clip(item.url as string, 500),
      })),
    competitors: sectionItems(dto.competitors).map((item) => ({
      domain: clip(item.domain as string, 200),
      intersections: num(item.intersections),
      avgPosition: num(item.avgPosition),
      etv: num(item.etv),
    })),
    note:
      dto.failedSections.length > 0
        ? `Sections that did not load when this ran: ${dto.failedSections.join(", ")}.`
        : undefined,
  };
}

export async function listKeywordOpportunities(
  tenant: McpTenant,
  args: Record<string, unknown>,
) {
  const limit = limitOf(args, 50);

  // Newest run for the workspace, whatever project it hangs off. The tool page
  // scopes to one brand profile because it renders a picker; an agent asking
  // "what did the last run find" wants the last run.
  const newest = await prisma.keywordOpportunityAnalysis.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!newest) {
    return {
      found: false,
      analysis: null,
      opportunities: [],
      note: "No Keyword Opportunity Finder run on this workspace yet. Start one on the Keyword Opportunities page — this tool never spends.",
    };
  }

  const analysis = await readAnalysis(tenant.id, newest.id);
  if (!analysis) {
    return {
      found: false,
      analysis: null,
      opportunities: [],
      note: "The most recent run could not be read back.",
    };
  }

  return {
    found: true,
    analysis: {
      id: analysis.id,
      domain: analysis.domain,
      status: analysis.status,
      createdAt: analysis.requestedAt,
      completedAt: analysis.completedAt,
      costUsd: analysis.costUsd,
      fromCache: analysis.fromCache,
    },
    opportunities: analysis.rows.slice(0, limit).map((row) => ({
      keyword: row.keyword,
      opportunityScore: row.opportunityScore,
      severity: row.severity,
      monthlyVolume: row.monthlyVolume,
      cpcUsd: row.cpcUsd,
      trendPercent: row.trendPercent,
      googleRank: row.googleRank,
      intent: row.intent,
      aiTested: row.aiTested,
    })),
    note:
      analysis.rows.length === 0
        ? (analysis.emptyReason ??
          (analysis.status === "COMPLETED"
            ? "The run completed with no scored opportunities."
            : `The run is ${analysis.status.toLowerCase()}.`))
        : analysis.rows.length > limit
          ? `Showing ${limit} of ${analysis.rows.length} opportunities. Raise \`limit\` for more.`
          : undefined,
  };
}

// ─── AI Citations ────────────────────────────────────────────────────────────

/**
 * The newest stored AI Citations lookup.
 *
 * READ-ONLY, like every other stored-analysis tool here. Starting a lookup
 * draws a search from the monthly allowance, so it stays a deliberate click on
 * the tool page rather than something an agent can do in a loop.
 *
 * The note distinguishes THREE empty answers, because they have three
 * different fixes: the feature is not enabled on this deployment (an operator
 * change), the workspace has never run one (a click), and this particular
 * target has none (a different click).
 */
export async function getAiCitations(tenant: McpTenant, args: Record<string, unknown>, now = new Date()) {
  const target = typeof args.target === "string" ? args.target.trim() : undefined;
  const limit = limitOf(args, 50);

  const analysis = await readLatestAiCitations(tenant.id, target);

  if (!analysis) {
    return {
      found: false,
      analysis: null,
      totals: [],
      sources: [],
      shareOfVoice: null,
      note: !aiCitationsEnabled()
        ? "AI Citations is not enabled on this deployment yet, so no lookups exist. It needs the AI Optimization product on the connected SEO data account."
        : target
          ? `No stored AI Citations lookup for ${target}. Run one on the AI Citations page — this tool never spends.`
          : "No AI Citations lookup on this workspace yet. Run one on the AI Citations page — this tool never spends.",
    };
  }

  return {
    found: true,
    analysis: {
      id: analysis.id,
      target: analysis.target,
      scope: analysis.scope,
      platforms: analysis.platforms,
      competitors: analysis.competitors,
      status: analysis.status,
      costUsd: analysis.costUsd,
      createdAt: analysis.createdAt,
      ageHours: Number(hoursSince(new Date(analysis.createdAt), now).toFixed(2)),
      failedPlatforms: analysis.failedPlatforms,
    },
    totals: analysis.totals,
    // Cited URLs came from LLM answers by way of the provider. They were
    // scheme-filtered when the lookup ran (ai-citations/url.ts); clipping here
    // bounds what an agent receives rather than re-deciding safety.
    sources: analysis.sources.slice(0, limit).map((row) => ({
      url: clip(row.url, 500),
      domain: row.domain,
      platform: row.platform,
      mentions: row.mentions,
      capturedVolume: row.capturedVolume,
      prompts: row.prompts.map((prompt) => clip(prompt.question, 300)),
    })),
    shareOfVoice: analysis.shareOfVoice,
    note:
      analysis.failedPlatforms.length > 0
        ? `Platforms that did not answer when this ran: ${analysis.failedPlatforms.join(", ")}.`
        : analysis.sources.length > limit
          ? `Showing ${limit} of ${analysis.sources.length} cited pages. Raise \`limit\` for more.`
          : undefined,
  };
}

// ─── Research log ────────────────────────────────────────────────────────────

/**
 * What this workspace has already paid to research.
 *
 * READ-ONLY AND ADVISORY, like the log itself. It returns entries, not
 * results — an agent that sees a reusable row is meant to call the matching
 * get_* tool with the `sourceRef`, not to treat this as the answer.
 */
export async function getResearchLog(tenant: McpTenant, args: Record<string, unknown>) {
  const entries = await readResearchLog(tenant.id, {
    limit: limitOf(args, 20),
    feature: typeof args.feature === "string" ? (args.feature as ResearchFeature) : undefined,
    target: typeof args.target === "string" ? args.target.trim() : undefined,
  });

  return {
    reuseWindowDays: RESEARCH_REUSE_WINDOW_DAYS,
    entries,
    note: entries.length
      ? undefined
      : "Nothing recorded yet. Either this workspace has not run a paid analysis, or the research log table has not been created on this deployment.",
  };
}

// ─── Owned-data reads ────────────────────────────────────────────────────────

export async function getGscQueries(tenant: McpTenant, args: Record<string, unknown>) {
  const days = typeof args.days === "number" ? Math.floor(args.days) : 28;
  const limit = limitOf(args, 25);

  const connection = await prisma.gscConnection.findUnique({
    where: { tenantId: tenant.id },
    select: { status: true, siteUrl: true, lastSyncAt: true },
  });

  const empty = { windowDays: days, queries: [] as never[] };

  if (!connection) {
    return {
      connected: false,
      needsReauth: false,
      property: null,
      lastSyncAt: null,
      ...empty,
      note: "Search Console is not connected on this workspace. Connecting it is a setting on the GSC Insights page, not a purchase.",
    };
  }
  if (connection.status === "NEEDS_REAUTH") {
    return {
      connected: true,
      needsReauth: true,
      property: connection.siteUrl,
      lastSyncAt: iso(connection.lastSyncAt),
      ...empty,
      note: "The Search Console connection needs re-authorising before new data arrives.",
    };
  }

  const rows = await prisma.gscQueryStat.groupBy({
    by: ["query"],
    where: {
      tenantId: tenant.id,
      date: { gte: new Date(Date.now() - days * 86_400_000) },
      // page = "" is the query-only aggregate row. Summing the per-page rows on
      // top of it would double every click and impression.
      page: "",
    },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true, ctr: true },
    orderBy: { _sum: { clicks: "desc" } },
    take: limit,
  });

  return {
    connected: true,
    needsReauth: false,
    property: connection.siteUrl,
    windowDays: days,
    lastSyncAt: iso(connection.lastSyncAt),
    // Typed into Google by strangers. Untrusted text, clipped.
    queries: rows.map((row) => ({
      query: clip(row.query, 200),
      clicks: row._sum.clicks ?? 0,
      impressions: row._sum.impressions ?? 0,
      ctr: row._avg.ctr !== null ? Number((row._avg.ctr * 100).toFixed(2)) : null,
      avgPosition: row._avg.position !== null ? Number(row._avg.position.toFixed(1)) : null,
    })),
    note:
      rows.length > 0
        ? undefined
        : connection.lastSyncAt === null
          ? "Connected but not synced yet. Data appears after the first nightly sync."
          : "Connected and syncing, with no query rows in this window. That is normal on a low-traffic property — Google withholds queries searched by too few people to stay anonymous. It does not mean the sync is broken.",
  };
}

export async function getCrawlSummary(tenant: McpTenant, args: Record<string, unknown>) {
  const crawlJobId = typeof args.crawlJobId === "string" ? args.crawlJobId : undefined;
  const limit = limitOf(args, 20);

  const job = crawlJobId
    ? await prisma.crawlJob.findFirst({
        where: { id: crawlJobId, tenantId: tenant.id },
        select: {
          id: true,
          rootUrl: true,
          status: true,
          pagesCrawled: true,
          issueCount: true,
          stoppedReason: true,
          finishedAt: true,
        },
      })
    : await prisma.crawlJob.findFirst({
        where: { tenantId: tenant.id, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rootUrl: true,
          status: true,
          pagesCrawled: true,
          issueCount: true,
          stoppedReason: true,
          finishedAt: true,
        },
      });

  if (!job) {
    return {
      found: false,
      crawl: null,
      topIssues: [],
      note: crawlJobId
        ? "No crawl with that id belongs to this workspace."
        : "No completed site crawl on this workspace. Start one on the Site Crawler page.",
    };
  }

  // Grouped in the database rather than fetched and counted here: a
  // 25,000-page crawl's issues do not belong in this process's memory.
  const issues = await prisma.crawlIssue.groupBy({
    by: ["type", "severity"],
    where: { crawlPage: { crawlJobId: job.id } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  return {
    found: true,
    crawl: {
      id: job.id,
      rootUrl: job.rootUrl,
      status: job.status,
      pagesCrawled: job.pagesCrawled,
      issueCount: job.issueCount,
      stoppedReason: job.stoppedReason,
      finishedAt: iso(job.finishedAt),
    },
    topIssues: issues.map((issue) => ({
      type: issue.type,
      severity: issue.severity,
      pages: issue._count._all,
    })),
    note:
      job.status === "COMPLETED"
        ? undefined
        : `This crawl is ${String(job.status).toLowerCase()}; the figures are partial.`,
  };
}
