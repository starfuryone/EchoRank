// Stripe lookup-key construction, kept separate from the route so it can be
// unit-tested without a Stripe client or a request.
//
// The six active keys already exist in both live and sandbox and are NOT
// created or modified by this app:
//   echorank_starter_usd_month       | _year
//   echorank_growth_usd_month        | _year
//   echorank_agency_usd_month        | _year
//
// The standalone Watcher adds a seventh and eighth key on the same template:
//   echorank_watcher_pro_usd_month   | _year
// It is NOT a PlanTierKey — there is no WATCHER tier, it is an entitlement (see
// ai-monitor/watcher-entitlement.ts) — so the checkout union widens by hand
// rather than deriving from the plan catalogue.
//
// Enterprise is custom-priced and has no key, which is why it is excluded at
// the type level as well as checked at runtime.

import type { PlanTierKey } from "./prices";

export type BillingInterval = "month" | "year";

/**
 * The standalone Watcher's checkout tier.
 *
 * Named to produce the agreed lookup keys through the EXISTING template rather
 * than special-casing them: `echorank_${tier}_usd_${interval}` with this value
 * yields echorank_watcher_pro_usd_month and _year exactly, so there is still
 * one way a lookup key is built.
 */
export const WATCHER_TIER = "watcher_pro" as const;

/**
 * Every tier that can be bought with a card. Enterprise is deliberately out
 * (custom-priced, no key); the watcher is in, though it is an entitlement
 * rather than a plan.
 */
export type CheckoutTier = Exclude<PlanTierKey, "enterprise"> | typeof WATCHER_TIER;

export const CHECKOUT_TIERS: readonly CheckoutTier[] = [
  "starter",
  "growth",
  "agency",
  WATCHER_TIER,
] as const;

export function isCheckoutTier(value: unknown): value is CheckoutTier {
  return typeof value === "string" && (CHECKOUT_TIERS as readonly string[]).includes(value);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year";
}

/**
 * `echorank_${tier}_usd_${interval}`.
 *
 * USD is hardcoded in the key because Echorank bills every locale in US
 * dollars — the same reason prices.ts types CurrencyCode as "USD" alone. When
 * a second currency exists, this becomes a parameter and the catalog grows;
 * until then a currency argument would imply a choice that does not exist.
 */
export function checkoutLookupKey(tier: CheckoutTier, interval: BillingInterval): string {
  return `echorank_${tier}_usd_${interval}`;
}
