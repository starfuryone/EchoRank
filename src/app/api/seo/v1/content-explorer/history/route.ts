/**
 * GET /api/seo/v1/content-explorer/history — past searches for this tenant,
 * plus the live usage block the page header renders.
 *
 * Free: reads stored rows only, no upstream call, no quota consumption.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { listSearches } from "@/lib/content-explorer/service";
import { contentRouteError } from "@/lib/content-explorer/http";
import { buildUsage } from "@/lib/content-explorer/usage";

const HISTORY_LIMIT = 20;

export async function GET() {
  try {
    const tenant = await requirePaidPlan();
    const [searches, usage] = await Promise.all([
      listSearches(tenant.tenantId, HISTORY_LIMIT),
      buildUsage(tenant.tenantId, tenant.tenant.planType),
    ]);
    return NextResponse.json({ searches, usage });
  } catch (err) {
    return contentRouteError(err);
  }
}
