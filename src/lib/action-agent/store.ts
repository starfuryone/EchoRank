// src/lib/action-agent/store.ts
//
// Every read and write of `action_items`.
//
// EVERY QUERY HERE IS TENANT-SCOPED, IN THE WHERE CLAUSE. None of these
// functions takes a bare id and trusts it: `transition` and `updateDraft` both
// filter on (id, tenantId) inside the same statement that writes, so a guessed
// cuid from another tenant updates zero rows and comes back as a 404 — the same
// 404 a genuinely missing id gets, so this cannot be used to probe for ids
// either. Same bar as the citation-opportunities [id] route.
//
// TRANSITIONS ARE COMPARE-AND-SET. `transition` puts the EXPECTED CURRENT
// STATUS in the where clause, so two people clicking Approve on the same draft
// produce one write and one 409, not two writes and an audit trail that names
// the loser as the approver. Reading the row and then writing it would leave
// exactly that gap.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import {
  canTransition,
  type ActionItemDto,
  type ActionItemKind,
  type ActionItemStatus,
  type V1Kind,
} from "./types";

/** Page size for the review queue. */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

type ActionItemRow = Prisma.ActionItemGetPayload<Record<string, never>>;

export function toDto(row: ActionItemRow): ActionItemDto {
  return {
    id: row.id,
    kind: row.kind,
    sourceRef: row.sourceRef,
    draft: row.draft,
    status: row.status,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedNote: row.rejectedNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
  };
}

export interface CreateDraftInput {
  tenantId: string;
  kind: V1Kind;
  sourceRef: string;
  draft: unknown;
}

/**
 * Write one draft.
 *
 * NO UPSERT AND NO DEDUPE KEY. Two generations for the same page are two rows
 * on purpose: the second one exists because a human rejected or superseded the
 * first, and collapsing them would erase the decision. The queue's default
 * filter is `status=draft`, so the superseded row leaves the working view on
 * its own the moment it is rejected.
 */
export async function createDraft(input: CreateDraftInput): Promise<ActionItemDto> {
  const row = await prisma.actionItem.create({
    data: {
      tenantId: input.tenantId,
      kind: input.kind,
      sourceRef: input.sourceRef,
      draft: input.draft as Prisma.InputJsonValue,
    },
  });
  return toDto(row);
}

export interface ListActionItemsInput {
  tenantId: string;
  status?: ActionItemStatus;
  kind?: ActionItemKind;
  limit?: number;
}

export async function listActionItems(input: ListActionItemsInput): Promise<ActionItemDto[]> {
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE));
  const rows = await prisma.actionItem.findMany({
    where: {
      tenantId: input.tenantId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toDto);
}

/** One row, or null. Tenant-scoped by findFirst — never findUnique on a bare id. */
export async function getActionItem(
  tenantId: string,
  id: string,
): Promise<ActionItemDto | null> {
  const row = await prisma.actionItem.findFirst({ where: { id, tenantId } });
  return row ? toDto(row) : null;
}

/** Counts for the queue's tab badges, in one grouped read. */
export async function countByStatus(
  tenantId: string,
): Promise<Record<ActionItemStatus, number>> {
  const grouped = await prisma.actionItem.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { _all: true },
  });
  const counts: Record<ActionItemStatus, number> = {
    draft: 0,
    approved: 0,
    applied: 0,
    rejected: 0,
  };
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

/** Why a write did not happen. The route maps these onto status codes. */
export type WriteFailure = "not_found" | "not_editable" | "illegal_transition" | "conflict";

export type WriteResult =
  | { ok: true; item: ActionItemDto }
  | { ok: false; reason: WriteFailure; from?: ActionItemStatus };

/**
 * Replace a draft's payload. EDIT-IN-PLACE, and only while it is a draft.
 *
 * `status: "draft"` IS IN THE WHERE CLAUSE, not checked beforehand. Otherwise
 * an edit submitted from a stale tab could land on a row somebody approved a
 * second earlier, and the thing that got approved would not be the thing that
 * is stored.
 */
export async function updateDraft(
  tenantId: string,
  id: string,
  draft: unknown,
): Promise<WriteResult> {
  const updated = await prisma.actionItem.updateMany({
    where: { id, tenantId, status: "draft" },
    data: { draft: draft as Prisma.InputJsonValue },
  });

  if (updated.count === 0) {
    const existing = await getActionItem(tenantId, id);
    if (!existing) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "not_editable", from: existing.status };
  }

  const row = await getActionItem(tenantId, id);
  return row ? { ok: true, item: row } : { ok: false, reason: "not_found" };
}

export interface TransitionInput {
  tenantId: string;
  id: string;
  to: ActionItemStatus;
  /** User id, for the audit trail. Never a name. */
  actorUserId: string;
  /** Only read for a rejection. */
  note?: string | null;
  now?: Date;
}

/**
 * Move one item along the state machine.
 *
 * Returns the row it moved, or why it did not. The caller writes the audit_logs
 * entry — deliberately not done here, because this module has no request
 * context and an audit row without an ip address and an actor is half a record.
 */
export async function transition(input: TransitionInput): Promise<WriteResult> {
  const current = await getActionItem(input.tenantId, input.id);
  if (!current) return { ok: false, reason: "not_found" };

  if (!canTransition(current.status, input.to)) {
    return { ok: false, reason: "illegal_transition", from: current.status };
  }

  const now = input.now ?? new Date();
  const data: Prisma.ActionItemUpdateManyMutationInput = { status: input.to };

  if (input.to === "approved") {
    data.approvedBy = input.actorUserId;
    data.approvedAt = now;
  } else if (input.to === "rejected") {
    data.rejectedBy = input.actorUserId;
    data.rejectedAt = now;
    data.rejectedNote = input.note?.trim() || null;
  } else if (input.to === "applied") {
    data.appliedAt = now;
  }

  // Compare-and-set: the status we read is in the filter, so a concurrent
  // writer that moved it first makes this a zero-row update rather than a
  // silent overwrite.
  const updated = await prisma.actionItem.updateMany({
    where: { id: input.id, tenantId: input.tenantId, status: current.status },
    data,
  });

  if (updated.count === 0) return { ok: false, reason: "conflict", from: current.status };

  const row = await getActionItem(input.tenantId, input.id);
  return row ? { ok: true, item: row } : { ok: false, reason: "not_found" };
}

/**
 * The sourceRef a re-generation should reuse.
 *
 * Re-generating after a rejection is a NEW row carrying the SAME sourceRef —
 * `rejected` is terminal and never reopens. This exists so the caller does not
 * have to reconstruct a URL or a review id from the UI to do that, and so the
 * kind comes from the row rather than from the client.
 */
export async function regenerationSource(
  tenantId: string,
  id: string,
): Promise<{ kind: ActionItemKind; sourceRef: string } | null> {
  const row = await prisma.actionItem.findFirst({
    where: { id, tenantId },
    select: { kind: true, sourceRef: true },
  });
  return row ?? null;
}
