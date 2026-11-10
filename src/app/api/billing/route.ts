import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PLAN_LIMITS, PLAN_PRICES, sellablePlan } from "@/lib/plan-config";
import type { PlanType } from "@/generated/prisma";
import { planAllowsArea } from "@/lib/plan-access";
import { pageAllowance } from "@/lib/site-crawler/page-allowance";
import { urlCapForPlan } from "@/lib/site-crawler/quota";

export async function GET() {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        planType: true,
        billingStatus: true,
        monthlyRequestLimit: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    const planKey = sellablePlan(tenant.planType as PlanType);
    const limits = PLAN_LIMITS[planKey];
    const price = PLAN_PRICES[planKey];

    const currentPeriodStart = subscription?.currentPeriodStart || null;
    const currentPeriodEnd = subscription?.currentPeriodEnd || null;

    // The site crawler's monthly page allowance (calendar month, UTC), for the
    // plans that include the crawler; null for the AI-only plan. A failed
    // read leaves the row out rather than failing the billing page.
    const crawlPages = planAllowsArea(tenant.planType as PlanType, "crawler") && urlCapForPlan(tenant.planType as PlanType) > 0
      ? await pageAllowance(tenantId, tenant.planType as PlanType).catch(() => null)
      : null;

    const feedbackThisPeriod = await prisma.feedback.count({
      where: {
        tenantId,
        createdAt: currentPeriodStart
          ? { gte: currentPeriodStart }
          : undefined,
      },
    });

    return NextResponse.json({
      plan: {
        type: tenant.planType,
        status: subscription?.status || tenant.billingStatus,
        price,
        limits,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      usage: {
        feedbackSent: feedbackThisPeriod,
        feedbackLimit: tenant.monthlyRequestLimit,
        percentUsed:
          tenant.monthlyRequestLimit > 0
            ? Math.round(
                (feedbackThisPeriod / tenant.monthlyRequestLimit) * 100
              )
            : 0,
        crawlPages,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching billing info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
