// POST /api/echopilot/click — the CTA on "Social posting, by EchoPilot"
// (/visibility/tools/social-posting) was clicked. Records one partner_clicks
// row (workspace, plan, time) so staff can see demand at /admin. Paid-gated
// like the page; every paid plan, the AI-only one included (plan-access.ts).
// The browser opens EchoPilot whether or not this succeeds.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { recordEchopilotClick } from "@/lib/echopilot-clicks";

export async function POST() {
  try {
    const membership = await requirePaidPlan();
    await recordEchopilotClick(membership.tenantId, membership.tenant.planType);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[echopilot click]", (error as Error)?.message ?? error);
    return NextResponse.json({ error: "Could not record the click." }, { status: 500 });
  }
}
