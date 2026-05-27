import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/utils";
import type { PlanType } from "@/generated/prisma";

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

    const planKey = tenant.planType as PlanType;
    const limits = PLAN_LIMITS[planKey];
    const price = PLAN_PRICES[planKey];

    const currentPeriodStart = subscription?.currentPeriodStart || null;
    const currentPeriodEnd = subscription?.currentPeriodEnd || null;

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
