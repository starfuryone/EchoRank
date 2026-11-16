// POST /api/billing/cancel — the tenant's OWNER cancels its own plan
// subscription at the end of its period (trial or paid). Body, optional:
// { reason?, note? }. Never a tenant id: the tenant is the session's.
//
// 200 { ok, changed, state } — changed=false when it was already cancelling.
// 401 signed out · 403 wrong origin, or not the OWNER (with ownerName)
// 409 no plan subscription (carries billingStatus), already ended, or a
//     subscription that is not this tenant's · 429 rate limited
// 502 Stripe unreachable.
//
// The logic is cancelTenantSubscription (src/lib/billing/cancellation.ts);
// this file is the HTTP shell.

import type { NextRequest } from "next/server";
import { billingActionRoute } from "@/lib/billing/action-route";
import { cancelTenantSubscription } from "@/lib/billing/cancellation";
import { parseCancelInput } from "@/lib/billing/cancel-reasons";

export async function POST(request: NextRequest) {
  return billingActionRoute(request, (m, body) =>
    cancelTenantSubscription(m.tenantId, {
      when: "period_end",
      actor: { kind: "member", userId: m.userId, role: m.role, ipAddress: m.ipAddress },
      reason: parseCancelInput(body),
    }),
  );
}
