import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";

/**
 * Day-grouped mention history for every tracked prompt (AGENCY+).
 * One run per prompt per day (latest wins). Feeds the trend sparklines.
 */

const MAX_DAYS = 90;

export async function GET(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("answer_tracking");
    const tenantId = membership.tenantId;

    const url = new URL(req.url);
    const days = Math.min(
      MAX_DAYS,
      Math.max(7, parseInt(url.searchParams.get("days") ?? "90", 10) || 90),
    );
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [prompts, runs] = await Promise.all([
      prisma.trackedPrompt.findMany({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
        select: { id: true, text: true, active: true },
      }),
      prisma.promptRun.findMany({
        where: { tenantId, createdAt: { gte: since }, error: null },
        orderBy: { createdAt: "asc" },
        select: {
          promptId: true,
          brandMentioned: true,
          brandRank: true,
          createdAt: true,
        },
      }),
    ]);

    // promptId -> day(YYYY-MM-DD, UTC) -> latest run that day
    const byPrompt = new Map<
      string,
      Map<string, { m: boolean; r: number | null }>
    >();
    for (const run of runs) {
      const day = run.createdAt.toISOString().slice(0, 10);
      let m = byPrompt.get(run.promptId);
      if (!m) {
        m = new Map();
        byPrompt.set(run.promptId, m);
      }
      // runs are asc; overwrite so the day's latest run wins
      m.set(day, { m: run.brandMentioned, r: run.brandRank });
    }

    return NextResponse.json({
      days,
      series: prompts.map((p) => {
        const dayMap = byPrompt.get(p.id);
        return {
          promptId: p.id,
          text: p.text,
          active: p.active,
          points: dayMap
            ? [...dayMap.entries()].map(([d, v]) => ({ d, m: v.m, r: v.r }))
            : [],
        };
      }),
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/prompts/history GET]", error);
    return NextResponse.json({ error: "Failed to load history." }, { status: 500 });
  }
}
