// /plan — "Your plan" (PLAN-HUB Part 2): everything the plan includes, with
// working links, limits and usage, billing status and the subscription
// controls. Reachable every day, not only after checkout: the account menu,
// /billing, /settings/account and the /help hub link here.
//
// ACCESS: inside (dashboard), so the layout's gates apply — signed in, a NONE
// tenant is sent to /pricing (it has no plan to show), and the page is in the
// "account" area every plan opens (src/lib/plan-access.ts).
//
// The page LOADS; <PlanHub> renders. What is included comes from
// getPlanResources() (src/lib/plan-resources.ts), usage from the tools' own
// counters (src/lib/plan-usage.ts), billing from the Subscription row and its
// own Stripe price.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { PLAN_HUB_COPY } from "@/lib/i18n/plan-hub";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getBillingContext, isPaidStatus } from "@/lib/paid-plan";
import { getPlanResources } from "@/lib/plan-resources";
import { loadPlanBilling, loadPlanUsage } from "@/lib/plan-usage";
import { tenantRollouts } from "@/lib/rollouts-server";
import { getOnboardingSnapshot } from "@/lib/onboarding";
import { planCardState } from "@/lib/billing/plan-card-state";
import { canCancelSubscription, canManageBilling } from "@/lib/billing/billing-roles";
import { billingOwnerName } from "@/lib/billing/cancellation";
import { getEnterpriseContact } from "@/lib/plan-config";
import { PlanHub } from "@/components/plan-hub/plan-hub";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  if (!membership) redirect("/login?callbackUrl=%2Fplan");
  const { tenantId, userId } = membership;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { planType: true, monthlyRequestLimit: true, billingStatus: true, stripeCustomerId: true },
  });
  if (!tenant) redirect("/login?callbackUrl=%2Fplan");
  const plan = tenant.planType;

  const resources = getPlanResources(plan, {
    rollouts: tenantRollouts(tenantId),
    monthlyRequestLimit: tenant.monthlyRequestLimit,
  });
  const canManage = canManageBilling(membership.role);
  // Cancel and resume: the OWNER only. Everyone else is told who can.
  const canCancel = canCancelSubscription(membership.role);

  const [usage, billing, context, onboarding, ownerName] = await Promise.all([
    loadPlanUsage(tenantId, plan, resources.limits),
    loadPlanBilling(tenantId, tenant.stripeCustomerId, tenant.billingStatus),
    getBillingContext(tenantId),
    getOnboardingSnapshot(tenantId, userId).catch(() => null),
    canCancel ? Promise.resolve(null) : billingOwnerName(tenantId).catch(() => null),
  ]);

  const { welcome } = await searchParams;
  // The banner is for the moment a checkout lands: shown only on
  // ?welcome=1 AND when the plan really is paid now, so a hand-typed
  // ?welcome=1 on a lapsed plan says nothing untrue.
  const paid = isPaidStatus(context.status, context.hasSubscriptionRow);

  return (
    <PlanHub
      locale={locale}
      t={PLAN_HUB_COPY[locale]}
      plan={plan}
      resources={resources}
      usage={usage}
      billing={{
        state: planCardState({ status: billing.status, cancelAtPeriodEnd: billing.cancelAtPeriodEnd }),
        periodEnd: billing.currentPeriodEnd,
        charge: billing.charge,
        hasPortal: billing.hasPortal,
        hasSubscription: billing.hasSubscription,
      }}
      canManage={canManage}
      canCancel={canCancel}
      ownerName={ownerName}
      welcome={welcome === "1" && paid}
      steps={onboarding?.steps ?? []}
      enterpriseEmail={plan === "ENTERPRISE" ? getEnterpriseContact().email : null}
    />
  );
}
