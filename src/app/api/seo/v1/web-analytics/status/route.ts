// GET — connection status for the tool page. Includes the live property list
// only while no property is selected (the picker state). Never returns token
// material.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { getConnection, listPropertiesFor } from "@/lib/ga/service";
import { GaReauthError } from "@/lib/ga/client";
import { gaRouteError } from "@/lib/ga/http";
import type { GaConnectionStatusDto } from "@/lib/ga/types";

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const conn = await getConnection(membership.tenantId);
    if (!conn) return NextResponse.json({ connected: false } satisfies GaConnectionStatusDto);

    let properties: GaConnectionStatusDto["properties"];
    if (!conn.propertyId && conn.status === "ACTIVE") {
      try {
        properties = await listPropertiesFor(conn);
      } catch (err) {
        // A dead token during the picker step is a reconnect, not a 500.
        if (!(err instanceof GaReauthError)) throw err;
        return NextResponse.json({
          connected: true,
          status: "NEEDS_REAUTH",
          propertyId: null,
        } satisfies GaConnectionStatusDto);
      }
    }

    return NextResponse.json({
      connected: true,
      status: conn.status,
      propertyId: conn.propertyId,
      propertyName: conn.propertyName,
      connectedAt: conn.connectedAt.toISOString(),
      properties,
    } satisfies GaConnectionStatusDto);
  } catch (error) {
    return gaRouteError(error);
  }
}
