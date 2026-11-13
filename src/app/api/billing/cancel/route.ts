// POST /api/billing/cancel — cancel the tenant's own plan subscription at the
// end of its period (trial or paid). Body, optional: { reason?, note? }.
//
// 200 { ok, changed, state } — changed=false when it was already cancelling.
// 401 signed out · 403 wrong origin, or a role that cannot (OWNER/ADMIN can)
// 409 no plan subscription (carries billingStatus), already ended, or a
//     subscription that is not this tenant's · 502 Stripe unreachable.
//
// The logic is src/lib/billing/cancellation.ts; this file is the HTTP shell.

import type { NextRequest } from "next/server";
import { billingActionRoute } from "@/lib/billing/action-route";
import { cancelPlanSubscription } from "@/lib/billing/cancellation";
import { parseCancelInput } from "@/lib/billing/cancel-reasons";

export async function POST(request: NextRequest) {
  return billingActionRoute(request, (actor, body) => cancelPlanSubscription(actor, parseCancelInput(body)));
}
