// src/lib/keyword-opportunity/start.ts
//
// THE ONLY WAY TO START A DOMAIN ANALYSIS.
//
// ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────
//
// It did not, and a dogfood run paid for the same domain twice inside forty
// seconds to prove it. Starting an analysis was a SEQUENCE — probe the cache,
// decide the funding, create the row, hold a credit — written out at the API
// route and nowhere else. The dogfood script needed to start one too, called
// createAnalysis() directly, and skipped every step of that sequence. The cache
// probe in the preflight command reported "HIT" correctly the whole time; the
// path that actually spent the money never asked it.
//
// The lesson is not "the script had a bug". It is that a sequence of four
// decisions kept at a call site is a sequence the next call site will get
// wrong, and this one costs real money when it does. So it is a function, both
// callers use it, and a test asserts nobody has quietly grown a third path.
//
// ── ORDER IS THE PRODUCT, AND IT IS FIXED HERE ──────────────────────────────
//
//   1. CACHE, before any entitlement is consulted. A repeat request for a
//      domain analysed today costs nothing, and refusing a free result to a
//      tenant at their ceiling is the most obviously wrong thing this code
//      could do.
//   2. ALLOWANCE, which is perishable and resets.
//   3. CREDITS, which are prepaid and do not expire, so they are spent last.
//   4. DENIED.
//
// ── THIS DOES NOT ENQUEUE, AND THAT IS DELIBERATE ───────────────────────────
//
// The route enqueues; the dogfood script runs inline. Folding the queue in here
// would force the script to go through Redis to do a thing it is holding the
// process open for anyway, and would make the one function both callers share
// the one function the script could not use.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { fundingFor } from "./entitlement";
import { reserveCredit } from "./credits";
import { OPPORTUNITY_SCORE_VERSION } from "./score";
import { cachedAnalysisId, createAnalysis, createCacheHit, entitlementFor } from "./store";
import type { AnalysisEntitlement } from "./types";

export type StartOutcome =
  | {
      kind: "cached";
      analysisId: string;
      /** The run that was actually paid for. */
      sourceAnalysisId: string;
      entitlement: AnalysisEntitlement;
    }
  | {
      kind: "queued";
      analysisId: string;
      funding: "allowance" | "credits";
      entitlement: AnalysisEntitlement;
    }
  | { kind: "denied"; entitlement: AnalysisEntitlement };

export interface StartAnalysisInput {
  tenantId: string;
  plan: PlanType;
  brandProfileId: string;
  /** Already normalised — registrableDomain() output. */
  domain: string;
  scoreVersion?: number;
  now?: Date;
}

/**
 * Decide how this analysis is funded, and create the row that says so.
 *
 * Never spends at a provider. The caller either enqueues the returned id or
 * runs it; a "cached" outcome is already complete and must not be run.
 */
export async function startAnalysis(input: StartAnalysisInput): Promise<StartOutcome> {
  const now = input.now ?? new Date();
  const scoreVersion = input.scoreVersion ?? OPPORTUNITY_SCORE_VERSION;
  const domain = input.domain.trim().toLowerCase();

  const entitlement = await entitlementFor(input.tenantId, input.plan, domain, now);
  const funding = fundingFor(entitlement);

  if (funding.funding === "cache") {
    // Re-read rather than trusting the boolean: entitlementFor() answered
    // "is there one", this needs "which one", and between the two a
    // concurrent teardown could have removed it. A miss here falls through
    // and runs the analysis properly rather than reporting a hit we cannot
    // serve.
    const sourceAnalysisId = await cachedAnalysisId(domain, now);
    if (sourceAnalysisId) {
      const analysisId = await createCacheHit({
        tenantId: input.tenantId,
        brandProfileId: input.brandProfileId,
        domain,
        scoreVersion,
        sourceAnalysisId,
        now,
      });
      return { kind: "cached", analysisId, sourceAnalysisId, entitlement };
    }
  }

  if (!funding.canRun) {
    return { kind: "denied", entitlement };
  }

  const analysisId = await createAnalysis({
    tenantId: input.tenantId,
    brandProfileId: input.brandProfileId,
    domain,
    scoreVersion,
    now,
  });

  if (funding.funding === "credits") {
    // HELD AT SUBMIT, before any work starts, so two requests arriving together
    // cannot both spend the same credit. The allowance needs no equivalent
    // hold: it is counted from completed rows, and two concurrent runs that
    // both complete both count.
    const reserved = await reserveCredit(input.tenantId, analysisId);
    if (!reserved) {
      // The credit went between the probe and the hold. The row exists and is
      // QUEUED; leaving it would be an analysis nobody paid for, so it is
      // failed immediately rather than run.
      await prisma.keywordOpportunityAnalysis.update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          completedAt: now,
          error: "no domain-analysis credit was available at submit",
        },
      });
      return { kind: "denied", entitlement };
    }
    await prisma.keywordOpportunityAnalysis.update({
      where: { id: analysisId },
      data: { fundingSource: "credits" },
    });
    return { kind: "queued", analysisId, funding: "credits", entitlement };
  }

  return { kind: "queued", analysisId, funding: "allowance", entitlement };
}
