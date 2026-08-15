// src/lib/opportunity-scanner/store.ts
//
// Every read and write for the Agency Opportunity Scanner.
//
// ── Tenant scoping, and why every signature here takes a tenantId ───────────
// ScanRow has no tenantId column — it hangs off ScanBatch. That is the right
// normalisation and it is also the trap this module exists to close: the
// obvious query for "give me the rows of batch X" is
// `scanRow.findMany({ where: { batchId } })`, which is correct, cheap, indexed,
// and hands one agency another agency's prospect list.
//
// So NOTHING here takes a bare batchId. Every function takes (tenantId,
// batchId) and filters through the relation — `where: { batch: { tenantId } }`
// — and the route layer never touches prisma.scanRow directly. The tests assert
// this by asking for one tenant's batch as another tenant and expecting empty,
// on every read path including the single-row lookup the PDF download uses,
// which is the one most easily written as a bare id.
//
// ── The worker updates rows it was handed, not rows it queried ──────────────
// completeRow/failRow take the row id AND the batch id, and the increment of
// ScanBatch.done happens in the same transaction as the row's terminal state.
// Two separate writes would let a crash between them leave a batch that never
// reaches `total` and therefore never fires its completion notification — a
// batch stuck at 999/1000 forever, which is worse than a wrong count because
// nothing ever corrects it.

import { prisma } from "@/lib/prisma";
import type { Prisma, ScanRowStatus } from "@/generated/prisma";
import { gradeRank, type TopGap } from "./grade";
import type { PlaceStanding } from "./places";

/** Rows returned by the batch detail read. Also the CSV's row shape. */
export interface ScanRowDto {
  id: string;
  domain: string;
  score: number | null;
  grade: string | null;
  topGaps: TopGap[];
  place: PlaceStanding | null;
  status: ScanRowStatus;
  error: string | null;
  completedAt: Date | null;
}

export interface ScanBatchDto {
  id: string;
  status: "running" | "complete";
  total: number;
  done: number;
  placesEnabled: boolean;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * A batch and its accepted rows, in one transaction.
 *
 * `skipDuplicates` on the row insert rather than a pre-check: the caller has
 * already deduped (parse.ts), so a collision here means a double-submit, and
 * making that idempotent is better than making it an error the agency has to
 * read and dismiss.
 */
export async function createBatch(input: {
  tenantId: string;
  domains: string[];
  placesEnabled: boolean;
}): Promise<ScanBatchDto> {
  const { tenantId, domains, placesEnabled } = input;

  return prisma.$transaction(async (tx) => {
    const batch = await tx.scanBatch.create({
      data: {
        tenantId,
        total: domains.length,
        placesEnabled,
      },
    });

    if (domains.length > 0) {
      await tx.scanRow.createMany({
        data: domains.map((domain) => ({ batchId: batch.id, domain })),
        skipDuplicates: true,
      });
    }

    return toBatchDto(batch);
  });
}

/**
 * Remove a batch that was created but never enqueued.
 *
 * THE SUBMIT PATH'S ROLLBACK, and its only caller: a batch has to exist before
 * its credits can be held (the ledger row is keyed on the batch id), so a hold
 * that loses the race leaves a committed batch with no workers behind it. That
 * row would sit in the customer's list at 0 of N forever, so it is deleted
 * rather than left as a permanently-running scan.
 *
 * TENANT-SCOPED via deleteMany rather than delete-by-id: a stray id must not be
 * able to remove another tenant's batch even through a bug upstream, and
 * deleteMany with no match is a no-op instead of a throw — which is what we
 * want in a rollback path that is already handling a failure.
 *
 * ScanRow cascades from the batch, so the rows go with it.
 */
export async function deleteBatch(batchId: string, tenantId: string): Promise<void> {
  await prisma.scanBatch.deleteMany({ where: { id: batchId, tenantId } });
}

/** This tenant's batches, newest first. The batch list. */
export async function listBatches(
  tenantId: string,
  limit = 50,
): Promise<ScanBatchDto[]> {
  const rows = await prisma.scanBatch.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toBatchDto);
}

/**
 * One batch, or null.
 *
 * findFirst with tenantId, never findUnique on the id — the rule in CLAUDE.md,
 * and the reason is this exact model: the id is a cuid an agency can read off
 * its own URL bar and change one character of.
 */
export async function getBatch(
  tenantId: string,
  batchId: string,
): Promise<ScanBatchDto | null> {
  const batch = await prisma.scanBatch.findFirst({
    where: { id: batchId, tenantId },
  });
  return batch ? toBatchDto(batch) : null;
}

/**
 * One batch's rows, worst grade first.
 *
 * SORTED IN JS, NOT IN SQL, and this is the one place that is deliberate. The
 * order the agency wants is F, D, C, B, A, then failed rows last — which is
 * neither ascending nor descending on the stored letter, because "no grade"
 * has to land at the bottom rather than wherever NULLS FIRST/LAST puts it
 * relative to a letter. Expressing that in Postgres means a CASE in the ORDER
 * BY, which the (batchId, grade) index cannot serve anyway, so the sort would
 * be in memory either way — just in the database's memory instead of ours,
 * with the band definition living in a SQL string. A batch is capped at 1,000
 * rows; sorting 1,000 objects is free.
 */
