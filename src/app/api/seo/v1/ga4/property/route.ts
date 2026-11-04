/**
 * /api/seo/v1/ga4/property — pick or clear the GA4 property the crawler
 * joins (Phase 4d, crawl.ga4).
 *
 *   PUT { propertyId } → 200 { selected } — only a property the tenant's own
 *       Google connection lists (re-read from the Admin API, never trusted
 *       from the request).
 *   DELETE → 204
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { flag } from "@/lib/flags";
import { getConnection, selectGa4Property, withAccessToken } from "@/lib/gsc/service";
import { listProperties } from "@/lib/ga4/client";
import { crawlRouteError } from "@/lib/site-crawler/http";

const BodySchema = z.object({ propertyId: z.string().regex(/^properties\/\d{1,20}$/) });
const off = () => NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

export async function PUT(request: Request) {
  try {
    if (!flag("crawl.ga4")) return off();
    const tenant = await requirePaidPlan();
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid property", code: "INVALID_REQUEST" }, { status: 400 });
    const conn = await getConnection(tenant.tenantId);
    if (!conn || conn.status !== "ACTIVE") return NextResponse.json({ error: "Connect Google Analytics first.", code: "GA4_NOT_CONNECTED" }, { status: 409 });
    const property = (await withAccessToken(conn, (token) => listProperties(token))).find((p) => p.id === parsed.data.propertyId);
    if (!property) return NextResponse.json({ error: "That property is not available to this Google account.", code: "INVALID_REQUEST" }, { status: 400 });
    await selectGa4Property(tenant.tenantId, { id: property.id, name: property.name });
    return NextResponse.json({ selected: { id: property.id, name: property.name } });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function DELETE() {
  try {
    if (!flag("crawl.ga4")) return off();
    const tenant = await requirePaidPlan();
    const conn = await getConnection(tenant.tenantId);
    if (conn) await selectGa4Property(tenant.tenantId, null);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return crawlRouteError(err);
  }
}
