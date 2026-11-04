/**
 * GET /api/seo/v1/crawl/sheets/connect — start "Connect Google Sheets"
 * (Phase 4c, crawl.sheets): the existing Google OAuth client, asking for
 * spreadsheets on top of Search Console (include_granted_scopes), with a
 * state signed for this tenant and the "sheets" purpose. The shared callback
 * (/api/ai/visibility/gsc/callback) stores the token and returns to /crawler.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { flag } from "@/lib/flags";
import { GSC_SCOPE, SHEETS_SCOPE, buildAuthUrl } from "@/lib/gsc/client";
import { signState } from "@/lib/gsc/state";
import { crawlRouteError } from "@/lib/site-crawler/http";

export async function GET() {
  try {
    if (!flag("crawl.sheets")) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const tenant = await requirePaidPlan();
    return NextResponse.redirect(buildAuthUrl(signState(tenant.tenantId, undefined, undefined, "sheets"), [GSC_SCOPE, SHEETS_SCOPE]));
  } catch (err) {
    return crawlRouteError(err);
  }
}
