// src/lib/credit-packs.ts
//
// The credit packs, defined ONCE.
//
// Four things read this file and they must never disagree:
//   1. /[locale]/credits           — the three cards a buyer compares
//   2. /api/billing/credits/checkout — which lookup key to resolve in Stripe
//   3. the Stripe webhook           — how many credits a completed session buys
//   4. scripts/seed-credit-packs.ts — what to create in Stripe in the first place
//
// A pack defined in two places is a pack that will eventually be advertised at
// one size and delivered at another, and the buyer is the one who finds out.
// tests/credit-packs.test.ts asserts the page and the checkout resolve the same
// set, because "single source" is a property that has to be enforced, not
// asserted in a comment.
//
// ── NO PRICES IN THIS FILE. They are resolved from Stripe at runtime ────────
// This file owns the SIZES and the LOOKUP KEYS; Stripe owns what each one
// costs, and src/lib/credits/pricing.ts is the only thing that reads it. That
// is the same rule the plan checkout follows ("Prices are NOT defined here")
// and it exists because a hardcoded amount and a Stripe price drift silently —
// the page keeps advertising $50 while the customer is charged $60, and nothing
// fails.
//
// The consequence worth knowing: the /credits page cannot render until Stripe
// answers, and a pack whose key is missing from the catalogue is DROPPED from
// the page rather than shown at an invented price. A missing pack is visible;
// a wrong price is not.
//
// PLACES_TEXTSEARCH_USD is what one lookup costs US ($0.032) — kept here so
// nothing downstream re-imports the DataForSEO cost table to reason about
// margin.

import { PLACES_TEXTSEARCH_USD } from "@/lib/explain/cost";

export interface CreditPack {
  /** Credits granted. Also the `<n>` in the lookup key. */
  credits: number;
  /** The middle card, rendered with emphasis. Exactly one pack carries it. */
  featured?: boolean;
}

/**
 * The three packs, smallest first.
 *
 * THESE SIZES MATCH THE SEEDED STRIPE CATALOGUE and are not free to change: the
 * keys echorank_credits_{100,500,2000}_usd exist in sandbox (and, once seeded,
 * live) against product prod_V4nFl2plt0kVJW. Editing a number here without
 * creating the matching price makes that pack disappear from /credits, because
 * pricing.ts drops what it cannot resolve.
 */
export const CREDIT_PACKS: readonly CreditPack[] = [
  { credits: 100 },
  { credits: 500, featured: true },
  { credits: 2_000 },
] as const;

/**
 * The single Stripe product all three prices hang off.
 *
 * ONE PRODUCT, THREE PRICES — the shape the sandbox catalogue was seeded with.
 * Three products would each need their own metadata and their own scoped
 * cleanup, which on a shared account is three chances to make the 2026-08-01
 * mistake instead of one.
 */
export const CREDIT_PRODUCT_ID = "prod_V4nFl2plt0kVJW";

/** `echorank_credits_<n>_usd` — the agreed key shape. */
export function creditPackLookupKey(credits: number): string {
  return `echorank_credits_${credits}_usd`;
}

/** Every key this file owns, for a scoped Stripe query. */
export function allCreditPackLookupKeys(): string[] {
  return CREDIT_PACKS.map((pack) => creditPackLookupKey(pack.credits));
}

/**
 * What one lookup costs the buyer, given what Stripe says the pack costs.
 *
 * Rendered on every card so the volume discount is visible rather than implied.
 * NOT rounded to the cent — at these sizes a lookup costs a few cents either
 * way, and rounding to whole cents would print the same number on two packs and
 * look like no discount at all.
 */
export function unitUsdFor(credits: number, usd: number): number {
  return credits > 0 ? usd / credits : 0;
}

/** Look a pack up by size. Null for a size we do not sell. */
export function packForCredits(credits: number): CreditPack | null {
  return CREDIT_PACKS.find((pack) => pack.credits === credits) ?? null;
}

/**
 * Resolve a lookup key back to its pack.
 *
 * The webhook's path: a completed session carries the credits in its metadata,
 * but metadata is caller-supplied and this is the server's own answer. Anything
 * that does not match a pack we sell resolves to null and is refused rather
 * than credited at face value.
 */
export function packForLookupKey(lookupKey: string): CreditPack | null {
  return (
    CREDIT_PACKS.find((pack) => creditPackLookupKey(pack.credits) === lookupKey) ?? null
  );
}

/** True for any key this file owns. Used to scope Stripe queries. */
export function isCreditPackLookupKey(value: unknown): value is string {
  return typeof value === "string" && packForLookupKey(value) !== null;
}

/**
 * Our own cost for one lookup, re-exported so the credits page can state the
 * margin honestly if it ever wants to, and so nothing downstream re-imports the
 * DataForSEO cost table just to price a pack.
 */
export const LOOKUP_COST_USD = PLACES_TEXTSEARCH_USD;
