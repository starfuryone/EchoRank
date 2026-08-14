import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { isOpportunityStatus, setOpportunityStatus } from "@/lib/citation-opportunities/store";

/**
 * The ONLY write this tool performs: one opportunity's status.
 *
 * NO DELETE, and nothing else is writable. The scores, the how-to and the
 * classification are all recomputed by the weekly job from `sources`, so an
 * endpoint that let a client edit them would be an endpoint whose effects
 * vanish the following Monday. Status is the one field the job never overwrites
 * (see upsertOpportunities) and therefore the only one a customer can own.
 *
 * Removing a row is the job's business too: retireStaleOpportunities deletes
 * what has stopped qualifying, and DISMISSED is what "I do not want to see this
 * again" means here — it both hides the row and stops the sweep re-raising it,
 * which a delete would not, because next week's sweep would simply find the
 * domain again.
 *
 * SCOPED BY TENANT IN THE WHERE CLAUSE, not by a check-then-write. See
 * setOpportunityStatus: updateMany with tenantId in the filter cannot be raced
 * into touching another tenant's row, and a foreign id gets the same 404 a
 * genuinely missing one gets, so this cannot be used to probe for ids.
 *
 * GROWTH+ via requireFeature("advanced_analytics") — the same key the page
 * gates on. requireFeature and not hasFeature here: this is an API route, where
 * a 403 is the right shape, and the page is where a Starter tenant reads what
 * the tool does instead.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const membership = await requireTenant();
    await requireFeature("advanced_analytics");

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { status?: unknown };

    if (!isOpportunityStatus(body.status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }

    const updated = await setOpportunityStatus(membership.tenantId, id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    throw error;
  }
}
