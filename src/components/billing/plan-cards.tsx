"use client";

// The plan cards, shared by /billing and any other in-app surface that shows
// the tier comparison. The public homepage does NOT use this — there is no
// session there, so there is no current plan to mark.
//
// NOTHING HERE WRITES planType. Upgrades go through Stripe Checkout and the
// tenant's tier changes only when the signed webhook says so. The old
// window.confirm() flip that POSTed a plan name is gone.
//
// ── THE CONSENT DIALOG IS NOT DECORATION ────────────────────────────────────
//
// /api/billing/checkout validates consent BEFORE its auth branch and returns
// 400 consent_required without it, on every flow. This surface was POSTing
// {tier, interval, locale} and nothing else, so EVERY in-app upgrade from
// /billing was failing — silently, as the route's error is generic and the
// card only renders "Something went wrong". A dialog is the fix rather than a
// hardcoded payload: consent has to be an act the customer performed, and
// asserting they accepted four documents they were never shown is worse than
// the bug.
//
// THE DOCUMENT LIST IS NEVER WRITTEN IN JSX HERE. It maps CONSENT_DOCUMENTS,
// the same array the marketing gate and the server both read, so adding a
// document updates this dialog and the server's requirement in one edit. The
// marketing ConsentGate is not reused directly because it is built on the
// public site's home2.module.css chrome; what is shared is the source of
// truth, which is the part that must not drift.

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { CONSENT_DOCUMENTS, CONSENT_VERSION } from "@/lib/consent-config";
// The same localized document names the public gate renders. Reused rather
// than restated: a document called one thing on /pricing and another on
// /billing is the drift CONSENT_DOCUMENTS exists to prevent, one level up.
import { CONSENT_COPY } from "@/lib/i18n/content";
import { cn } from "@/lib/utils";
import { PLAN_CONFIGS, PLAN_PRICES } from "@/lib/plan-config";
import type { PlanType } from "@/generated/prisma";
import type { SellablePlanType } from "@/lib/plan-config";
import type { BillingCopy, DashLocale } from "@/lib/i18n/dashboard";
import type { BillingInterval } from "@/lib/stripe/lookup-keys";
import { planCardAction, tierKeyFor } from "./plan-actions";
import s from "./plan-cards.module.css";

/** Product names stay English in every locale, as elsewhere in the app. */
const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  AGENCY: "Agency",
  ENTERPRISE: "Enterprise",
};

export interface PlanCardsProps {
  /** Tenant.planType, read server-side. Never inferred in the browser. */
  currentPlan: PlanType | null;
  /**
   * Has this tenant ever subscribed? False for BillingStatus.NONE, in which
   * case NO card is "current" — planType alone defaults to STARTER for every
   * tenant and would otherwise badge a plan nobody bought. Defaults true so
   * existing callers keep their behaviour.
   */
  subscribed?: boolean;
  locale: DashLocale;
  t: BillingCopy;
  /** Which tiers to draw, in order. */
  plans: readonly SellablePlanType[];
  /** Icons are the caller's business — /billing already has a set. */
  icons?: Record<string, React.ReactNode>;
  features?: Record<string, string[]>;
  /** Billing period for the checkout session. Monthly until a toggle exists. */
  interval?: BillingInterval;
}

export function PlanCards({
  currentPlan,
  subscribed = true,
  locale,
  t,
  plans,
  icons,
  features,
  interval = "month",
}: PlanCardsProps) {
  const [busy, setBusy] = useState<PlanType | null>(null);
  const [failed, setFailed] = useState<PlanType | null>(null);
  /** The plan whose button opened the consent dialog, resumed on accept. */
  const [pending, setPending] = useState<PlanType | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function startCheckout(plan: PlanType) {
    const tier = tierKeyFor(plan);
    if (!tier || busy) return;
    setBusy(plan);
    setFailed(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          interval,
          locale,
          // Built at accept time, so the timestamp is the moment of the act.
          // The server re-validates every field; sending it is not what
          // authorizes the checkout.
          consent: {
            accepted: true,
            timestamp: new Date().toISOString(),
            version: CONSENT_VERSION,
            documents: CONSENT_DOCUMENTS.map((d) => d.id),
          },
        }),
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

  /** Every buy button enters here. Gate first, network second. */
  function requestCheckout(plan: PlanType) {
    setPending(plan);
    setAccepted(false);
  }

  function acceptAndCheckout() {
    const resume = pending;
    setPending(null);
    if (resume) void startCheckout(resume);
  }

  const consentDialog = (
    <Modal
      open={pending !== null}
      onClose={() => setPending(null)}
      title={t.consentTitle}
      closeLabel={t.consentCancel}
    >
      <p className="text-sm text-gray-600">{t.consentBody}</p>
      <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300"
        />
        <span>
          {t.consentAgree}{" "}
          {CONSENT_DOCUMENTS.map((doc, i) => (
            <span key={doc.id}>
              {i > 0 && ", "}
              <a
                href={`/${locale}${doc.href}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700"
              >
                {CONSENT_COPY[locale][doc.labelKey]}
              </a>
            </span>
          ))}
          .
        </span>
      </label>
      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setPending(null)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          {t.consentCancel}
        </button>
        {/* Disabled until the box is ticked — here the reason is the sentence
            directly above it, so the disabled state reads as a consequence
            rather than a wall. */}
        <button
          type="button"
          onClick={acceptAndCheckout}
          disabled={!accepted}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t.consentConfirm}
        </button>
      </div>
    </Modal>
  );

  return (
    <>
    {consentDialog}
    <div className={cn(s.scope, "grid grid-cols-1 gap-6 lg:grid-cols-4")}>
      {plans.map((plan) => {
        const action = planCardAction(plan, currentPlan, subscribed);
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
                ) : action === "upgrade" || action === "downgrade" ? (
                  // ONE BUTTON, TWO LABELS. Both directions do the same thing —
                  // POST a checkout for the target tier — so they share the
                  // control and differ only in what it says. The label is not
                  // cosmetic: "Upgrade to Starter" shown to a Growth subscriber
                  // is telling them a cheaper, smaller plan is a step up.
                  //
                  // The testid keeps the direction, so a test cannot assert the
                  // button exists without asserting which way it points.
                  <button
                    type="button"
                    className={s.planUpgradeBtn}
                    onClick={() => requestCheckout(plan)}
                    disabled={busy === plan}
                    aria-busy={busy === plan}
                    data-testid={`${action}-${plan}`}
                  >
                    {action === "upgrade"
                      ? t.upgradeTo(PLAN_LABELS[plan] ?? plan)
                      : t.downgradeTo(PLAN_LABELS[plan] ?? plan)}
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
    </>
  );
}
