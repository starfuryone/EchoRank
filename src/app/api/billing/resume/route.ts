// POST /api/billing/resume — the tenant's OWNER undoes a cancellation, any
// time before the period ends. No body; the tenant is the session's.
//
// 200 { ok, changed, state } — changed=false when it was not cancelling.
// 401 signed out · 403 wrong origin, or not the OWNER (with ownerName)
// 409 no plan subscription, already ended, period over (period_ended), or a
//     subscription that is not this tenant's · 429 rate limited
// 502 Stripe unreachable.

import type { NextRequest } from "next/server";
import { billingActionRoute } from "@/lib/billing/action-route";
import { resumeTenantSubscription } from "@/lib/billing/cancellation";

export async function POST(request: NextRequest) {
  return billingActionRoute(request, (m) =>
    resumeTenantSubscription(m.tenantId, { kind: "member", userId: m.userId, role: m.role, ipAddress: m.ipAddress }),
  );
}
