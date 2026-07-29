/**
 * GET /api/seo/v1/web-analytics/report?range=7|28|90[&force=1] — the five
 * panels for one date range.
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → range
 * validation → connection + property check → 1 h Redis cache → hourly
 * per-tenant rate limit → GA4.
 *
 * The rate limit is checked AFTER the cache on purpose: a cached read costs
 * GA4 nothing, so it must not consume an allowance meant to protect the
 * property's API quota.
 *
 * There is no plan gate beyond "paid": this is the tenant's OWN analytics data
 * and the GA4 API is free.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { getConnection, getReport } from "@/lib/ga/service";
import { gaRouteError } from "@/lib/ga/http";
import {
  DEFAULT_RANGE,
  REPORTS_PER_HOUR,
  REPORT_WINDOW_MS,
  isGaRange,
} from "@/lib/ga/options";

/** A cold 90-day report is five concurrent GA4 reads; give it room. */
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const membership = await requirePaidPlan();

    // new URL(request.url) rather than request.nextUrl: the standard property
    // works for both a plain Request and Next's NextRequest, so the handler is
    // directly callable from tests without constructing a framework object.
    const params = new URL(request.url).searchParams;
    const raw = Number(params.get("range"));
    const range = isGaRange(raw) ? raw : DEFAULT_RANGE;
    const force = params.get("force") === "1";

    const conn = await getConnection(membership.tenantId);
    if (!conn) {
      return NextResponse.json({ error: "Not connected", code: "NOT_CONNECTED" }, { status: 409 });
    }
    if (conn.status === "NEEDS_REAUTH") {
      return NextResponse.json(
        { error: "Reconnect required", code: "NEEDS_REAUTH" },
        { status: 409 },
      );
    }
    if (!conn.propertyId) {
      return NextResponse.json(
        { error: "No Analytics property selected", code: "NO_PROPERTY" },
        { status: 400 },
      );
    }

    // Only a build that will actually hit GA4 takes a slot.
    if (force) {
      const limited = await rateLimit(
        `web-analytics:${membership.tenantId}`,
        REPORTS_PER_HOUR,
        REPORT_WINDOW_MS,
      );
      if (!limited.success) {
        return NextResponse.json(
          {
            error: "Too many refreshes this hour. The data updates hourly anyway.",
            code: "RATE_LIMITED",
            limit: REPORTS_PER_HOUR,
          },
          { status: 429 },
        );
      }
    }

    const report = await getReport(conn, range, { force });

    // A cache miss also hit GA4, so it should count — but only after the fact,
    // so a warm read never spends a slot.
    if (!force && !report.cached) {
      await rateLimit(
        `web-analytics:${membership.tenantId}`,
        REPORTS_PER_HOUR,
        REPORT_WINDOW_MS,
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    return gaRouteError(error);
  }
}
