// src/lib/keyword-opportunity/seeds.ts
//
// Seeded analysis mode: normalising, capping and identifying a keyword set the
// customer chose rather than one discovery found.
//
// PURE. No Prisma, no clock, no network — the same rule ./score.ts follows, for
// the same reason: the hash decides whether a customer is charged for a run or
// served yesterday's, so it has to be testable without a database.
//
// ── WHY A HASH AND NOT THE LIST ─────────────────────────────────────────────
//
// The cache probe is an indexed equality lookup on a column. "Did anyone run
// this exact set today" over an array column would be a scan and an ordering
// question; over a 64-character hash it is an index hit. Order-independence is
// bought by sorting before hashing, so the same twelve keywords picked in a
// different order are the same analysis — which is what a customer would
// expect, and what stops the same run being paid for twice.

import { createHash } from "node:crypto";

import { WORKING_SET_LIMIT } from "./limits";

/**
 * Canonical form of one seed.
 *
 * Lowercased, whitespace collapsed, trimmed. NOT stemmed and NOT
 * punctuation-stripped: the seeds come from Keyword Explorer, which took them
 * off the customer's own pages, and "b2b" and "b 2 b" are different keywords
 * however similar their stems. Matching ./discover.ts keywordKey() would fold
 * distinctions the customer can see in the table they picked from.
 */
export function normalizeSeed(keyword: string): string {
  return (keyword ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export class SeedSetError extends Error {
  constructor(
    message: string,
    readonly code: "EMPTY" | "OVER_CAP",
    readonly count?: number,
  ) {
    super(message);
    this.name = "SeedSetError";
  }
}

/**
 * Normalise, dedupe and validate a seed set.
 *
 * REJECTS OVER-CAP RATHER THAN TRUNCATING. Silently dropping the tail would
 * charge a customer a full domain analysis for a subset of what they selected,
 * and they would have no way to tell which half they paid for. The cap is
 * WORKING_SET_LIMIT — the same hundred a discovery run cuts to, because
 * everything downstream of the working set is shared and a seeded run must not
 * be able to hand it more than it was built for.
 *
 * Order is not preserved: the result is sorted, because a set of keywords has
 * no order and the hash below must not invent one.
 */
export function normalizeSeedSet(keywords: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of keywords ?? []) {
    const seed = normalizeSeed(raw);
    if (seed !== "") seen.add(seed);
  }

  if (seen.size === 0) {
    throw new SeedSetError("Select at least one keyword to score.", "EMPTY");
  }
  if (seen.size > WORKING_SET_LIMIT) {
    throw new SeedSetError(
      `Select at most ${WORKING_SET_LIMIT} keywords — you selected ${seen.size}.`,
      "OVER_CAP",
      seen.size,
    );
  }

  return [...seen].sort();
}

/**
 * The cache identity of a seed set. Hex SHA-256 of the canonical form.
 *
 * Takes the ALREADY-NORMALISED list and re-sorts defensively rather than
 * normalising again: two functions that both normalise are two functions that
 * can disagree about how, and the one that decides whether money is spent
 * should not be guessing.
 *
 * The newline join matters. Joining on a character that can appear inside a
 * keyword would make {"a b", "c"} and {"a", "b c"} collide, and a collision
 * here serves one customer another customer's analysis.
 */
export function seedSetHash(seeds: readonly string[]): string {
  return createHash("sha256").update([...seeds].sort().join("\n")).digest("hex");
}
