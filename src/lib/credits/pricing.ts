// src/lib/credits/pricing.ts
//
// What each credit pack costs, according to Stripe.
//
// SERVER ONLY. It holds a Stripe client, so it must never be imported from a
// client component — /[locale]/credits resolves the packs in its server
// component and passes plain numbers down.
//
// ── ONE SCOPED QUERY, NOT THREE ─────────────────────────────────────────────
// `lookup_keys` takes an array, so all three packs resolve in a single call
// filtered to exactly the keys we own. That matters on the shared live account:
// the 2026-08-01 incident came from a query that reached beyond Echorank's own
// objects, and an exact key list cannot. It is also a read — this module never
// creates, updates or archives anything.
//
// ── A PACK STRIPE CANNOT PRICE IS DROPPED ───────────────────────────────────
// Not defaulted, not rendered "from $—", not fetched again with a fallback
// price. If the catalogue has no active price for a key, that pack does not
// appear on the page and cannot be bought. The failure is then visible (two
// cards instead of three) rather than silent (a card that charges something
// other than what it says).

import { getStripe } from "@/lib/stripe/client";
import { logger } from "@/infrastructure/observability/logger";
import {
  CREDIT_PACKS,
  allCreditPackLookupKeys,
  creditPackLookupKey,
  unitUsdFor,
  type CreditPack,
} from "@/lib/credit-packs";

const log = logger.child({ module: "credit-pricing" });

/** A pack with the price Stripe currently charges for it. */
export interface PricedPack extends CreditPack {
  /** Whole-dollar-ish USD, from Stripe's unit_amount. */
  usd: number;
  /** usd / credits, unrounded. */
  unitUsd: number;
  lookupKey: string;
}

/**
 * The sellable packs, smallest first.
 *
 * Returns an empty array rather than throwing when Stripe is unreachable or
 * unconfigured: /credits is a public marketing page, and a page that 500s
 * because a third party is down is worse than one that renders its copy with an
 * honest "packs are unavailable right now" state. The caller decides how to
 * render nothing; this decides not to invent a price.
 */
export async function pricedPacks(): Promise<PricedPack[]> {
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    log.error("STRIPE_SECRET_KEY is not configured — /credits will render unpriced");
    return [];
  }

  let prices;
  try {
    prices = await stripe.prices.list({
      // Exact, and scoped to our own keys. Never a prefix sweep.
      lookup_keys: allCreditPackLookupKeys(),
      active: true,
      limit: CREDIT_PACKS.length,
    });
  } catch (err) {
    log.error({ err }, "could not list credit pack prices");
    return [];
  }

  const byKey = new Map(
    prices.data
      .filter((price) => typeof price.lookup_key === "string")
      .map((price) => [price.lookup_key as string, price]),
  );

  const priced: PricedPack[] = [];
  for (const pack of CREDIT_PACKS) {
    const lookupKey = creditPackLookupKey(pack.credits);
    const price = byKey.get(lookupKey);
    // unit_amount is null for tiered or metered prices. A pack we cannot state
    // a single number for is one we cannot advertise honestly.
    if (!price || price.unit_amount === null || price.unit_amount === undefined) {
      log.warn({ lookupKey }, "credit pack has no resolvable Stripe price — dropped from /credits");
      continue;
    }
    const usd = price.unit_amount / 100;
    priced.push({
      ...pack,
      usd,
      unitUsd: unitUsdFor(pack.credits, usd),
      lookupKey,
    });
  }

  return priced;
}
