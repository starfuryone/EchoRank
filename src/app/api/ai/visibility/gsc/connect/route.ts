// GET /api/ai/visibility/gsc/connect — start the OAuth flow. Paid + session
// gated; the state param is HMAC-signed and bound to the caller's tenant.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { buildAuthUrl } from "@/lib/gsc/client";
import { signState } from "@/lib/gsc/state";

// ?from=settings: started from Settings → Integrations (the crawler-only
// plan's Search Console panel); the callback returns there, not to the tool.
export async function GET(request: Request) {
  try {
    const membership = await requirePaidPlan();
    const fromSettings = new URL(request.url).searchParams.get("from") === "settings";
    const state = signState(membership.tenantId, undefined, undefined, fromSettings ? "gsc_settings" : "gsc");
    return NextResponse.redirect(buildAuthUrl(state));
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
