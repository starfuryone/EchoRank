// src/lib/credits/ledger.ts
//
// The credit arithmetic, in a module with NO Prisma.
//
// Same split as sov/weighting.ts and citations/aggregate.ts: everything worth
// arguing about is a pure function with a test around it, and ./store.ts is
// left holding the SQL. That matters more here than usual — this is money the
// customer has already paid for, and a rounding or sign error is a bill.
//
// ── SIGN CONVENTION, stated once ────────────────────────────────────────────
// Deltas are signed and the balance is their sum. A RESERVE is NEGATIVE at
// submit; a CONSUME_RELEASE is POSITIVE at completion. There is no separate
// "consume" row, and that absence is the design: the reserve already removed
// the credits, so consumption is simply the release that never comes. Writing
// both a consume and a release would double-count, and writing a consume per
// row would put a thousand rows in the ledger for one batch.

import type { CreditReason } from "@/generated/prisma";

/** One ledger row, as far as the arithmetic is concerned. */
export interface LedgerEntry {
  delta: number;
  reason: CreditReason;
  ref: string;
}

/**
 * Balance from rows.
 *
 * The database computes this with SUM(delta) — see ./store.ts — and this
 * function exists so the same definition can be asserted in a test without one,
 * and so a caller holding rows already does not make a second round trip.
 */
export function balanceOf(entries: readonly LedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.delta, 0);
}

/**
 * Can this tenant afford `rowCount` lookups?
 *
 * `>=`, not `>`. A balance of exactly 250 buys a 250-row batch — refusing it
 * would strand the last pack a customer bought at the size we sold it.
 */
export function canAfford(balance: number, rowCount: number): boolean {
  return rowCount <= 0 || balance >= rowCount;
}

/**
 * The reserve delta for a batch of `rowCount` rows.
 *
 * Negative, and the full row count regardless of how many lookups will really
 * happen. Reserving the optimistic number would let two concurrent batches
 * both pass the balance check and then discover, halfway through, that the
 * credits are gone — the failure lands on the customer mid-batch rather than at
 * submit where it can be acted on. Over-holding is corrected at completion,
 * which is what CONSUME_RELEASE is for.
 */
export function reserveDelta(rowCount: number): number {
  // The zero case is spelled out rather than falling out of the negation:
  // `-Math.max(0, 0)` is -0, which is equal to 0 everywhere except Object.is
  // and JSON — and a ledger row storing "-0" is a row that reads as a debit of
  // nothing. Cheaper to return a real zero than to explain that later.
  const rows = Math.floor(rowCount);
  return rows <= 0 ? 0 : -rows;
}

/**
 * How many credits to give back when a batch finishes.
 *
 * `reserved` is what the submit held (a positive count); `consumed` is the
 * number of lookups that actually cost money — the rows where
 * PlaceLookupResult.costUsd was greater than zero.
 *
 * CLAMPED AT BOTH ENDS, deliberately:
 *   - never negative: a batch that somehow consumed more than it reserved must
 *     not have the excess silently taken out of the tenant's balance by a
 *     "release". If that ever happens it is a bug, and quietly billing for it
 *     would hide the bug behind a correct-looking number.
 *   - never more than reserved: a release larger than the hold mints credits.
 */
export function releaseDelta(reserved: number, consumed: number): number {
  const held = Math.max(0, Math.floor(reserved));
  const used = Math.max(0, Math.floor(consumed));
  return Math.max(0, Math.min(held, held - used));
}

/**
 * Whether a lookup result consumed a credit.
 *
 * THE ONE RULE, and it is the upstream's own answer rather than ours:
 * lookupPlace() reports costUsd as "real dollars spent by THIS call. Zero when
 * nothing left the building". So a disabled, unconfigured, cap-skipped or
 * empty-query row costs nothing and gets its credit back, while an upstream
 * failure or a no-match AFTER a real request is a lookup the tenant bought —
 * Google charged us for the search whether or not it found anything, and
 * refunding it would mean eating the cost of every prospect that has no listing,
 * which on a SaaS list is most of them.
 */
export function consumedCredit(costUsd: number): boolean {
  return costUsd > 0;
}

/** Reasons that add credits. Used by the /billing history to pick a sign glyph. */
export function isCredit(reason: CreditReason): boolean {
  return reason === "PURCHASE" || reason === "CONSUME_RELEASE" || reason === "REFUND";
}
