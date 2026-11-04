/**
 * POST /api/seo/v1/crawl/schedules/[scheduleId]/run — "Run now" on the
 * Schedules view: start this schedule's crawl immediately, exactly as its
 * tick would (runScheduledCrawl: plan lock and monthly quota checked, the
 * sealed configuration re-validated, the crawl tagged with the schedule so
 * its email, Sheets export and compare follow).
 *
 *   202 { status: "started", crawlJobId }
 *   409 { code: "SCHEDULE_SKIPPED", reason } — paused, locked, out of crawls,
 *       or a configuration / URL the checks now refuse.
 *
 * Rate-limited with crawl starts (same key). Tenant-scoped: the schedule is
 * read on { id, tenantId } before anything runs.
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { runScheduledCrawl } from "@/lib/site-crawler/schedule-service";
import { START_RATE_LIMIT, START_RATE_WINDOW_MS, startRateKey } from "@/lib/site-crawler/start-body";

type Ctx = { params: Promise<{ scheduleId: string }> };
const notFound = () => NextResponse.json({ error: "Schedule not found", code: "NOT_FOUND" }, { status: 404 });

export async function POST(_request: Request, { params }: Ctx) {
  try {
    if (!flag("crawl.schedule")) return notFound();
    const tenant = await requirePaidPlan();
    const { scheduleId } = await params;
    const owned = await prisma.crawlSchedule.findFirst({ where: { id: scheduleId, tenantId: tenant.tenantId }, select: { id: true } });
    if (!owned) return notFound();

    const limited = await rateLimit(startRateKey(tenant.tenantId), START_RATE_LIMIT, START_RATE_WINDOW_MS);
    if (!limited.success) {
      return NextResponse.json({ error: "Too many crawls in a row. Wait a minute.", code: "RATE_LIMITED" }, { status: 429 });
    }

    const out = await runScheduledCrawl(owned.id);
    return out.status === "started"
      ? NextResponse.json(out, { status: 202 })
      : NextResponse.json({ error: "Schedule not run", code: "SCHEDULE_SKIPPED", reason: out.reason }, { status: 409 });
  } catch (err) {
    return crawlRouteError(err);
  }
}