export async function listRows(
  tenantId: string,
  batchId: string,
): Promise<ScanRowDto[]> {
  const rows = await prisma.scanRow.findMany({
    where: { batchId, batch: { tenantId } },
  });

  return rows
    .map(toRowDto)
    .sort(
      (a, b) =>
        gradeRank(a.grade) - gradeRank(b.grade) ||
        (a.score ?? 999) - (b.score ?? 999) ||
        a.domain.localeCompare(b.domain),
    );
}

/** One row, for the outreach PDF. Tenant-scoped through the batch relation. */
export async function getRow(
  tenantId: string,
  batchId: string,
  rowId: string,
): Promise<ScanRowDto | null> {
  const row = await prisma.scanRow.findFirst({
    where: { id: rowId, batchId, batch: { tenantId } },
  });
  return row ? toRowDto(row) : null;
}

/** Domains still to scan, for the worker's enqueue pass. */
export async function queuedRows(
  batchId: string,
): Promise<Array<{ id: string; domain: string }>> {
  return prisma.scanRow.findMany({
    where: { batchId, status: "queued" },
    select: { id: true, domain: true },
  });
}

export async function markRowRunning(rowId: string): Promise<void> {
  await prisma.scanRow.updateMany({
    where: { id: rowId, status: "queued" },
    data: { status: "running" },
  });
}

/**
 * A row reached a terminal state, and the batch's counter moved with it.
 *
 * ONE TRANSACTION, and the return value says whether this was the row that
 * finished the batch — computed from the incremented count inside the same
 * transaction, so exactly one of N concurrent workers can ever see it. The
 * notification fires off that boolean. Reading `done` back in a second query
 * would let two workers both see total===done and send two notifications for
 * one batch.
 */
async function finishRow(
  batchId: string,
  rowId: string,
  data: Prisma.ScanRowUpdateInput,
): Promise<{ batchComplete: boolean; total: number; done: number }> {
  return prisma.$transaction(async (tx) => {
    await tx.scanRow.update({
      where: { id: rowId },
      data: { ...data, completedAt: new Date() },
    });

    const batch = await tx.scanBatch.update({
      where: { id: batchId },
      data: { done: { increment: 1 } },
      select: { total: true, done: true, status: true },
    });

    const reached = batch.done >= batch.total;
    // The status flip is guarded on the CURRENT status so it happens once. A
    // batch already marked complete (a retry, a manual re-run) does not fire a
    // second notification.
    const firstToFinish = reached && batch.status === "running";
    if (firstToFinish) {
      await tx.scanBatch.update({
        where: { id: batchId },
        data: { status: "complete", completedAt: new Date() },
      });
    }

    return { batchComplete: firstToFinish, total: batch.total, done: batch.done };
  });
}

export async function completeRow(input: {
  batchId: string;
  rowId: string;
  score: number;
  grade: string;
  topGaps: TopGap[];
  place: PlaceStanding | null;
  /**
   * Whether the Places lookup was billed — PlaceLookupResult.costUsd > 0, not
   * `place != null`. See ScanRow.placesCharged for why the two differ and why
   * using the wrong one refunds every prospect that has no listing.
   */
  placesCharged?: boolean;
}): Promise<{ batchComplete: boolean; total: number; done: number }> {
  return finishRow(input.batchId, input.rowId, {
    status: "done",
    score: input.score,
    grade: input.grade,
    topGaps: input.topGaps as unknown as Prisma.InputJsonValue,
    place: (input.place ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
    placesCharged: input.placesCharged ?? false,
    error: null,
  });
}

/**
 * How many of a batch's rows were billed for a Places lookup.
 *
 * The denominator of the completion release: the batch reserved one credit per
 * row, and everything this does NOT count goes back. A failed row never reaches
 * the Places step at all, so it is false here and refunded, which is the
 * behaviour a customer would expect — they were not shown a listing, and they
 * do not pay for one.
 */
export async function chargedRowCount(batchId: string): Promise<number> {
  return prisma.scanRow.count({ where: { batchId, placesCharged: true } });
}

export async function failRow(input: {
  batchId: string;
  rowId: string;
  error: string;
}): Promise<{ batchComplete: boolean; total: number; done: number }> {
  return finishRow(input.batchId, input.rowId, {
    status: "failed",
    // Capped: this is an upstream message and it renders in a table cell.
    error: input.error.slice(0, 300),
  });
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

type BatchModel = Awaited<ReturnType<typeof prisma.scanBatch.create>>;
type RowModel = Awaited<ReturnType<typeof prisma.scanRow.create>>;

function toBatchDto(b: BatchModel): ScanBatchDto {
  return {
    id: b.id,
    status: b.status,
    total: b.total,
    done: b.done,
    placesEnabled: b.placesEnabled,
    createdAt: b.createdAt,
    completedAt: b.completedAt,
  };
}

function toRowDto(r: RowModel): ScanRowDto {
  return {
    id: r.id,
    domain: r.domain,
    score: r.score,
    grade: r.grade,
    // jsonb read back weeks later: assume nothing about its shape. A worker
    // whose output format changed must thin the row, not break the page.
    topGaps: Array.isArray(r.topGaps) ? (r.topGaps as unknown as TopGap[]) : [],
    place:
      r.place && typeof r.place === "object" && !Array.isArray(r.place)
        ? (r.place as unknown as PlaceStanding)
        : null,
    status: r.status,
    error: r.error,
    completedAt: r.completedAt,
  };
}
