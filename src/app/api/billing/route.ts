import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PLAN_LIMITS, PLAN_PRICES, sellablePlan } from "@/lib/plan-config";
import type { PlanType } from "@/generated/prisma";
import { planAllowsArea } from "@/lib/plan-access";
import { pageAllowance } from "@/lib/site-crawler/page-allowance";
import { urlCapForPlan } from "@/lib/site-crawler/quota";
import { chargeForPrice } from "@/lib/billing/subscription-charge";
import { effectiveFeedbackLimit, feedbackRequestsThisMonth } from "@/lib/feedback-limit";

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
    // What THIS subscription is charged, from its own Stripe price: a
    // subscriber from before the 2026-11-11 price change keeps their price,
    // which `price` (the one on sale) is not. null when Stripe cannot say; the
    // page then shows the config price only when it is the one being charged.
    const answer = subscription?.stripePriceId ? await chargeForPrice(subscription.stripePriceId) : null;
    const charge = answer?.kind === "charge" ? answer.charge : null;
    const chargeIsConfig = answer?.kind === "config";

    const currentPeriodStart = subscription?.currentPeriodStart || null;
    const currentPeriodEnd = subscription?.currentPeriodEnd || null;

    // The site crawler's monthly page allowance (calendar month, UTC), for the
    // plans that include the crawler; null for the AI-only plan. A failed
    // read leaves the row out rather than failing the billing page.
    const crawlPages = planAllowsArea(tenant.planType as PlanType, "crawler") && urlCapForPlan(tenant.planType as PlanType) > 0
      ? await pageAllowance(tenantId, tenant.planType as PlanType).catch(() => null)
      : null;

    // FEEDBACK REQUESTS ARE A REPUTATION FEATURE. A plan without that area
    // (the AI-only plan, the crawler-only plan) gets no meter: "0 / 10,000"
    // on a plan that cannot send one is a limit for something not bought.
    // Limit and count come from src/lib/feedback-limit.ts, the same helpers
    // POST /api/feedback enforces with: the plan's maxRequestsPerMonth (the
    // stored per-tenant value for Enterprise only), this calendar month (UTC).
    const feedbackIncluded = planAllowsArea(tenant.planType as PlanType, "reputation");
    const feedbackLimit = effectiveFeedbackLimit(tenant);
    const feedbackThisPeriod = feedbackIncluded ? await feedbackRequestsThisMonth(tenantId) : 0;

    return NextResponse.json({
      plan: {
        type: tenant.planType,
        status: subscription?.status || tenant.billingStatus,
        price,
        limits,
        charge,
        chargeIsConfig,
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
        feedbackIncluded,
        feedbackSent: feedbackThisPeriod,
        feedbackLimit,
        percentUsed: feedbackLimit > 0 ? Math.round((feedbackThisPeriod / feedbackLimit) * 100) : 0,
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
