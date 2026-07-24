// Shared visibility-summary aggregation: real persisted tenant data only
// (latest VisibilityAudit, PromptRun 30d aggregates, visibility_* AlertEvents).
// Consumed by the Brand Radar page route AND the public v1 API / MCP tools,
// so the numbers can never diverge between surfaces. Trust score is
// deliberately absent everywhere: nothing persists one.
import { prisma } from "@/lib/prisma";
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
    lastRunAt: Date | null;
    engines: { engine: string; runs: number; mentioned: number; rate: number }[];
  };
  alerts: { id: string; kind: string; severity: string; title: string; createdAt: Date }[];
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
  const engines = [...byEngine.entries()]
    .map(([engine, v]) => ({
      engine,
      runs: v.runs,
      mentioned: v.mentioned,
      rate: Math.round((v.mentioned / v.runs) * 100),
    }))
    .sort((a, b) => b.runs - a.runs);

  const mentionRate =
    runs.length > 0
      ? Math.round((runs.filter((r) => r.brandMentioned).length / runs.length) * 100)
      : null;

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
      lastRunAt: lastRun,
      engines,
    },
    alerts,
  };
}
