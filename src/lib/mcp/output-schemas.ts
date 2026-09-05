// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/mcp/output-schemas.ts
//
// One zod output schema per MCP tool, validated by the handler before the
// result leaves the process.
//
// ── WHY VALIDATE OUR OWN OUTPUT ────────────────────────────────────────────
// These schemas do not defend against a hostile caller; the caller never
// supplies this data. They defend against US. Every tool's payload is
// assembled from a stored Prisma row, a JSON column or a provider envelope,
// and each of those can change shape under a refactor without a type error —
// `row.summary as SummarySection | null` is a cast, not a check. A tool whose
// shape drifted returns garbage that an agent will confidently act on. With
// this, the same drift returns a named tool error naming the tool.
//
// ── LOOSE, ON PURPOSE ──────────────────────────────────────────────────────
// Every object is `z.looseObject` (zod 4's `.passthrough()`), so a field ADDED
// upstream flows through untouched and only a field REMOVED or RETYPED fails.
// The alternative — strict objects — would turn every additive change into a
// production incident, which is exactly the failure mode this is meant to
// prevent rather than cause.
//
// Nested payloads that this repo does not own (the SERP results blob, the
// sidecar's keyword report, stored section JSON) are typed `z.unknown()`
// deliberately: asserting a shape we neither produce nor parse would be a
// guess dressed as a guarantee.

import { z } from "zod";
import { MCP_TOOL_NAMES } from "./tools";

/** Every tool may carry a prose `note` explaining an empty or partial result. */
const note = z.string().optional();

const nullableNumber = z.number().nullable();

// ─── whoami ──────────────────────────────────────────────────────────────────

export const whoamiOutputSchema = z.looseObject({
  workspace: z.looseObject({
    name: z.string(),
    plan: z.string(),
  }),
  seoSearches: z.looseObject({
    used: z.number(),
    limit: nullableNumber,
    remaining: nullableNumber,
    unlimited: z.boolean(),
    resetsAt: z.string(),
  }),
  keywordOpportunity: z.looseObject({
    allowanceTotal: nullableNumber,
    allowanceUsed: z.number(),
    allowanceRemaining: nullableNumber,
    credits: z.number(),
  }),
  trackedKeywords: z.looseObject({
    used: z.number(),
    limit: z.number(),
  }),
  dataforseoSpend: z.looseObject({
    monthUsd: z.number(),
    capUsd: z.number(),
    remainingUsd: z.number(),
  }),
  note,
});

// ─── SERP Checker ────────────────────────────────────────────────────────────

const serpCheckSchema = z.looseObject({
  id: z.string(),
  keyword: z.string(),
  locationCode: z.number(),
  languageCode: z.string(),
  device: z.string(),
  status: z.string(),
  costUsd: z.number(),
  itemCount: z.number().nullable(),
  serpFeatures: z.array(z.string()),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  /** The provider's top-100 blob. Not ours to shape. */
  results: z.unknown().nullable(),
});

export const getSerpCheckOutputSchema = z.looseObject({
  found: z.boolean(),
  check: serpCheckSchema.nullable(),
  note,
});

export const startSerpCheckOutputSchema = z.looseObject({
  id: z.string(),
  keyword: z.string(),
  status: z.string(),
  /** True when an identical check inside the 24h window was replayed for free. */
  cached: z.boolean(),
  note,
});

// ─── Rank Tracker ────────────────────────────────────────────────────────────

const rankProjectSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  locationCode: z.number(),
  languageCode: z.string(),
  device: z.string(),
  frequency: z.string(),
  active: z.boolean(),
  overCap: z.boolean(),
  keywordCount: z.number(),
  lastRunAt: z.string().nullable(),
  pendingCount: z.number(),
  averagePosition: nullableNumber,
});

const rankKeywordSchema = z.looseObject({
  keyword: z.string(),
  /** null = not in the top 100. A real answer, never rendered as 0. */
  position: nullableNumber,
  url: z.string().nullable(),
  deltaPrevious: nullableNumber,
  delta30d: nullableNumber,
  pending: z.boolean(),
});

export const getRankTrackerOutputSchema = z.looseObject({
  projects: z.array(rankProjectSchema),
  /** Populated only when `projectId` was supplied. */
  project: rankProjectSchema.nullable(),
  keywords: z.array(rankKeywordSchema),
  note,
});

export const rankKeywordMutationOutputSchema = z.looseObject({
  projectId: z.string(),
  /** Keywords this call actually changed. */
  changed: z.array(z.string()),
  /** Supplied but already in (add) or already absent (remove). */
  ignored: z.array(z.string()),
  keywordCount: z.number(),
  trackedKeywords: z.number(),
  trackedKeywordLimit: z.number(),
  note,
});

// ─── Stored analyses ─────────────────────────────────────────────────────────

export const backlinksOverviewOutputSchema = z.looseObject({
  found: z.boolean(),
  analysis: z
    .looseObject({
      id: z.string(),
      target: z.string(),
      mode: z.string(),
      status: z.string(),
      costUsd: z.number(),
      createdAt: z.string(),
      ageHours: z.number(),
      failedSections: z.array(z.string()),
      summary: z.unknown().nullable(),
    })
    .nullable(),
  referringDomains: z.array(z.looseObject({ domain: z.string() })),
  anchors: z.array(z.looseObject({ anchor: z.string() })),
  pages: z.array(z.looseObject({ url: z.string() })),
  note,
});

export const domainOverviewOutputSchema = z.looseObject({
  found: z.boolean(),
  analysis: z
    .looseObject({
      id: z.string(),
      domain: z.string(),
      locationCode: z.number(),
      languageCode: z.string(),
      status: z.string(),
      costUsd: z.number(),
      createdAt: z.string(),
      ageHours: z.number(),
      failedSections: z.array(z.string()),
      overview: z.unknown().nullable(),
    })
    .nullable(),
  keywords: z.array(z.looseObject({ keyword: z.string() })),
  competitors: z.array(z.looseObject({ domain: z.string() })),
  note,
});

