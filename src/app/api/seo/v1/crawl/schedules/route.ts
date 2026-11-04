/**
 * /api/seo/v1/crawl/schedules — scheduled crawls (Phase 4c).
 *
 *   GET  → { schedules, cap, cadences, cadenceUnlocks, timezone }. Each schedule
 *        carries lastHealth and prevHealth: its last two completed runs
 *        (crawl_jobs.scheduleId), for the delta; lastJobId when it has none.
 *   POST { rootUrl, renderMode, config, cadence, hourUtc, enabled, exportTo }
 *        → the new schedule. Validated like a crawl start (SSRF guard,
 *        configuration check, verified-only options), secrets sealed, capped
 *        by plan-config crawlSchedules / crawlScheduleCadences.
 *
 * Tenant-scoped: every read and write filters on the caller's tenantId.
 * The sealed configuration is never returned.
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { getQueue } from "@/infrastructure/queue/registry";
import { flag } from "@/lib/flags";
import { prisma } from "@/lib/prisma";
import { healthOf } from "@/lib/site-crawler/site-health";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { scheduleCapsForPlan } from "@/lib/site-crawler/quota";
import { ScheduleInputSchema, cadenceUnlocks } from "@/lib/site-crawler/schedule";
import { createSchedule, listSchedules, toScheduleDto } from "@/lib/site-crawler/schedule-service";

const off = () => NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
export async function GET() {
  try {
    if (!flag("crawl.schedule")) return off();
    const tenant = await requirePaidPlan();
    const { scheduleCap, scheduleCadences } = scheduleCapsForPlan(tenant.tenant.planType);
    const rows = await listSchedules(tenant.tenantId);
    // Each schedule's last completed run, for its health (one read, tenant-scoped).
    const lastIds = rows.map((r) => r.lastJobId).filter((id): id is string => Boolean(id));
    const last = lastIds.length
      ? await prisma.crawlJob.findMany({ where: { id: { in: lastIds }, tenantId: tenant.tenantId }, select: { id: true, summary: true } })
      : [];
    const healthById = new Map(last.map((j) => [j.id, healthOf(j.summary)]));
    // The last two completed runs of each schedule, newest first: health and the delta.
    const ids = rows.map((r) => r.id);
    const runs = ids.length
      ? await prisma.$queryRaw<{ scheduleId: string; score: number | null; rn: bigint }[]>`
          SELECT "scheduleId", ("summary" -> 'health' ->> 'score')::float8 AS score, rn
          FROM (
            SELECT "scheduleId", "summary", row_number() OVER (PARTITION BY "scheduleId" ORDER BY "createdAt" DESC) AS rn
            FROM "crawl_jobs"
            WHERE "tenantId" = ${tenant.tenantId} AND "scheduleId" = ANY(${ids}) AND "status" = 'COMPLETED'
          ) x
          WHERE rn <= 2`
      : [];
    const runHealth = (id: string, n: number) => {
      const r = runs.find((x) => x.scheduleId === id && Number(x.rn) === n);
      return r && r.score !== null ? Math.round(r.score) : null;
    };
    return NextResponse.json({
      schedules: rows.map((r) => {
        const latest = runs.some((x) => x.scheduleId === r.id && Number(x.rn) === 1);
        return {
          ...toScheduleDto(r),
          lastHealth: latest ? runHealth(r.id, 1) : r.lastJobId ? (healthById.get(r.lastJobId) ?? null) : null,
          prevHealth: runHealth(r.id, 2),
        };
      }),
      cap: scheduleCap,
      cadences: scheduleCadences,
      cadenceUnlocks: cadenceUnlocks(scheduleCadences),
      timezone: tenant.tenant.timezone,
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    if (!flag("crawl.schedule")) return off();
    const tenant = await requirePaidPlan();
    const parsed = ScheduleInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
    }
    const input = { ...parsed.data, exportTo: { ...parsed.data.exportTo, sheets: flag("crawl.sheets") ? parsed.data.exportTo.sheets : null } };
    const row = await createSchedule(tenant.tenantId, tenant.tenant.planType, input, getQueue("site-crawl"));
    return NextResponse.json(toScheduleDto(row), { status: 201 });
  } catch (err) {
    return crawlRouteError(err);
  }
}
