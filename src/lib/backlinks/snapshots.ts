// src/lib/backlinks/snapshots.ts
//
// The history series behind the Full tier's sparkline.
//
// ── THE WRITE FAILS SOFT, FOR THE SAME REASON THE RESEARCH LOG DOES ────────
// It runs after a lookup the customer has already been charged for. Failing
// their request because a chart point could not be stored would be the worst
// possible trade, and it is also what lets this ship ahead of its own
// migration: until someone applies backlink_snapshots, every write logs and
// returns, and the tool works exactly as it did.
//
// ── WRITTEN ON EVERY TIER ──────────────────────────────────────────────────
// Basic tenants record history they cannot yet see. That is deliberate: the
// data is already paid for, and a tier that begins recording only on upgrade
// shows an empty chart for weeks — precisely when the feature has to justify
// the upgrade. The capability gates the READ.

import "server-only";

import { prisma } from "@/lib/prisma";
import type { BacklinksMode } from "./target";
import type { SummarySection } from "./types";
// The point shape and MIN_HISTORY_POINTS live in a PURE module: the client
// component needs both, and this file imports prisma.
import type { BacklinkSnapshotPoint } from "./snapshot-shape";
export { MIN_HISTORY_POINTS, type BacklinkSnapshotPoint } from "./snapshot-shape";

/** Round a possibly-absent provider figure to an integer, or null. */
function intOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

/**
 * Record one point. Never throws.
 *
 * Called only on a FRESH fetch — a cache hit records nothing, because the
 * numbers have not changed and a chart with five identical points on five
 * consecutive days would imply five measurements.
 */
export async function recordBacklinkSnapshot(input: {
  tenantId: string;
  target: string;
  mode: BacklinksMode;
  summary: SummarySection | null;
  now?: Date;
}): Promise<void> {
  if (!input.summary) return;
  try {
    await prisma.backlinkSnapshot.create({
      data: {
        tenantId: input.tenantId,
        target: input.target,
        mode: input.mode,
        backlinks: Math.round(input.summary.backlinks ?? 0),
        referringDomains: Math.round(input.summary.referringDomains ?? 0),
        // Null, not 0: a prefix scope has no rank the provider will report, and
        // a zero on the chart would read as "your authority collapsed".
        rank: intOrNull(input.summary.rank),
        brokenBacklinks: intOrNull(input.summary.brokenBacklinks),
        dofollowDomains: intOrNull(input.summary.dofollowDomains),
        capturedAt: input.now ?? new Date(),
      },
    });
  } catch (err) {
    console.error(
      `[backlinks] snapshot write failed (tenant=${input.tenantId} target=${input.target}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * The series for one target, oldest first.
 *
 * Reads fail soft too, so the page renders with no chart rather than a 500 on
 * a deployment where the table does not exist yet.
 */
export async function readBacklinkHistory(
  tenantId: string,
  target: string,
  mode: BacklinksMode,
  take = 90,
): Promise<BacklinkSnapshotPoint[]> {
  try {
    const rows = await prisma.backlinkSnapshot.findMany({
      where: { tenantId, target, mode },
      orderBy: { capturedAt: "asc" },
      take,
      select: {
        backlinks: true,
        referringDomains: true,
        rank: true,
        capturedAt: true,
      },
    });
    return rows.map((row) => ({
      date: row.capturedAt.toISOString().slice(0, 10),
      backlinks: row.backlinks,
      referringDomains: row.referringDomains,
      rank: row.rank,
    }));
  } catch (err) {
    console.error(
      `[backlinks] snapshot read failed (tenant=${tenantId} target=${target}):`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
