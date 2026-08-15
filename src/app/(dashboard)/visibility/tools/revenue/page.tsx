// AI Revenue — what the answers earned, and what the gap to the top rival costs.
//
// ── Gating ──────────────────────────────────────────────────────────────────
// PAID, from ../layout.tsx, which wraps every /visibility/tools/* route and
// renders UpgradeState for a tenant whose billing status is not active. That is
// the whole gate: no feature key on top of it, because this page reads data the
// tenant's own attribution tag and share-of-voice rollup already produced, and
// there is no tier at which those exist but this may not be read.
//
// There is no API route behind this page — the read is server-side and the two
// filters are query-string params — so there is no second gate to keep in step.
// The one write path the feature has is on /settings/account, and it enforces
// requireTenant() itself.
//
// This tool spends nothing upstream. Every number comes from ai_visits and
// sov_snapshots rows other features already wrote, so there is no costUsd to
// log and no quota to render.
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  currentMonth,
  emptyRevenuePageData,
  loadRevenuePageData,
} from "@/lib/revenue/page-data";
import { RevenueClient } from "@/components/seo-tools/revenue-client";

/**
 * What the money figures are denominated in.
 *
 * Read from the tenant's Stripe price, because `avgSaleValue` is documented to
 * the customer as "in your billing currency" and rendering their input with a
 * dollar sign they never chose would be a quiet lie about the number. USD when
 * there is no subscription row — trials and manual accounts are real, and a
 * page that refuses to render without one would be broken for exactly the
 * tenants most likely to be evaluating it.
 */
async function billingCurrency(tenantId: string): Promise<string> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    select: { stripePriceId: true },
  });
  if (!subscription?.stripePriceId) return "USD";

  const price = await prisma.stripePrice.findUnique({
    where: { stripePriceId: subscription.stripePriceId },
    select: { currency: true },
  });
  return price?.currency?.toUpperCase() || "USD";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; model?: string }>;
}) {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  const params = await searchParams;

  if (!membership) {
    return (
      <RevenueClient
        locale={locale}
        data={emptyRevenuePageData(currentMonth(), "last")}
        currency="USD"
      />
    );
  }

  const [data, currency] = await Promise.all([
    loadRevenuePageData(membership.tenantId, {
      month: params.month ?? null,
      model: params.model ?? null,
    }),
    billingCurrency(membership.tenantId),
  ]);

  return <RevenueClient locale={locale} data={data} currency={currency} />;
}
