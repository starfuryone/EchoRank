// POST {propertyId} — pick a GA4 property. Validated against the tenant's own
// live property list, so an arbitrary propertyId cannot be attached to a
// connection the caller does not actually have access to.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { getConnection, listPropertiesFor, selectProperty } from "@/lib/ga/service";
import { gaRouteError } from "@/lib/ga/http";

export async function POST(request: Request) {
  try {
    const membership = await requirePaidPlan();
    const conn = await getConnection(membership.tenantId);
    if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === "string" ? body.propertyId : "";

    const properties = await listPropertiesFor(conn);
    const match = properties.find((p) => p.propertyId === propertyId);
    if (!match) {
      return NextResponse.json({ error: "invalid_property" }, { status: 400 });
    }

    await selectProperty(membership.tenantId, match.propertyId, match.displayName);
    return NextResponse.json({ ok: true, propertyId: match.propertyId, propertyName: match.displayName });
  } catch (error) {
    return gaRouteError(error);
  }
}
