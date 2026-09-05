// src/lib/research-log/store.ts
//
// The one helper every billable analysis calls on delivered success, and the
// reads that hand the log back to the hub panel and the MCP tool.
//
// ── recordResearch NEVER THROWS ────────────────────────────────────────────
// This is the single most important property in the file, and it is the reason
// the whole body sits inside a try/catch.
//
// The log is ADVISORY. It records that a paid analysis happened; it is not
// part of that analysis. So a failure to write it must not fail the analysis —
// the customer has already been charged by the provider and already has their
// result, and throwing here would turn a successful, paid-for lookup into a
// 500 with the money gone. That is strictly worse than a missing log row.
//
// It is also what makes this shippable ahead of its own migration. On this box
// the database user cannot create a shadow database, so `research_log` is
// created by hand (see the migration file). Until someone runs it, every write
// here fails with "relation does not exist", is logged once, and is swallowed —
// SERP checks, backlinks lookups and crawls all keep working, and the log
// simply starts filling the day the table exists.
//
// The failure is logged rather than silenced completely: a log that has been
// quietly failing for a month is indistinguishable from a workspace that ran
// nothing, and the only place that difference is visible is the server log.

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  RESEARCH_LOG_PANEL_LIMIT,
  RESEARCH_REUSE_WINDOW_MS,
  isResearchFeature,
  type ResearchFeature,
  type ResearchLogEntry,
} from "./types";

export interface RecordResearchInput {
  tenantId: string;
  feature: ResearchFeature;
  /** Already normalised by the feature — this does not re-parse it. */
  target: string;
  /** Counts and identifiers only. No prose; see the schema comment. */
  metrics?: Record<string, number | string>;
  /** What the provider charged. Read off the envelopes, never a price table. */
  costUsd?: number;
  /** Id of the row holding the result, in the feature's own table. */
  sourceRef?: string | null;
  now?: Date;
}

/**
 * Append one entry. Call from a service's SUCCESS path, after the result row
 * is persisted — never before, and never from a failure branch: a log of
 * research nobody received is worse than no log.
 *
 * Returns the new row's id, or null when the write failed (see the header).
 */
export async function recordResearch(input: RecordResearchInput): Promise<string | null> {
  try {
    const row = await prisma.researchLog.create({
      data: {
        tenantId: input.tenantId,
        feature: input.feature,
        // Domain-shaped targets are lowercased so "Example.com" and
        // "example.com" are one target for the reuse lookup. Keywords keep
        // their case: "Apple" and "apple" are the same query to Google, but
        // showing a customer back a keyword they did not type reads as a bug.
        target: input.target.trim().slice(0, 2000),
        metrics: input.metrics ?? undefined,
        costUsd: input.costUsd ?? 0,
        sourceRef: input.sourceRef ?? null,
        createdAt: input.now ?? new Date(),
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error(
      `[research-log] write failed (tenant=${input.tenantId} feature=${input.feature} target=${input.target}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Prisma row -> the shape every surface receives. */
function toEntry(
  row: {
    id: string;
    feature: string;
    target: string;
    metrics: unknown;
    costUsd: unknown;
    sourceRef: string | null;
    createdAt: Date;
  },
  now: Date,
): ResearchLogEntry {
  const ageHours = Math.max(0, (now.getTime() - row.createdAt.getTime()) / 3_600_000);
  return {
    id: row.id,
    // A row written before a feature key was retired would otherwise widen the
    // union by lying. Unknown keys fall back to the closest honest thing we
    // have — the raw string — and the caller's catalog lookup misses loudly.
    feature: (isResearchFeature(row.feature) ? row.feature : row.feature) as ResearchFeature,
    target: row.target,
    metrics:
      row.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics)
        ? (row.metrics as Record<string, number | string>)
        : null,
    costUsd: Number(row.costUsd),
    sourceRef: row.sourceRef,
    createdAt: row.createdAt.toISOString(),
    ageHours: Number(ageHours.toFixed(2)),
    reusable: now.getTime() - row.createdAt.getTime() <= RESEARCH_REUSE_WINDOW_MS,
  };
}

const ENTRY_SELECT = {
  id: true,
  feature: true,
  target: true,
  metrics: true,
  costUsd: true,
  sourceRef: true,
  createdAt: true,
} as const;

/**
 * Recent research for one workspace, newest first.
 *
 * Reads fail SOFT for the same reason writes do: the hub panel must render
 * before the migration is applied, and an empty panel is a correct rendering
 * of "nothing logged yet".
 */
export async function readResearchLog(
  tenantId: string,
  opts?: { limit?: number; feature?: ResearchFeature; target?: string; now?: Date },
): Promise<ResearchLogEntry[]> {
  const now = opts?.now ?? new Date();
  try {
    const rows = await prisma.researchLog.findMany({
      where: {
        tenantId,
        ...(opts?.feature ? { feature: opts.feature } : {}),
        ...(opts?.target ? { target: opts.target } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? RESEARCH_LOG_PANEL_LIMIT,
      select: ENTRY_SELECT,
    });
    return rows.map((row) => toEntry(row, now));
  } catch (err) {
    console.error(
      `[research-log] read failed (tenant=${tenantId}):`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * The reuse probe: the newest entry for this exact (feature, target) inside the
 * reuse window, or null.
 *
 * ADVISORY, AND NOT A CACHE. It answers "is there already an answer to this
 * question" — it does not return the answer, and nothing here decides whether a
 * call may proceed. The per-tool caches (24h) are what actually prevent a
 * repeat purchase; this is what a human or an agent consults before choosing to
 * spend at all.
 */
export async function findRecentResearch(
  tenantId: string,
  feature: ResearchFeature,
  target: string,
  now = new Date(),
): Promise<ResearchLogEntry | null> {
  try {
    const row = await prisma.researchLog.findFirst({
      where: {
        tenantId,
        feature,
        target: target.trim(),
        createdAt: { gte: new Date(now.getTime() - RESEARCH_REUSE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: ENTRY_SELECT,
    });
    return row ? toEntry(row, now) : null;
  } catch (err) {
    console.error(
      `[research-log] reuse probe failed (tenant=${tenantId} feature=${feature}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
