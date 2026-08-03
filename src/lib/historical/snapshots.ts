// src/lib/historical/snapshots.ts
//
// Storing and retrieving page snapshots.
//
// THE THREE RULES, in the order they apply on insert:
//   1. SIZE   — reject a body over MAX_SNAPSHOT_BYTES before anything is stored
//   2. DEDUPE — identical content for this url writes no row and uploads nothing
//   3. PRUNE  — over MAX_SNAPSHOTS_PER_TENANT, delete oldest first, but NEVER
//               the newest snapshot of any url
//
// Rule 3's exception is the one that matters. A tenant tracking 40 urls who
// captures one of them daily would, under naive oldest-first pruning, silently
// lose the only snapshot of the other 39 — the tool would quietly delete the
// history it exists to keep. So the newest row per url is never eligible.

import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";
import {
  MAX_SNAPSHOT_BYTES,
  MAX_SNAPSHOTS_PER_TENANT,
  type SnapshotSource,
} from "./options";
import {
  deleteSnapshotObject,
  getSnapshotObject,
  putSnapshotObject,
  snapshotObjectKey,
} from "./spaces";

export class SnapshotTooLargeError extends Error {
  readonly statusCode = 413;
  constructor(readonly sizeBytes: number) {
    super(
      `That page is ${Math.round(sizeBytes / 1024)} KB of text, over the ${Math.round(
        MAX_SNAPSHOT_BYTES / 1024,
      )} KB limit for one snapshot.`,
    );
    this.name = "SnapshotTooLargeError";
  }
}

export function hashContent(markdown: string): string {
  return createHash("sha256").update(markdown, "utf8").digest("hex");
}

export interface StoreSnapshotInput {
  tenantId: string;
  url: string;
  markdown: string;
  source: SnapshotSource;
  /** Content time, not storage time. Wayback passes the archive's stamp. */
  capturedAt: Date;
}

export interface StoreSnapshotResult {
  /** False when an identical snapshot already existed for this url. */
  created: boolean;
  snapshotId: string | null;
  contentHash: string;
  sizeBytes: number;
  /** Rows removed to stay under the cap. */
  pruned: number;
}

/**
 * Store one snapshot, applying all three rules.
 *
 * Ordering note: the object is uploaded BEFORE the row is written. A row whose
 * object is missing renders as a broken snapshot; an object with no row is
 * invisible garbage that the next identical capture reuses. The second failure
 * is strictly cheaper.
 */
export async function storeSnapshot(input: StoreSnapshotInput): Promise<StoreSnapshotResult> {
  const sizeBytes = Buffer.byteLength(input.markdown, "utf8");
  if (sizeBytes > MAX_SNAPSHOT_BYTES) throw new SnapshotTooLargeError(sizeBytes);

  const contentHash = hashContent(input.markdown);

  // 2. Dedupe against the LATEST snapshot of this url, per the brief. An older
  // identical capture is not a duplicate — a page that changed and changed back
  // is a real finding, and collapsing it would hide the round trip.
  const latest = await prisma.pageSnapshot.findFirst({
    where: { tenantId: input.tenantId, url: input.url },
    orderBy: { capturedAt: "desc" },
    select: { contentHash: true },
  });
  if (latest?.contentHash === contentHash) {
    return { created: false, snapshotId: null, contentHash, sizeBytes, pruned: 0 };
  }

  const objectKey = snapshotObjectKey(input.tenantId, contentHash);
  await putSnapshotObject(objectKey, gzipSync(Buffer.from(input.markdown, "utf8")));

  const row = await prisma.pageSnapshot.create({
    data: {
      tenantId: input.tenantId,
      url: input.url,
      capturedAt: input.capturedAt,
      contentHash,
      objectKey,
      sizeBytes,
      source: input.source,
    },
    select: { id: true },
  });

  const pruned = await pruneSnapshots(input.tenantId);

  return { created: true, snapshotId: row.id, contentHash, sizeBytes, pruned };
}

/**
 * Bring a tenant back under the cap.
 *
 * Returns the number of rows deleted. Never deletes the newest snapshot of any
 * url — see the note at the top of this file.
 */
export async function pruneSnapshots(tenantId: string): Promise<number> {
  const total = await prisma.pageSnapshot.count({ where: { tenantId } });
  if (total <= MAX_SNAPSHOTS_PER_TENANT) return 0;

  const all = await prisma.pageSnapshot.findMany({
    where: { tenantId },
    orderBy: { capturedAt: "asc" },
    select: { id: true, url: true, capturedAt: true, objectKey: true, contentHash: true },
  });

  // The protected set: newest row per url.
  const newestPerUrl = new Map<string, string>();
  for (const row of all) newestPerUrl.set(row.url, row.id); // ascending, so last wins
  const protectedIds = new Set(newestPerUrl.values());

  const overBy = total - MAX_SNAPSHOTS_PER_TENANT;
  const doomed = all.filter((r) => !protectedIds.has(r.id)).slice(0, overBy);
  if (doomed.length === 0) return 0;

  await prisma.pageSnapshot.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } });

  // Objects are content-addressed and shared, so delete one only when no row
  // anywhere still points at that hash.
  const hashes = [...new Set(doomed.map((d) => d.contentHash))];
  for (const hash of hashes) {
    const stillUsed = await prisma.pageSnapshot.count({ where: { tenantId, contentHash: hash } });
    if (stillUsed > 0) continue;
    try {
      await deleteSnapshotObject(snapshotObjectKey(tenantId, hash));
    } catch {
      // An orphaned object costs pennies; failing the capture that triggered
      // the prune costs the user their snapshot.
    }
  }

  return doomed.length;
}

/** Snapshot body as markdown. Tenant-scoped; throws if the row is not theirs. */
export async function readSnapshotMarkdown(
  tenantId: string,
  snapshotId: string,
): Promise<string | null> {
  // findFirst on both keys, never findUnique by id alone.
  const row = await prisma.pageSnapshot.findFirst({
    where: { id: snapshotId, tenantId },
    select: { objectKey: true },
  });
  if (!row) return null;
  const gz = await getSnapshotObject(row.objectKey);
  return gunzipSync(gz).toString("utf8");
}

export interface SnapshotListItem {
  id: string;
  url: string;
  capturedAt: string;
  source: string;
  sizeBytes: number;
  contentHash: string;
}

export async function listSnapshotUrls(
  tenantId: string,
): Promise<Array<{ url: string; count: number; latest: string }>> {
  const rows = await prisma.pageSnapshot.findMany({
    where: { tenantId },
    orderBy: { capturedAt: "desc" },
    select: { url: true, capturedAt: true },
  });
  const byUrl = new Map<string, { count: number; latest: Date }>();
  for (const row of rows) {
    const prior = byUrl.get(row.url);
    if (prior) {
      prior.count++;
      if (row.capturedAt > prior.latest) prior.latest = row.capturedAt;
    } else {
      byUrl.set(row.url, { count: 1, latest: row.capturedAt });
    }
  }
  return [...byUrl.entries()]
    .map(([url, v]) => ({ url, count: v.count, latest: v.latest.toISOString() }))
    .sort((a, b) => b.latest.localeCompare(a.latest));
}

export async function listSnapshots(
  tenantId: string,
  url: string,
): Promise<SnapshotListItem[]> {
  const rows = await prisma.pageSnapshot.findMany({
    where: { tenantId, url },
    orderBy: { capturedAt: "desc" },
    select: { id: true, url: true, capturedAt: true, source: true, sizeBytes: true, contentHash: true },
  });
  return rows.map((r) => ({ ...r, capturedAt: r.capturedAt.toISOString() }));
}