export const keywordOpportunitiesOutputSchema = z.looseObject({
  found: z.boolean(),
  analysis: z
    .looseObject({
      id: z.string(),
      domain: z.string(),
      status: z.string(),
      createdAt: z.string(),
      completedAt: z.string().nullable(),
      costUsd: z.number(),
      fromCache: z.boolean(),
    })
    .nullable(),
  opportunities: z.array(z.looseObject({ keyword: z.string() })),
  note,
});

// ─── Research log ────────────────────────────────────────────────────────────

export const researchLogOutputSchema = z.looseObject({
  reuseWindowDays: z.number(),
  entries: z.array(
    z.looseObject({
      id: z.string(),
      feature: z.string(),
      target: z.string(),
      metrics: z.record(z.string(), z.union([z.number(), z.string()])).nullable(),
      costUsd: z.number(),
      sourceRef: z.string().nullable(),
      createdAt: z.string(),
      ageHours: z.number(),
      reusable: z.boolean(),
    }),
  ),
  note,
});

// ─── Owned-data reads ────────────────────────────────────────────────────────

export const gscQueriesOutputSchema = z.looseObject({
  connected: z.boolean(),
  needsReauth: z.boolean(),
  property: z.string().nullable(),
  windowDays: z.number(),
  lastSyncAt: z.string().nullable(),
  queries: z.array(
    z.looseObject({
      query: z.string(),
      clicks: z.number(),
      impressions: z.number(),
      ctr: nullableNumber,
      avgPosition: nullableNumber,
    }),
  ),
  note,
});

export const crawlSummaryOutputSchema = z.looseObject({
  found: z.boolean(),
  crawl: z
    .looseObject({
      id: z.string(),
      rootUrl: z.string(),
      status: z.string(),
      pagesCrawled: z.number(),
      issueCount: z.number(),
      stoppedReason: z.string().nullable(),
      finishedAt: z.string().nullable(),
    })
    .nullable(),
  topIssues: z.array(
    z.looseObject({
      type: z.string(),
      severity: z.string(),
      pages: z.number(),
    }),
  ),
  note,
});

// ─── Pre-existing tools ──────────────────────────────────────────────────────
// Shapes owned elsewhere (the av-service sidecar, the shared visibility
// summary). Asserting their internals here would duplicate a contract that
// already has its own tests, and would break this endpoint when that contract
// legitimately grows.

const opaqueOutputSchema = z.looseObject({});

/**
 * The registry the handler validates against.
 *
 * A tool with no entry is a bug, not a shortcut — `assertOutputSchemaCoverage`
 * below is asserted in the test suite, so adding a tool to the catalog without
 * a schema fails there rather than shipping unvalidated.
 */
export const MCP_OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
  whoami: whoamiOutputSchema,
  suggest_keywords: opaqueOutputSchema,
  get_latest_audit: opaqueOutputSchema,
  get_visibility_summary: opaqueOutputSchema,
  get_serp_check: getSerpCheckOutputSchema,
  start_serp_check: startSerpCheckOutputSchema,
  get_rank_tracker: getRankTrackerOutputSchema,
  add_rank_tracking_keywords: rankKeywordMutationOutputSchema,
  remove_rank_tracking_keywords: rankKeywordMutationOutputSchema,
  get_backlinks_overview: backlinksOverviewOutputSchema,
  get_domain_overview: domainOverviewOutputSchema,
  list_keyword_opportunities: keywordOpportunitiesOutputSchema,
  get_research_log: researchLogOutputSchema,
  get_gsc_queries: gscQueriesOutputSchema,
  get_crawl_summary: crawlSummaryOutputSchema,
};

/** Tool names in the catalog with no output schema. Empty is the only pass. */
export function missingOutputSchemas(): string[] {
  return MCP_TOOL_NAMES.filter((name) => !(name in MCP_OUTPUT_SCHEMAS));
}

/** Schema entries that name a tool the catalog does not have. */
export function orphanOutputSchemas(): string[] {
  const names = new Set(MCP_TOOL_NAMES);
  return Object.keys(MCP_OUTPUT_SCHEMAS).filter((name) => !names.has(name));
}

// ─── Inferred payload types ──────────────────────────────────────────────────
// The renderers in ./render.ts take these rather than `unknown`: the handler
// validates before it renders, so by the time a renderer runs the shape is
// already proven. Typing it twice — once in zod, once by hand — is how the two
// drift.

export type WhoamiPayload = z.infer<typeof whoamiOutputSchema>;
export type GetSerpCheckPayload = z.infer<typeof getSerpCheckOutputSchema>;
export type StartSerpCheckPayload = z.infer<typeof startSerpCheckOutputSchema>;
export type RankTrackerPayload = z.infer<typeof getRankTrackerOutputSchema>;
export type RankKeywordMutationPayload = z.infer<typeof rankKeywordMutationOutputSchema>;
export type BacklinksOverviewPayload = z.infer<typeof backlinksOverviewOutputSchema>;
export type DomainOverviewPayload = z.infer<typeof domainOverviewOutputSchema>;
export type KeywordOpportunitiesPayload = z.infer<typeof keywordOpportunitiesOutputSchema>;
export type ResearchLogPayload = z.infer<typeof researchLogOutputSchema>;
export type GscQueriesPayload = z.infer<typeof gscQueriesOutputSchema>;
export type CrawlSummaryPayload = z.infer<typeof crawlSummaryOutputSchema>;
