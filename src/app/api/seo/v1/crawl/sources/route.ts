/**
 * GET /api/seo/v1/crawl/sources?host=… — the start card's "Add data" lines
 * (Phase 4d): whether the tenant's Search Console property covers this host,
 * and (crawl.ga4) which GA4 property crawls will join. Reads the tenant's
 * own connection only; no Google call.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { flag } from "@/lib/flags";
import { getConnection } from "@/lib/gsc/service";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { propertyCovers } from "@/lib/site-crawler/gsc-join";

export async function GET(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const host = (new URL(request.url).searchParams.get("host") ?? "").trim().toLowerCase();
    const conn = await getConnection(tenant.tenantId);
    const active = conn?.status === "ACTIVE";
    return NextResponse.json({
      gsc: flag("crawl.gsc")
        ? { connected: active, property: conn?.siteUrl ?? null, covers: Boolean(active && conn?.siteUrl && host && propertyCovers(conn.siteUrl, `https://${host}/`)) }
        : null,
      ga4: flag("crawl.ga4") ? { connected: active, property: conn?.ga4PropertyName ?? conn?.ga4PropertyId ?? null } : null,
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
