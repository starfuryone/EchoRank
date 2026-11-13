// /billing/cancel — the confirmation page (CANCEL-FAIR-PLAY).
//
// Click 1 is "Cancel subscription" on the Billing card, which links here.
// Click 2 is the button on this page. There is no third: no "are you sure",
// no offer, no countdown, no "contact us". The reason is optional.
//
// A PAGE, NOT A MODAL, so it works on a phone, survives a reload and honours
// back/forward. Every fact on it is read from the tenant's own Subscription
// row here, server-side: the date is the period (or trial) end Stripe sent,
// never a typed one, and "won't be charged" vs "won't be charged again"
// follows from whether it is a trial.
//
// NO DATA-RETENTION LINE: there is no retention setting for cancelled
// tenants to quote (Phase 0, 2026-11-13), and a number made up here would be
// a promise nothing enforces.

import Link from "next/link";
import { cookies } from "next/headers";
import { BILLING_COPY, dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plan-config";
import { canManageBilling } from "@/lib/billing/billing-roles";
import { billingOwnerName } from "@/lib/billing/cancellation";
import { formatPeriodDate, planCardState } from "@/lib/billing/plan-card-state";
import { CANCEL_REASONS } from "@/lib/billing/cancel-reasons";
import { CancelForm } from "./cancel-form";

export default async function BillingCancelPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const t = BILLING_COPY[locale];
  const membership = await getCurrentTenant();

  const back = (
    <Link href="/billing" className="text-sm font-medium text-blue-600 hover:text-blue-700">
      {t.backToBilling}
    </Link>
  );
  const notice = (message: string) => (
    <div className="mx-auto max-w-xl space-y-4 py-8" data-testid="billing-cancel-notice">
      <p className="text-base text-gray-700">{message}</p>
      {back}
    </div>
  );

  if (!membership) return notice(t.cancelNothing);
  if (!canManageBilling(membership.role)) {
    return notice(t.ownerOnly(await billingOwnerName(membership.tenantId)));
  }

  const row = await prisma.subscription.findUnique({
    where: { tenantId: membership.tenantId },
    select: { productKind: true, planType: true, status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, stripeSubscriptionId: true },
  });
  if (!row || row.productKind !== "PLAN" || !row.stripeSubscriptionId) return notice(t.cancelNothing);

  const state = planCardState({ status: row.status, cancelAtPeriodEnd: row.cancelAtPeriodEnd });
  const date = row.currentPeriodEnd ? formatPeriodDate(row.currentPeriodEnd, locale) : null;
  if (state === "ended" || state === "none") return notice(t.cancelNothing);
  if (state === "cancelling") return notice(date ? t.cancelAlready(date) : t.cancelNothing);

  const plan = planConfig(row.planType).name;
  const trial = state === "trial";

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4" data-testid="billing-cancel-page">
      <h1 className="text-2xl font-bold text-gray-900">{t.cancelPageTitle(plan)}</h1>
      <ul className="space-y-2 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-800" data-testid="billing-cancel-facts">
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-green-600">✓</span>
          {trial ? t.factNoChargeTrial : t.factNoChargePaid}
        </li>
        {date && (
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-green-600">✓</span>
            {t.factAccess(date)}
          </li>
        )}
        {date && (
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-green-600">✓</span>
            {t.factResume(date)}
          </li>
        )}
      </ul>
      <CancelForm
        reasons={CANCEL_REASONS.map((value) => ({ value, label: t.reasons[value] ?? value }))}
        copy={{
          reasonLabel: t.reasonLabel,
          reasonPlaceholder: t.reasonPlaceholder,
          noteLabel: t.noteLabel,
          confirm: t.confirmCancel,
          busy: t.cancelBusy,
          keep: t.keepPlan,
          error: t.cancelError,
        }}
      />
    </div>
  );
}
