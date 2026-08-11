// src/lib/ai-monitor/dashboard/read.ts
//
// Every query the AI Search dashboard makes. All of them reads.
//
// NOTHING HERE COMPUTES A SCORE. The rows were written by the version of the
// formula current on the day they were written; recomputing at render time
// would silently restate history the first time a weight changed, and a trend
// line that quietly rewrites last quarter is worse than no trend line. What
// this module does is fetch, gate on version (./display.ts), and shape.
//
// Checkup.visibilityScore IS DELIBERATELY NEVER SELECTED. It belongs to the
// audit product and is a different number computed a different way; the only
// score on these screens is VisibilityMetric.visibilityScore. The two are never
// averaged, mapped or reconciled — see the header of ../metrics.ts.

import { prisma } from "@/lib/prisma";
import { toMetricView, type MetricRow, type MetricView } from "./display";

/** How much history the overview charts show. */
export const HISTORY_DAYS = 90;
/** Competitors and citation domains are top-10 lists. */
export const TOP_N = 10;

export interface BrandSummary {
  id: string;
  name: string;
  website: string | null;
  trackingActive: boolean;
  promptCount: number;
}

export async function listBrands(tenantId: string): Promise<BrandSummary[]> {
  const brands = await prisma.brandProfile.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      website: true,
      trackingActive: true,
      _count: { select: { prompts: { where: { active: true } } } },
    },
  });
  return brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    website: brand.website,
    trackingActive: brand.trackingActive,
    promptCount: brand._count.prompts,
  }));
}

const METRIC_FIELDS = {
  day: true,
  engine: true,
  scoreVersion: true,
  visibilityScore: true,
  citationScore: true,
  recommendationScore: true,
  sentimentScore: true,
  shareOfVoice: true,
  averagePosition: true,
  mentionRate: true,
  top3Rate: true,
  runCount: true,
  partialCoverage: true,
  skippedRuns: true,
} as const;

/** Every metric row for a brand's recent history, version-gated. */
export async function readMetrics(
  brandProfileId: string,
  days: number = HISTORY_DAYS,
): Promise<MetricView[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.visibilityMetric.findMany({
    where: { brandProfileId, day: { gte: since } },
    orderBy: [{ day: "asc" }, { engine: "asc" }],
    select: METRIC_FIELDS,
  });
  return (rows as MetricRow[]).map(toMetricView);
}

export interface CheckupHistoryEntry {
  id: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  stoppedReason: string | null;
}

/**
 * Recent checkups, INCLUDING the failed ones.
 *
 * A failed checkup is a fact about a day, not an absence of one. Filtering them
 * out would leave a gap in the history that reads as "nothing was scheduled"
 * when the truth is "we tried and could not" — and those call for different
 * actions from the reader.
 */
export async function readCheckupHistory(
  brandProfileId: string,
  take = 20,
): Promise<CheckupHistoryEntry[]> {
  return prisma.checkup.findMany({
    where: { brandProfileId },
    orderBy: { createdAt: "desc" },
    take,
    // Note the absence of visibilityScore: that column is the audit's number
    // and must not reach a watcher screen.
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      stoppedReason: true,
    },
  });
}

export interface CompetitorRow {
  name: string;
  appearances: number;
  averagePosition: number | null;
}

/**
 * Competitors seen across a brand's recent runs.
 *
 * Counted per RUN, matching topCompetitors() in ../metrics.ts — a competitor
 * named three times in one answer appeared in one answer, and counting the
 * repeats would let a single effusive response manufacture a rival.
 */
export async function readTopCompetitors(
  brandProfileId: string,
  days: number = HISTORY_DAYS,
): Promise<CompetitorRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const mentions = await prisma.competitorMention.findMany({
    where: {
      createdAt: { gte: since },
      promptRun: { checkup: { brandProfileId }, status: "OK" },
      // Rivals, and rows from before the classifier existed. Platforms and
      // category words were observed and stored but are not competitors; a
      // panel listing ChatGPT as a rival of an AI-visibility product is the
      // failure this filter removes. Unclassified rows still count, because
      // dropping them would erase every historical checkup's competitors the
      // day this shipped.
      OR: [{ classification: "RIVAL" }, { classification: null }],
    },
    select: { name: true, promptRunId: true, recommendationPosition: true },
  });

  const byName = new Map<string, { name: string; runs: Set<string>; positions: number[] }>();
  for (const mention of mentions) {
    const key = mention.name.trim().toLowerCase();
    if (!key) continue;
    const bucket = byName.get(key) ?? { name: mention.name.trim(), runs: new Set(), positions: [] };
    bucket.runs.add(mention.promptRunId);
    if (mention.recommendationPosition !== null) bucket.positions.push(mention.recommendationPosition);
    byName.set(key, bucket);
  }

  return [...byName.values()]
    .map((bucket) => ({
      name: bucket.name,
      appearances: bucket.runs.size,
      averagePosition:
        bucket.positions.length > 0
          ? Math.round((bucket.positions.reduce((a, b) => a + b, 0) / bucket.positions.length) * 10) /
            10
          : null,
    }))
    .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name))
    .slice(0, TOP_N);
}

