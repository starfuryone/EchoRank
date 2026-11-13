// POST /api/billing/resume — undo a cancellation, any time before the period
// ends. One click on the Billing card; no body.
//
// 200 { ok, changed, state } — changed=false when it was not cancelling.
// 401 signed out · 403 wrong origin, or a role that cannot (OWNER/ADMIN can)
// 409 no plan subscription, already ended, period over (period_ended), or a
//     subscription that is not this tenant's · 502 Stripe unreachable.

import type { NextRequest } from "next/server";
import { billingActionRoute } from "@/lib/billing/action-route";
import { resumePlanSubscription } from "@/lib/billing/cancellation";

export async function POST(request: NextRequest) {
  return billingActionRoute(request, (actor) => resumePlanSubscription(actor));
}
