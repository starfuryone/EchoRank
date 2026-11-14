// GET /api/billing/status — the signed-in tenant's plan and billing state, for
// /welcome to poll while the Stripe webhook lands (PLAN-HUB Part 1).
//
// TENANT-SCOPED BY CONSTRUCTION: the tenant comes from requireTenant() (the
// session and its active-tenant cookie), never from the request. No id is
// accepted, so there is nothing to point at another tenant.
//
// FIVE FIELDS AND NOTHING ELSE. billingStatus is the effective status
// (getBillingContext: the PLAN Subscription row first, the tenant column
// otherwise). trialEnd is the row's period end while it is TRIALING (Stripe
// ends a trial's first period at trial_end) and null otherwise, so a client
// can tell a real Stripe trial from the column's legacy TRIALING default.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { getBillingContext } from "@/lib/paid-plan";

export const dynamic = "force-dynamic";

export async function GET() {
  let tenantId: string;
  try {
    tenantId = (await requireTenant()).tenantId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [tenant, billing, sub] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { planType: true } }),
    getBillingContext(tenantId),
    prisma.subscription.findUnique({
      where: { tenantId },
      select: { productKind: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    }),
  ]);
  const planRow = sub?.productKind === "PLAN" ? sub : null;
  return NextResponse.json(
    {
      planType: tenant?.planType ?? null,
      billingStatus: billing.status,
      trialEnd: planRow?.status === "TRIALING" ? (planRow.currentPeriodEnd?.toISOString() ?? null) : null,
      currentPeriodEnd: planRow?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: planRow?.cancelAtPeriodEnd ?? false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