export interface CitationDomainRow {
  domain: string;
  count: number;
  isMonitored: boolean;
}

/** The domains AI answers cite most for this brand's questions. */
export async function readTopCitationDomains(
  brandProfileId: string,
  days: number = HISTORY_DAYS,
): Promise<CitationDomainRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const citations = await prisma.citation.findMany({
    where: {
      createdAt: { gte: since },
      promptRun: { checkup: { brandProfileId }, status: "OK" },
    },
    select: { domain: true, supportsBrand: true },
  });

  const byDomain = new Map<string, { count: number; isMonitored: boolean }>();
  for (const citation of citations) {
    const bucket = byDomain.get(citation.domain) ?? { count: 0, isMonitored: false };
    bucket.count += 1;
    // supportsBrand is where isMonitoredDomain is stored — see runner/salvage.ts
    // for the full list of stored-vs-scored name disagreements.
    bucket.isMonitored = bucket.isMonitored || citation.supportsBrand;
    byDomain.set(citation.domain, bucket);
  }

  return [...byDomain.entries()]
    .map(([domain, bucket]) => ({ domain, ...bucket }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, TOP_N);
}

export interface PromptRow {
  id: string;
  text: string;
  category: string | null;
  active: boolean;
  tags: string[];
  lastRunAt: Date | null;
}

export async function readPrompts(brandProfileId: string): Promise<PromptRow[]> {
  return prisma.trackedPrompt.findMany({
    where: { brandProfileId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: { id: true, text: true, category: true, active: true, tags: true, lastRunAt: true },
  });
}

export interface PromptAnswer {
  runId: string;
  engine: string;
  createdAt: Date;
  status: string;
  brandMentioned: boolean;
  brandPosition: number | null;
  sentiment: string | null;
  /** Verbatim. Rendered as TEXT, never as markup — see the drilldown client. */
  rawResponse: string | null;
  citations: { url: string; domain: string; title: string | null; isMonitored: boolean }[];
  competitors: { name: string; position: number | null }[];
}

/**
 * One prompt's answers, newest first, with everything the drilldown shows.
 *
 * Skipped and failed runs come through too: "we did not ask on Tuesday" is part
 * of reading a prompt's history, and hiding them makes a gap look like a run
 * where nobody mentioned the brand.
 */
export async function readPromptAnswers(
  promptId: string,
  brandProfileId: string,
  take = 30,
): Promise<PromptAnswer[]> {
  const runs = await prisma.promptRun.findMany({
    where: { promptId, checkup: { brandProfileId } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      engine: true,
      createdAt: true,
      status: true,
      brandMentioned: true,
      rawResponse: true,
      analysis: { select: { recommendationPosition: true, sentiment: true } },
      citations: {
        orderBy: { citationPosition: "asc" },
        select: { url: true, domain: true, title: true, supportsBrand: true },
      },
      competitorMentions: { select: { name: true, recommendationPosition: true } },
    },
  });

  return runs.map((run) => ({
    runId: run.id,
    engine: run.engine,
    createdAt: run.createdAt,
    status: run.status,
    brandMentioned: run.brandMentioned,
    brandPosition: run.analysis?.recommendationPosition ?? null,
    sentiment: run.analysis?.sentiment ?? null,
    rawResponse: run.rawResponse,
    citations: run.citations.map((citation) => ({
      url: citation.url,
      domain: citation.domain,
      title: citation.title,
      isMonitored: citation.supportsBrand,
    })),
    competitors: run.competitorMentions.map((competitor) => ({
      name: competitor.name,
      position: competitor.recommendationPosition,
    })),
  }));
}
