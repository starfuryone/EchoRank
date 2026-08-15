// src/lib/credits/store.ts
//
// The database side of prepaid credits: the balance aggregate, the three
// writers, and the history list.
//
// EVERY QUERY IS TENANT-SCOPED. This is a balance — the one table in the app
// where a missing scope is not an information leak but a transfer of money
// between tenants.
//
// ── EVERY WRITER IS IDEMPOTENT, BY CONSTRAINT NOT BY CHECK ──────────────────
// (tenantId, reason, ref) is unique, so each writer below attempts its insert
// and treats P2002 as "already done". A read-then-write check would lose the
// race that actually happens in production: two webhook deliveries of the same
// event arriving at once, or a worker retried while its first attempt is still
// running. The database refusing the second write is the only defence that
// holds, which is the same argument PromptRun's idempotency key makes.

import { Prisma } from "@/generated/prisma";
import type { CreditReason } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { balanceOf, releaseDelta, type LedgerEntry } from "./ledger";

/** Rows the /billing history shows before it stops. */
export const HISTORY_LIMIT = 100;

/** True when Prisma refused a write because the row already existed. */
function isDuplicate(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * This tenant's balance.
 *
 * SUM(delta) in the database rather than a fetch-and-add here: the row count
 * grows without bound and the aggregate is served by the
 * (tenantId, createdAt) index. Postgres returns null for a tenant with no
 * rows, which is a balance of zero and not an error.
 */
export async function creditBalance(tenantId: string): Promise<number> {
  const result = await prisma.creditLedger.aggregate({
    where: { tenantId },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

/**
 * Record a completed credit-pack purchase.
 *
 * Returns the new balance, and whether this call is what created the row — the
 * webhook uses `applied` to decide whether to raise a notification, so a replay
 * credits nothing AND notifies nobody.
 */
export async function recordPurchase(input: {
  tenantId: string;
  credits: number;
  /** The Stripe Checkout Session id. */
  sessionId: string;
}): Promise<{ applied: boolean; balance: number }> {
  const { tenantId, credits, sessionId } = input;

  if (credits <= 0) {
    // A pack that grants nothing is a config error, not a purchase. Refusing
    // here rather than writing a zero-delta row keeps the ledger meaningful.
    throw new Error(`refusing to record a purchase of ${credits} credits`);
  }

  try {
    await prisma.creditLedger.create({
      data: { tenantId, delta: credits, reason: "PURCHASE", ref: sessionId },
    });
    return { applied: true, balance: await creditBalance(tenantId) };
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    logger.info(
      { tenantId, sessionId, credits },
      "credit purchase already recorded — webhook replay, nothing credited",
    );
    return { applied: false, balance: await creditBalance(tenantId) };
  }
}

/**
 * Hold `rowCount` credits for a batch.
 *
 * CHECKS AND WRITES IN ONE TRANSACTION, at serializable isolation. Two batches
 * submitted at the same moment must not both read a balance of 300, both pass a
 * check for 200, and both reserve — that is the concurrent-batch case, and a
 * plain read-then-write loses it. Serializable makes the second transaction
 * fail rather than interleave, and a failed reserve is reported as insufficient
 * balance, which is the honest answer: by the time it committed, it was.
 *
 * Returns the balance BEFORE the hold when it refuses, so the caller can tell
 * the customer what they actually have.
 */
export async function reserveCredits(input: {
  tenantId: string;
  batchId: string;
  rowCount: number;
}): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  const { tenantId, batchId, rowCount } = input;
  if (rowCount <= 0) return { ok: true, balance: await creditBalance(tenantId) };

  try {
    return await prisma.$transaction(
      async (tx) => {
        const current = await tx.creditLedger.aggregate({
          where: { tenantId },
          _sum: { delta: true },
        });
        const balance = current._sum.delta ?? 0;
        if (balance < rowCount) return { ok: false as const, balance };

        await tx.creditLedger.create({
          data: { tenantId, delta: -rowCount, reason: "RESERVE", ref: batchId },
        });
        return { ok: true as const, balance: balance - rowCount };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    // A duplicate means this batch is already held — a retried submit, not a
    // second charge. Idempotent success rather than a spurious refusal.
    if (isDuplicate(err)) {
      logger.info({ tenantId, batchId }, "batch already reserved — treating as held");
      return { ok: true, balance: await creditBalance(tenantId) };
    }
    // A serialization failure is a genuine loss of the race. Reporting it as
    // insufficient balance is correct AND is what the caller can act on; the
    // alternative is a 500 for a customer who simply submitted twice at once.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2034" || err.code === "P2028")
    ) {
      logger.warn({ tenantId, batchId, rowCount }, "credit reserve lost a write race");
      return { ok: false, balance: await creditBalance(tenantId) };
    }
    throw err;
  }
}

/**
 * Undo a hold in full.
 *
 * The submit path's rollback, mirroring releaseScanBatch(): every early return
 * below the reserve in /api/agency/scan gives the credits straight back. It is
 * a CONSUME_RELEASE of the whole amount, so it collides with — and is therefore
 * idempotent against — the completion release for the same batch. A batch that
 * failed at submit never reaches completion, so the two can never both need to
 * write.
 */
export async function releaseReservation(input: {
  tenantId: string;
  batchId: string;
  rowCount: number;
}): Promise<void> {
  const { tenantId, batchId, rowCount } = input;
  if (rowCount <= 0) return;

  try {
    await prisma.creditLedger.create({
      data: { tenantId, delta: rowCount, reason: "CONSUME_RELEASE", ref: batchId },
    });
  } catch (err) {
    if (isDuplicate(err)) return;
    // Never rethrow into the submit path's catch: the caller is already
    // handling a failure, and turning a released hold into a 500 would hide the
    // original error behind a second one. Logged loudly instead — a leaked hold
    // is a support ticket, not a crash.
    logger.error({ err, tenantId, batchId, rowCount }, "credit reservation release FAILED");
  }
}

/**
 * Give back the part of a batch's hold that was never spent.
 *
 * Called once, when the batch reaches its terminal state. `consumed` is the
 * number of rows whose Places lookup actually cost money.
 */
export async function releaseUnconsumed(input: {
  tenantId: string;
  batchId: string;
  reserved: number;
  consumed: number;
}): Promise<number> {
  const { tenantId, batchId, reserved, consumed } = input;
  const delta = releaseDelta(reserved, consumed);
  if (delta <= 0) return 0;

  try {
    await prisma.creditLedger.create({
      data: { tenantId, delta, reason: "CONSUME_RELEASE", ref: batchId },
    });
    return delta;
  } catch (err) {
    if (isDuplicate(err)) {
      logger.info({ tenantId, batchId }, "batch release already recorded — nothing given back");
      return 0;
    }
    throw err;
  }
}

/** What a batch is holding, for the completion release. */
export async function reservedFor(tenantId: string, batchId: string): Promise<number> {
  const row = await prisma.creditLedger.findUnique({
    where: {
      tenantId_reason_ref: { tenantId, reason: "RESERVE" as CreditReason, ref: batchId },
    },
    select: { delta: true },
  });
  // Stored negative; the callers all think in positive counts.
  return row ? Math.abs(row.delta) : 0;
}

export interface CreditHistoryRow {
  id: string;
  delta: number;
  reason: CreditReason;
  ref: string;
  createdAt: string;
}

/** The /billing history list, newest first. */
export async function creditHistory(
  tenantId: string,
  take: number = HISTORY_LIMIT,
): Promise<CreditHistoryRow[]> {
  const rows = await prisma.creditLedger.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, delta: true, reason: true, ref: true, createdAt: true },
  });

  return rows.map((row) => ({
    id: row.id,
    delta: row.delta,
    reason: row.reason,
    ref: row.ref,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Balance computed from rows the caller already holds. Re-exported for tests. */
export { balanceOf, type LedgerEntry };
