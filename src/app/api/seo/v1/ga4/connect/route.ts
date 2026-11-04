/**
 * GET /api/seo/v1/ga4/connect — "Connect Google Analytics" (Phase 4d,
 * crawl.ga4): the existing Google OAuth client, asking for analytics.readonly
 * on top of Search Console (include_granted_scopes keeps Sheets too), with a
 * state signed for this tenant and the "ga4" purpose. The shared callback
 * stores the token and returns to /settings to pick a property.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { flag } from "@/lib/flags";
import { GSC_SCOPE, buildAuthUrl } from "@/lib/gsc/client";
import { ANALYTICS_SCOPE } from "@/lib/ga4/client";
import { signState } from "@/lib/gsc/state";
import { crawlRouteError } from "@/lib/site-crawler/http";

export async function GET() {
  try {
    if (!flag("crawl.ga4")) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const tenant = await requirePaidPlan();
    return NextResponse.redirect(buildAuthUrl(signState(tenant.tenantId, undefined, undefined, "ga4"), [GSC_SCOPE, ANALYTICS_SCOPE]));
  } catch (err) {
    return crawlRouteError(err);
  }
}
