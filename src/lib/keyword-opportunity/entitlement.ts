// src/lib/keyword-opportunity/entitlement.ts
//
// Who is allowed to start a domain analysis, and what it draws down.
//
// PURE, AND NOTHING HERE IS WIRED YET. Phase 3 attaches the allowance counter,
// the credit ledger and the cache probe. What this module fixes now is the
// ORDER OF DRAW, because that is the decision that is expensive to revisit once
// three call sites depend on it:
//
//   1. A 24h CACHE HIT IS FREE. Neither allowance nor credits. Handing the
//      customer the same result they were shown an hour ago and charging for it
//      again is the kind of billing nobody notices until they do.
//   2. THE MONTHLY ALLOWANCE GOES FIRST. Credits are prepaid and do not expire;
//      the allowance resets and is gone. Spending the perishable one first is
//      what the customer would choose, so it is not offered as a choice.
//   3. CREDITS ARE THE OVERFLOW. Only once the allowance is exhausted.
//
// ── THE CREDIT POOL IS ITS OWN, AND MUST STAY ITS OWN ───────────────────────
// CreditLedger holds prepaid PLACES lookups for the Agency Opportunity Scanner.
// Its balance is SUM(delta) over every row a tenant has, `/billing` renders
// that sum, and it is uniquely keyed (tenantId, reason, ref) with no pool
// discriminator. Adding a `pool` column would silently change what every
// existing balance read means — an existing feature, modified. So domain
// analyses get a SEPARATE append-only table on the same pattern (signed deltas,
// RESERVE at start, CONSUME_RELEASE at completion, balance = SUM). Phase 3
// schema work; this module only needs the number.

import type { PlanType } from "@/generated/prisma";
import { planConfig } from "@/lib/plan-config";
import type { AnalysisEntitlement } from "./types";

/**
 * How a run would be paid for.
 *
 * "cache" is a funding source rather than a separate flag because every caller
 * has to branch on it anyway, and a boolean beside an enum is how one of the
 * two gets forgotten at a call site.
 */
export type AnalysisFunding = "cache" | "allowance" | "credits" | "denied";

export interface FundingDecision {
  funding: AnalysisFunding;
  /** True for everything except "denied". */
  canRun: boolean;
  /** Allowance left after this run would start. Null when unlimited. */
  allowanceAfter: number | null;
  /** Credits left after this run would start. */
  creditsAfter: number;
}

/** The tier's monthly domain-analysis allowance. Null = unlimited. */
export function analysisAllowanceFor(plan: PlanType): number | null {
  return planConfig(plan).keywordOpportunityAnalysesPerMonth;
}

/**
 * Decide how the next domain analysis would be funded.
 *
 * NOTHING IS CONSUMED HERE — this answers "what would happen", and the caller
 * that actually starts the run is the one that writes the ledger row. Splitting
 * the two is what lets the page render "3 of 5 domain analyses left this month"
 * without a side effect, which a combined check-and-consume could not.
 */
export function fundingFor(entitlement: AnalysisEntitlement): FundingDecision {
  const { allowanceRemaining, credits } = entitlement;

  if (entitlement.cacheHit) {
    return {
      funding: "cache",
      canRun: true,
      allowanceAfter: allowanceRemaining,
      creditsAfter: credits,
    };
  }

  // Null is unlimited, not zero. ENTERPRISE is contract-priced and a hard stop
  // would be the wrong failure mode there — the same call plan-config makes for
  // every other `null` ceiling.
  if (allowanceRemaining === null) {
    return { funding: "allowance", canRun: true, allowanceAfter: null, creditsAfter: credits };
  }

  if (allowanceRemaining > 0) {
    return {
      funding: "allowance",
      canRun: true,
      allowanceAfter: allowanceRemaining - 1,
      creditsAfter: credits,
    };
  }

  if (credits > 0) {
    return { funding: "credits", canRun: true, allowanceAfter: 0, creditsAfter: credits - 1 };
  }

  return { funding: "denied", canRun: false, allowanceAfter: 0, creditsAfter: 0 };
}

/**
 * The bucket a completed analysis falls into for the 24h cache.
 *
 * UTC DAY, and the key is (domain, dateBucket) — so two analyses of the same
 * domain on the same UTC day are one purchase. A rolling 24h window read off a
 * timestamp would make "did this cost me anything" depend on the minute the
 * customer clicked, which is not a rule anybody can hold in their head.
 */
export function dateBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The cache key a completed analysis is stored under. */
export function cacheKeyFor(domain: string, now: Date = new Date()): string {
  return `${domain.trim().toLowerCase()}:${dateBucket(now)}`;
}
