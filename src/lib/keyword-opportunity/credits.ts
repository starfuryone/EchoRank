// src/lib/keyword-opportunity/credits.ts
//
// The domain-analysis credit pool: balance, reserve, release, grant.
//
// ── A SECOND POOL, NOT A SECOND OPINION ABOUT THE FIRST ─────────────────────
//
// credits/ledger.ts and credits/store.ts hold prepaid PLACES lookups for the
// Agency Opportunity Scanner. This is the same pattern over a different table,
// and the tables are separate because CreditLedger's balance is SUM(delta) over
// every row a tenant has and /billing renders that sum — a pool discriminator
// there would silently change what every existing balance read means. See
// KeywordOpportunityCredit in the schema for the argument in full.
//
// The ARITHMETIC is genuinely shared: balanceOf, canAfford, reserveDelta and
// releaseDelta in credits/ledger.ts are pure functions over signed deltas and
// are imported here rather than reimplemented. Only the storage differs.
//
// ── ONE ANALYSIS IS ONE CREDIT ──────────────────────────────────────────────
//
// Unlike a scan batch, whose reserve is a row count that partially releases,
// a domain analysis costs exactly one credit. RESERVE is -1 at submit;
// CONSUME_RELEASE is +1 if the analysis never completed, and never written at
// all if it did. The uniqueness constraint (tenantId, reason, ref) makes both
// writers safe to retry — the analysis id is the ref, so a worker that finishes
// the same analysis twice cannot refund the credit twice.
//
// NO STRIPE IN THIS PHASE. There is no checkout, no pack and no purchase path.
// PURCHASE exists in the enum because the enum is shared; the only way a credit
// enters this pool today is the admin grant script.

import { prisma } from "@/lib/prisma";
import { balanceOf, canAfford, type LedgerEntry } from "@/lib/credits/ledger";

/** One domain analysis costs one credit. */
export const CREDITS_PER_ANALYSIS = 1;

/**
 * Balance for a tenant, as SUM(delta).
 *
 * THERE IS NO BALANCE COLUMN, and there must not be one. A denormalised balance
 * is a second source of truth that can disagree with the rows that produced it,
 * and the disagreement is invisible until a customer counts. This table sees a
 * couple of rows per analysis, so the sum is cheap and stays cheap.
 */
export async function creditBalance(tenantId: string): Promise<number> {
  const agg = await prisma.keywordOpportunityCredit.aggregate({
    _sum: { delta: true },
    where: { tenantId },
  });
  return Number(agg._sum.delta ?? 0);
}

/** Whether the tenant can fund one more analysis from credits alone. */
export async function hasCredit(tenantId: string): Promise<boolean> {
  return canAfford(await creditBalance(tenantId), CREDITS_PER_ANALYSIS);
}

/**
 * Hold one credit against an analysis.
 *
 * Returns false when the tenant cannot afford it, or when a reserve for this
 * analysis already exists — the unique constraint makes the second case a
 * no-op rather than a double charge, and reporting it as success would be a
 * lie about what happened. Both are "do not start"; the caller does not need
 * to tell them apart.
 */
export async function reserveCredit(tenantId: string, analysisId: string): Promise<boolean> {
  if (!(await hasCredit(tenantId))) return false;
  try {
    await prisma.keywordOpportunityCredit.create({
      data: { tenantId, delta: -CREDITS_PER_ANALYSIS, reason: "RESERVE", ref: analysisId },
    });
    return true;
  } catch {
    // Unique violation on (tenantId, RESERVE, analysisId): already held.
    return false;
  }
}

/**
 * Give the credit back for an analysis that did not complete.
 *
 * IDEMPOTENT BY THE UNIQUE CONSTRAINT, which is the whole reason the release is
 * a row rather than a mutation: a worker that fails the same analysis twice
 * writes one release. There is deliberately no "consume" row — the reserve
 * already removed the credit, so consumption is the release that never comes.
 */
export async function releaseCredit(tenantId: string, analysisId: string): Promise<void> {
  const held = await prisma.keywordOpportunityCredit.findUnique({
    where: {
      tenantId_reason_ref: { tenantId, reason: "RESERVE", ref: analysisId },
    },
  });
  // Nothing was held — the analysis was funded by the monthly allowance, and
  // refunding a credit here would mint one.
  if (!held) return;

  try {
    await prisma.keywordOpportunityCredit.create({
      data: {
        tenantId,
        delta: CREDITS_PER_ANALYSIS,
        reason: "CONSUME_RELEASE",
        ref: analysisId,
      },
    });
  } catch {
    // Already released. Idempotent by construction; see the doc comment.
  }
}

/**
 * An operator grant.
 *
 * `ref` MUST be unique per tenant — the constraint is (tenantId, reason, ref)
 * and a bare "adjustment" would collide with the next one, silently making the
 * second grant a no-op. The script that calls this generates a dated token.
 */
export async function grantCredits(
  tenantId: string,
  amount: number,
  ref: string,
): Promise<number> {
  const delta = Math.trunc(amount);
  if (delta === 0) throw new Error("grant of zero credits records nothing");
  if (!ref.trim()) throw new Error("ADMIN grants need a unique ref");

  await prisma.keywordOpportunityCredit.create({
    data: { tenantId, delta, reason: "ADMIN", ref: ref.trim() },
  });
  return creditBalance(tenantId);
}

/** The tenant's ledger, newest first, for an operator or a future billing view. */
export async function creditHistory(tenantId: string, take = 50): Promise<LedgerEntry[]> {
  const rows = await prisma.keywordOpportunityCredit.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
    select: { delta: true, reason: true, ref: true },
  });
  return rows;
}

/** Re-exported so a caller holding rows already can avoid a second round trip. */
export { balanceOf };
