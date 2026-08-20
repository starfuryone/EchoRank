// Which action a plan card offers. Pure, so the rules are testable without
// rendering — the interesting part of this feature is the rules, not the JSX.

import type { PlanType } from "@/generated/prisma";
import {
  checkoutLookupKey,
  type BillingInterval,
  type CheckoutTier,
} from "@/lib/stripe/lookup-keys";
// The canonical tier ranking already exists, and rank — not price — is what
// decides direction: ENTERPRISE is custom-priced, so comparing monthlyPrice
// would make it incomparable. isUpgrade() also folds the retired
// AI_VISIBILITY tier, so a legacy tenant compares as STARTER rather than
// falling outside the order entirely.
import { isUpgrade } from "@/lib/plan-config";

export type PlanCardAction = "current" | "upgrade" | "downgrade" | "contact" | "none";

/**
 * Tiers that may show an Upgrade button.
 *
 * AGENCY is absent on purpose: it is the top self-serve tier, so there is
 * nothing to upgrade to from it. ENTERPRISE is absent because it is custom
 * priced and has no Stripe lookup key — it gets a contact link instead.
 * AI_VISIBILITY is absent because the tier is retired.
 */
export const UPGRADEABLE_PLANS: readonly PlanType[] = [
  "STARTER",
  "GROWTH",
] as const;

/** PlanType -> Stripe tier key. Null where no key exists (ENTERPRISE, and the
 *  retired AI_VISIBILITY tier, which has no prices to check out against). */
export function tierKeyFor(plan: PlanType): CheckoutTier | null {
  switch (plan) {
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
 *
 * ── WHY planType ALONE IS NOT ENOUGH ANYMORE ────────────────────────────────
 *
 * Tenant.planType defaults to STARTER for every tenant, whether or not anyone
 * ever bought anything. Combined with the old TRIALING default that was
 * invisible; now that a never-subscribed tenant is explicitly NONE, reading
 * planType on its own puts a "Current plan" badge on the Starter card of a
 * tenant that has never paid us — and, worse, REMOVES its buy button, because
 * "current" is the one action with nothing to click. The tenant most in need of
 * checking out would be the one card that could not.
 *
 * So the pair is read, status first: `subscribed` says whether the tier means
 * anything at all. This is a display fix and not a security one — nothing in
 * the product entitles off planType alone (see requirePaidPlan, which reads
 * billing status) — which is also why the fix belongs here rather than in the
 * planType default, where it would rewrite what existing tenants are on.
 */
export function planCardAction(
  plan: PlanType,
  currentPlan: PlanType | null | undefined,
  /**
   * Has this tenant ever actually subscribed? False for BillingStatus.NONE.
   * Defaults TRUE so every existing caller keeps its behaviour exactly: the
   * cards have always assumed a tenant with a tier is on that tier, and only a
   * caller that knows otherwise should say so.
   */
  subscribed: boolean = true,
): PlanCardAction {
  if (subscribed && currentPlan && plan === currentPlan) return "current";
  if (plan === "ENTERPRISE") return "contact";
  // Whether a card sells at all is unchanged and separate from which direction
  // it sells in. UPGRADEABLE_PLANS is the gate; the ranking below only picks
  // the label.
  if (!UPGRADEABLE_PLANS.includes(plan)) return "none";
  // A tenant with nothing to compare against — never subscribed, or no tier on
  // record — is buying, not moving. Everything reads as "upgrade" for them,
  // which is also the only honest word when there is no current plan to be
  // below.
  if (!subscribed || !currentPlan) return "upgrade";
  // DIRECTION, RELATIVE TO WHAT THEY HOLD. Labelling every sellable card
  // "Upgrade to …" told a GROWTH subscriber to "Upgrade to Starter" — a cheaper,
  // smaller plan. The copy for the other direction already existed in all three
  // locales (BillingCopy.downgradeTo) and had never been wired to anything.
  return isUpgrade(currentPlan, plan) ? "upgrade" : "downgrade";
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
  subscribed: boolean = true,
): string | null {
  // Both directions POST a checkout for the target tier, so both need a key.
  // Only "current", "contact" and "none" have no button to build one for.
  const action = planCardAction(plan, currentPlan, subscribed);
  if (action !== "upgrade" && action !== "downgrade") return null;
  const tier = tierKeyFor(plan);
  return tier ? checkoutLookupKey(tier, interval) : null;
}
