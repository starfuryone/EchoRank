// Which action a plan card offers. Pure, so the rules are testable without
// rendering — the interesting part of this feature is the rules, not the JSX.

import type { PlanType } from "@/generated/prisma";
import {
  checkoutLookupKey,
  type BillingInterval,
  type CheckoutTier,
} from "@/lib/stripe/lookup-keys";

export type PlanCardAction = "current" | "upgrade" | "contact" | "none";

/**
 * Tiers that may show an Upgrade button.
 *
 * AGENCY is absent on purpose: it is the top self-serve tier, so there is
 * nothing to upgrade to from it. ENTERPRISE is absent because it is custom
 * priced and has no Stripe lookup key — it gets a contact link instead.
 */
export const UPGRADEABLE_PLANS: readonly PlanType[] = [
  "AI_VISIBILITY",
  "STARTER",
  "GROWTH",
] as const;

/** PlanType -> Stripe tier key. Null where no key exists (ENTERPRISE). */
export function tierKeyFor(plan: PlanType): CheckoutTier | null {
  switch (plan) {
    case "AI_VISIBILITY":
      return "ai_visibility";
    case "STARTER":
      return "starter";
    case "GROWTH":
      return "growth";
    case "AGENCY":
      return "agency";
    default:
      return null;
  }
}

/**
 * The single rule the cards follow.
 *
 * The current tier always wins: a tenant already on GROWTH sees the badge on
 * the GROWTH card, never a button to buy what they have. `currentPlan` comes
 * from Tenant.planType read server-side — it is never inferred client-side.
 */
export function planCardAction(
  plan: PlanType,
  currentPlan: PlanType | null | undefined,
): PlanCardAction {
  if (currentPlan && plan === currentPlan) return "current";
  if (plan === "ENTERPRISE") return "contact";
  return UPGRADEABLE_PLANS.includes(plan) ? "upgrade" : "none";
}

/**
 * The lookup key a given card's button will send to checkout. Returns null
 * when the card has no button, so a caller cannot accidentally build a key
 * for a tier it is not selling.
 */
export function planCheckoutLookupKey(
  plan: PlanType,
  currentPlan: PlanType | null | undefined,
  interval: BillingInterval,
): string | null {
  if (planCardAction(plan, currentPlan) !== "upgrade") return null;
  const tier = tierKeyFor(plan);
  return tier ? checkoutLookupKey(tier, interval) : null;
}
