/**
 * /api/seo/v1/crawl/schedules — scheduled crawls (Phase 4c).
 *
 *   GET  → { schedules, cap, cadences }
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
import { crawlRouteError } from "@/lib/site-crawler/http";
import { scheduleCapsForPlan } from "@/lib/site-crawler/quota";
import { ScheduleInputSchema } from "@/lib/site-crawler/schedule";
import { createSchedule, listSchedules, toScheduleDto } from "@/lib/site-crawler/schedule-service";

const off = () => NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

export async function GET() {
  try {
    if (!flag("crawl.schedule")) return off();
    const tenant = await requirePaidPlan();
    const { scheduleCap, scheduleCadences } = scheduleCapsForPlan(tenant.tenant.planType);
    const rows = await listSchedules(tenant.tenantId);
    return NextResponse.json({ schedules: rows.map(toScheduleDto), cap: scheduleCap, cadences: scheduleCadences });
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
