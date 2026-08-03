/**
 * GET /api/ai/visibility/historical/timeline — checks for one stored query.
 * Query: keyword, locationCode, languageCode, device.
 *
 * READ-ONLY OVER EXISTING ROWS. This is the v1 promise made concrete: the
 * handler touches SerpCheck and nothing else, so browsing history can never
 * post a DataForSEO task or spend a cent. Running a fresh check is a link to
 * SERP Checker, not a button here.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { loadCheckTimeline } from "@/lib/historical/page-data";
import { historicalRouteError } from "@/lib/historical/http";

const QuerySchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  locationCode: z.coerce.number().int(),
  languageCode: z.string().trim().min(2).max(8),
  device: z.enum(["desktop", "mobile"]),
});

export async function GET(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = QuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }
    return NextResponse.json(await loadCheckTimeline(tenant.tenantId, parsed.data));
  } catch (err) {
    return historicalRouteError(err);
  }
}
