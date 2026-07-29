// POST — delete the connection. The encrypted refresh token goes with the row
// and the cached reports are dropped, so nothing survives a disconnect.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { disconnect } from "@/lib/ga/service";
import { gaRouteError } from "@/lib/ga/http";

export async function POST() {
  try {
    const membership = await requirePaidPlan();
    await disconnect(membership.tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return gaRouteError(error);
  }
}
