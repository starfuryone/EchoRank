"use client";

// The plan cards, shared by /billing and any other in-app surface that shows
// the tier comparison. The public homepage does NOT use this — there is no
// session there, so there is no current plan to mark.
//
// NOTHING HERE WRITES planType. Upgrades go through Stripe Checkout and the
// tenant's tier changes only when the signed webhook says so. The old
// window.confirm() flip that POSTed a plan name is gone.

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLAN_CONFIGS, PLAN_PRICES } from "@/lib/plan-config";
import type { PlanType } from "@/generated/prisma";
import type { BillingCopy, DashLocale } from "@/lib/i18n/dashboard";
import type { BillingInterval } from "@/lib/stripe/lookup-keys";
import { planCardAction, tierKeyFor } from "./plan-actions";
import s from "./plan-cards.module.css";

/** Product names stay English in every locale, as elsewhere in the app. */
const PLAN_LABELS: Record<string, string> = {
  AI_VISIBILITY: "AI Visibility",
  STARTER: "Starter",
  GROWTH: "Growth",
  AGENCY: "Agency",
  ENTERPRISE: "Enterprise",
};

export interface PlanCardsProps {
  /** Tenant.planType, read server-side. Never inferred in the browser. */
  currentPlan: PlanType | null;
  locale: DashLocale;
  t: BillingCopy;
  /** Which tiers to draw, in order. */
  plans: readonly PlanType[];
  /** Icons are the caller's business — /billing already has a set. */
  icons?: Record<string, React.ReactNode>;
  features?: Record<string, string[]>;
  /** Billing period for the checkout session. Monthly until a toggle exists. */
  interval?: BillingInterval;
}

export function PlanCards({
  currentPlan,
  locale,
  t,
  plans,
  icons,
  features,
  interval = "month",
}: PlanCardsProps) {
  const [busy, setBusy] = useState<PlanType | null>(null);
  const [failed, setFailed] = useState<PlanType | null>(null);

  async function startCheckout(plan: PlanType) {
    const tier = tierKeyFor(plan);
    if (!tier || busy) return;
    setBusy(plan);
    setFailed(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval, locale }),
      });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error("checkout failed");
      window.location.assign(data.url);
      // Stay disabled: the page is leaving, and re-enabling invites a second
      // session on a slow redirect.
    } catch {
      setFailed(plan);
      setBusy(null);
    }
  }

  return (
    <div className={cn(s.scope, "grid grid-cols-1 gap-6 lg:grid-cols-4")}>
      {plans.map((plan) => {
        const action = planCardAction(plan, currentPlan);
        const isCurrent = action === "current";
        const price = PLAN_PRICES[plan];
        const custom = PLAN_CONFIGS[plan]?.isCustomPricing === true;

        return (
          <Card
            key={plan}
            className={cn(
              "relative overflow-hidden",
              isCurrent && cn("ring-2 ring-gray-300", s.currentCard),
            )}
          >
            <CardContent className="py-6">
              {/* Top slot — button or badge, so cards stay aligned. */}
              <div className={s.topSlot}>
                {isCurrent ? (
                  <span className={s.currentBadge} data-testid="current-plan-badge">
                    {t.currentPlan}
                  </span>
                ) : action === "upgrade" ? (
                  <button
                    type="button"
                    className={s.planUpgradeBtn}
                    onClick={() => startCheckout(plan)}
                    disabled={busy === plan}
                    aria-busy={busy === plan}
                    data-testid={`upgrade-${plan}`}
                  >
                    {t.upgradeTo(PLAN_LABELS[plan] ?? plan)}
                  </button>
                ) : action === "contact" ? (
                  <a
                    className={s.planUpgradeBtn}
                    href={PLAN_CONFIGS[plan]?.ctaLink ?? "#"}
                    data-testid={`contact-${plan}`}
                  >
                    {t.contactSales}
                  </a>
                ) : (
                  // AGENCY on a lower tier: nothing to sell here, but the slot
                  // is held so the card below it lines up with its neighbours.
                  <span aria-hidden="true" />
                )}
              </div>

              {failed === plan && (
                <p className={s.error} role="alert">
                  {t.genericError}
                </p>
              )}

              <div className="flex items-center gap-3 mb-4">
                {icons?.[plan] && (
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      isCurrent ? "bg-gray-100 text-gray-500" : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {icons[plan]}
                  </div>
                )}
                <h4 className="font-semibold text-gray-900">
                  {PLAN_LABELS[plan] ?? plan}
                </h4>
              </div>

              <div className="mb-6">
                {custom ? (
                  <span className="text-2xl font-bold text-gray-900">
                    {t.contactSales}
                  </span>
                ) : (
                  <>
                    <span className="text-4xl font-bold text-gray-900">${price}</span>
                    <span className="text-gray-500">{t.perMonth}</span>
                  </>
                )}
              </div>

              <ul className="space-y-2.5">
                {(features?.[plan] ?? []).map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
