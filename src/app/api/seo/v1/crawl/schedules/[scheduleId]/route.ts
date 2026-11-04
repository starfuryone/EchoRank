/**
 * /api/seo/v1/crawl/schedules/[scheduleId] — change or delete one schedule (Phase 4c).
 *
 *   PATCH { enabled?, cadence?, hourUtc?, exportTo? } → the schedule
 *   DELETE → 204; its BullMQ repeatable goes with it.
 *
 * Tenant-scoped: findFirst / deleteMany on { id, tenantId }.
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { getQueue } from "@/infrastructure/queue/registry";
import { flag } from "@/lib/flags";
import { SchedulePatchSchema } from "@/lib/site-crawler/schedule";
import { deleteSchedule, toScheduleDto, updateSchedule } from "@/lib/site-crawler/schedule-service";
import { crawlRouteError } from "@/lib/site-crawler/http";

type Ctx = { params: Promise<{ scheduleId: string }> };
const notFound = () => NextResponse.json({ error: "Schedule not found", code: "NOT_FOUND" }, { status: 404 });

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    if (!flag("crawl.schedule")) return notFound();
    const tenant = await requirePaidPlan();
    const { scheduleId } = await params;
    const parsed = SchedulePatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
    }
    const patch = parsed.data.exportTo && !flag("crawl.sheets") ? { ...parsed.data, exportTo: { ...parsed.data.exportTo, sheets: null } } : parsed.data;
    const row = await updateSchedule(tenant.tenantId, tenant.tenant.planType, scheduleId, patch, getQueue("site-crawl"));
    return row ? NextResponse.json(toScheduleDto(row)) : notFound();
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    if (!flag("crawl.schedule")) return notFound();
    const tenant = await requirePaidPlan();
    const { scheduleId } = await params;
    return (await deleteSchedule(tenant.tenantId, scheduleId, getQueue("site-crawl"))) ? new NextResponse(null, { status: 204 }) : notFound();
  } catch (err) {
    return crawlRouteError(err);
  }
}
