// src/app/api/ai/visibility/brand-radar/route.ts
// Brand Radar summary — everything here is REAL persisted tenant data:
//   - latest VisibilityAudit (score/grade, stored by audit runs/monitoring)
//   - TrackedPrompt + PromptRun aggregates (mention rate, per-engine coverage)
//   - AlertEvent rows with visibility_* kinds (recordPromptAlerts)
// No trust score: the landing widget computes one transiently and nothing
// persists it, so it is deliberately omitted rather than faked.
// Paid-gated like the rest of the SEO Tools hub; tenant-scoped from the
// session only (no tenant parameter is accepted).
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { hasFeature } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

const RUN_WINDOW_DAYS = 30;
const MAX_ALERTS = 8;

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const tenantId = membership.tenantId;
    const answerTracking = hasFeature(membership.tenant.planType, "answer_tracking");

    const since = new Date(Date.now() - RUN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

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

    // Per-engine coverage over the window (real runs only).
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

    return NextResponse.json({
      brand: {
        name: membership.tenant.name,
        domain:
          latestAudit?.url ?? membership.tenant.auditDomain ?? null,
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
        windowDays: RUN_WINDOW_DAYS,
        runs: runs.length,
        mentionRate,
        lastRunAt: lastRun,
        engines,
      },
      alerts,
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[visibility/brand-radar GET]", error);
    return NextResponse.json({ error: "Failed to load brand radar." }, { status: 500 });
  }
}
