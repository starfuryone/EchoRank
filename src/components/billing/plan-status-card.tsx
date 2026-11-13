"use client";

// The Billing page's plan card (CANCEL-FAIR-PLAY).
//
// FAIR-PLAY RULES THIS COMPONENT HOLDS:
// - Cancel is a first-class button, the same size and weight as the other
//   one on the card (both outline, both md). Never in a menu, never only in
//   the Stripe portal, never greyed out.
// - Cancel is a LINK to /billing/cancel, the confirmation page: two clicks
//   from here to cancelled, and back/forward work.
// - Resume is one click, a POST, while the period lasts.
// - The state line always says what is true, with the date
//   (src/lib/billing/plan-card-state.ts).
// - A role that cannot cancel sees who can, not a disabled button.
//
// Presentational: the page owns the fetches. That is what lets a test render
// every state without a network.

import { CreditCard } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BillingCopy, DashLocale } from "@/lib/i18n/dashboard";
import { formatPeriodDate, planCardAction, type PlanCardState } from "@/lib/billing/plan-card-state";

/** Button variant="outline" size="md", for a Link. Same box, same weight. */
export const OUTLINE_BUTTON_CLASS =
  "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500 px-4 py-2 text-sm";

export interface PlanStatusCardProps {
  locale: DashLocale;
  t: BillingCopy;
  state: PlanCardState;
  /** Raw status, for the badge. */
  status: string;
  planLabel: string;
  /** The charge with its interval ("$15/month"), or a node (Contact us), or null. */
  price: React.ReactNode;
  /** The same charge as plain text for the state sentence; null when unknown. */
  priceText: string | null;
  /** ISO: trial end, renewal, or the day access ends. */
  periodEnd: string | null;
  canManage: boolean;
  ownerName: string | null;
  /** Show "Payment method & invoices": the tenant has a Stripe customer. */
  hasPortal: boolean;
  onPortal: () => void;
  portalBusy: boolean;
  portalError: boolean;
  onResume: () => void;
  resumeBusy: boolean;
  resumeError: boolean;
  cancelHelpHref: string | null;
}

export function PlanStatusCard(p: PlanStatusCardProps) {
  const { t, state } = p;
  const date = p.periodEnd ? formatPeriodDate(p.periodEnd, p.locale) : null;
  const action = planCardAction(state);

  let line: string | null = null;
  if (state === "trial" && date) line = t.stateTrial(date, p.priceText);
  else if (state === "renewing") line = t.stateRenewing(p.priceText, date) || null;
  else if (state === "cancelling" && date) line = t.stateCancelling(date);
  else if (state === "ended") line = t.stateEnded(date);
  else if (state === "past_due") line = t.statePastDue;

  const badgeVariant = state === "renewing" || state === "trial" ? "success" : "warning";
  const badgeLabel = state === "cancelling" ? t.cancellingBadge : (t.statusLabels[p.status] ?? p.status);

  return (
    <Card data-testid="billing-plan-card" data-state={state}>
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <CreditCard className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{t.planTitle(p.planLabel)}</h2>
              <Badge variant={badgeVariant}>{badgeLabel}</Badge>
            </div>
            {/* The price sits on its own line only when the state sentence
                does not already carry it. */}
            {p.price && !p.priceText && <p className="text-sm text-gray-500">{p.price}</p>}
            {line && (
              <p className="mt-1 text-sm text-gray-700" data-testid="billing-plan-state">
                {line}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {p.canManage && action === "cancel" && (
              <Link href="/billing/cancel" className={OUTLINE_BUTTON_CLASS} data-testid="billing-cancel">
                {t.cancelSubscription}
              </Link>
            )}
            {p.canManage && action === "resume" && (
              <Button variant="outline" onClick={p.onResume} loading={p.resumeBusy} data-testid="billing-resume">
                {t.resumeSubscription}
              </Button>
            )}
            {p.canManage && p.hasPortal && (
              <Button variant="outline" onClick={p.onPortal} disabled={p.portalBusy} data-testid="billing-portal">
                {t.paymentAndInvoices}
              </Button>
            )}
            {state === "ended" && (
              <a href="#plans" className={OUTLINE_BUTTON_CLASS}>
                {t.stateEndedCta}
              </a>
            )}
          </div>
          {!p.canManage && action && (
            <p className="mt-2 text-sm text-gray-600" data-testid="billing-owner-only">
              {t.ownerOnly(p.ownerName)}
            </p>
          )}
          {/* The full walkthrough, next to the buttons it walks through.
              Public page, so it opens in a new tab rather than dropping
              someone out of the dashboard mid-cancellation — and the slug
              comes from the help-content route map, so a renamed article
              breaks a test instead of this link. */}
          {p.cancelHelpHref && (
            <p className="mt-2 text-xs text-gray-500">
              <a
                href={p.cancelHelpHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
              >
                {t.cancellationHelp}
              </a>
            </p>
          )}
          {p.portalError && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {t.manageSubscriptionError}
            </p>
          )}
          {p.resumeError && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {t.resumeError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
