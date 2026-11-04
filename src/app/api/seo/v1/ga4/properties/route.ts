/**
 * GET /api/seo/v1/ga4/properties — Settings → Integrations (Phase 4d,
 * crawl.ga4): the GA4 properties the tenant's Google connection can read
 * (Admin API accountSummaries), and the one picked.
 *
 *   200 { connected: true, properties: [{ id, name, account }], selected }
 *   200 { connected: false, connectHref }   no connection, or no Analytics access
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { flag } from "@/lib/flags";
import { getConnection, withAccessToken } from "@/lib/gsc/service";
import { listProperties } from "@/lib/ga4/client";
import { crawlRouteError } from "@/lib/site-crawler/http";

const CONNECT = "/api/seo/v1/ga4/connect";

export async function GET() {
  try {
    if (!flag("crawl.ga4")) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const tenant = await requirePaidPlan();
    const conn = await getConnection(tenant.tenantId);
    if (!conn || conn.status !== "ACTIVE") return NextResponse.json({ connected: false, connectHref: CONNECT });
    try {
      const properties = await withAccessToken(conn, (token) => listProperties(token));
      return NextResponse.json({
        connected: true,
        properties,
        selected: conn.ga4PropertyId ? { id: conn.ga4PropertyId, name: conn.ga4PropertyName } : null,
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "Ga4AccessError" || err.name === "GscReauthError")) {
        return NextResponse.json({ connected: false, connectHref: CONNECT });
      }
      throw err;
    }
  } catch (err) {
    return crawlRouteError(err);
  }
}
