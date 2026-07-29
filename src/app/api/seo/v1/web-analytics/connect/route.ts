// GET /api/seo/v1/web-analytics/connect — start the Google OAuth flow.
// Paid + session gated; the state param is HMAC-signed and bound to the
// caller's tenant (lib/gsc/state.ts, shared by both Google integrations).
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { buildAuthUrl } from "@/lib/ga/client";
import { signState } from "@/lib/gsc/state";

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    return NextResponse.redirect(buildAuthUrl(signState(membership.tenantId)));
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
