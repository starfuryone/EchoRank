// Shared visibility-summary aggregation: real persisted tenant data only
// (latest VisibilityAudit, PromptRun 30d aggregates, visibility_* AlertEvents).
// Consumed by the Brand Radar page route AND the public v1 API / MCP tools,
// so the numbers can never diverge between surfaces.
//
// NOISE-AWARE. Every mention rate carries its 90% Wilson interval
// (src/lib/stats/noise.ts): 2 of 3 and 66 of 100 are not the same 67%. The
// AI Trust Score is the mention rate smoothed over days with an EWMA (alpha
// 0.3), so one odd day moves it by under a third; it is computed here from
// the same runs, not persisted.
import { prisma } from "@/lib/prisma";
import { ewma, wilsonInterval } from "@/lib/stats/noise";
import { hasFeature } from "@/lib/feature-flags";
import type { PlanType } from "@/generated/prisma";

export const SUMMARY_WINDOW_DAYS = 30;
const MAX_ALERTS = 8;

export interface VisibilitySummary {
  brand: { name: string; domain: string | null };
  audit: { url: string; score: number; grade: string; at: Date } | null;
  prompts: {
    feature: boolean;
    total: number;
    active: number;
    windowDays: number;
    runs: number;
    mentionRate: number | null;
    /** 90% Wilson interval around mentionRate, in percent. Null with no runs. */
    mentionRateInterval: { low: number; high: number } | null;
    /**
     * AI Trust Score, 0-100: the daily mention rate smoothed with an EWMA
     * (alpha 0.3), oldest day first. Null with no runs.
     */
    trustScore: number | null;
    lastRunAt: Date | null;
    engines: { engine: string; runs: number; mentioned: number; rate: number; low: number; high: number }[];
  };
  alerts: { id: string; kind: string; severity: string; title: string; createdAt: Date }[];
}

/**
 * The AI Trust Score: the mention rate per UTC day, oldest first, smoothed
 * with an EWMA, as 0-100. Exported for the tests.
 */
export function trustScoreOf(runs: readonly { brandMentioned: boolean; createdAt: Date }[]): number | null {
  const byDay = new Map<string, { runs: number; mentioned: number }>();
  for (const r of runs) {
    const day = r.createdAt.toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { runs: 0, mentioned: 0 };
    d.runs += 1;
    if (r.brandMentioned) d.mentioned += 1;
    byDay.set(day, d);
  }
  const daily = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d.mentioned / d.runs);
  const smoothed = ewma(daily);
  return smoothed === null ? null : Math.round(smoothed * 100);
}

export async function getVisibilitySummary(
  tenantId: string,
  tenantName: string,
  planType: PlanType,
  auditDomain: string | null,
): Promise<VisibilitySummary> {
  const answerTracking = hasFeature(planType, "answer_tracking");
  const since = new Date(Date.now() - SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [latestAudit, promptCounts, activePrompts, runs, alerts] = await Promise.all([
    prisma.visibilityAudit.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { url: true, score: true, grade: true, createdAt: true },
    }),
    prisma.trackedPrompt.count({ where: { tenantId } }),
    prisma.trackedPrompt.count({ where: { tenantId, active: true } }),
    prisma.promptRun.findMany({
      where: { tenantId, createdAt: { gte: since }, error: null },
      select: { engine: true, brandMentioned: true, createdAt: true },
    }),
    prisma.alertEvent.findMany({
      where: { tenantId, kind: { startsWith: "visibility_" } },
      orderBy: { createdAt: "desc" },
      take: MAX_ALERTS,
      select: { id: true, kind: true, severity: true, title: true, createdAt: true },
    }),
  ]);

  const byEngine = new Map<string, { runs: number; mentioned: number }>();
  for (const r of runs) {
    const e = byEngine.get(r.engine) ?? { runs: 0, mentioned: 0 };
    e.runs += 1;
    if (r.brandMentioned) e.mentioned += 1;
    byEngine.set(r.engine, e);
  }
  const pct = (x: number) => Math.round(x * 100);
  const engines = [...byEngine.entries()]
    .map(([engine, v]) => {
      const ci = wilsonInterval(v.mentioned, v.runs);
      return { engine, runs: v.runs, mentioned: v.mentioned, rate: pct(ci.rate), low: pct(ci.low), high: pct(ci.high) };
    })
    .sort((a, b) => b.runs - a.runs);

  const mentionedCount = runs.filter((r) => r.brandMentioned).length;
  const overall = runs.length > 0 ? wilsonInterval(mentionedCount, runs.length) : null;
  const mentionRate = overall ? pct(overall.rate) : null;
  const trustScore = trustScoreOf(runs);

  const lastRun = runs.reduce<Date | null>(
    (acc, r) => (acc && acc > r.createdAt ? acc : r.createdAt),
    null,
  );

  return {
    brand: {
      name: tenantName,
      domain: latestAudit?.url ?? auditDomain ?? null,
    },
    audit: latestAudit
      ? {
          url: latestAudit.url,
          score: latestAudit.score,
          grade: latestAudit.grade,
          at: latestAudit.createdAt,
        }
      : null,
    prompts: {
      feature: answerTracking,
      total: promptCounts,
      active: activePrompts,
      windowDays: SUMMARY_WINDOW_DAYS,
      runs: runs.length,
      mentionRate,
      mentionRateInterval: overall ? { low: pct(overall.low), high: pct(overall.high) } : null,
      trustScore,
      lastRunAt: lastRun,
      engines,
    },
    alerts,
  };
}
