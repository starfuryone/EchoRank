// src/lib/purchase-archive/writer.ts — puts one prepared object in the bucket
// and its row in purchase_archive; drains the spool; writes the daily manifest;
// raises the spool alert.
//
// ── IDEMPOTENT BY ROW, NOT BY LUCK ─────────────────────────────────────────
// storeObject() reserves the index row first (dedupeKey is unique), then
// uploads, then stamps storedAt. So:
//   - a duplicate capture (same task, or same request at the same instant)
//     finds a stored row and writes nothing;
//   - a retry after a failed upload finds its own unstored row and uploads to
//     that row's key, never a second object;
//   - two workers racing on one capture: one insert wins, the other sees the
//     unique violation and re-reads.
// Runs only in the workers process (the purchase-archive queue) and in
// scripts; the web process only captures and enqueues.

import "server-only";

import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { manifestKey, manifestLine, objectMetadata, type ManifestRow, type PreparedObject } from "./core";
import { ARCHIVE_APP, SPOOL_ALERT_BYTES, SPOOL_ALERT_FILES } from "./config";
import type { ObjectStore } from "@/lib/spaces/client";
import { listSpool, readSpool, removeSpool, spoolStats } from "./spool";

const gzipAsync = promisify(gzip);

/** The index-table operations the writer needs (Prisma in production, a fake in tests). */
export interface ArchiveIndex {
  find(dedupeKey: string): Promise<{ s3Key: string; storedAt: Date | null } | null>;
  /** Insert the reservation. Returns false on a dedupeKey conflict. */
  reserve(o: PreparedObject): Promise<boolean>;
  markStored(dedupeKey: string, at: Date): Promise<void>;
  /** Stored rows created in [from, to), oldest first. */
  rowsBetween(from: Date, to: Date): Promise<ManifestRow[]>;
}

export type StoreOutcome = "stored" | "duplicate";

export async function storeObject(o: PreparedObject, deps: { store: ObjectStore; index: ArchiveIndex; now?: () => Date }): Promise<StoreOutcome> {
  const now = deps.now ?? (() => new Date());
  let row = await deps.index.find(o.dedupeKey);
  if (row?.storedAt) return "duplicate";
  if (!row) {
    if (!(await deps.index.reserve(o))) {
      row = await deps.index.find(o.dedupeKey);
      if (!row || row.storedAt) return "duplicate";
    }
  }
  const key = row?.s3Key ?? o.s3Key;
  await deps.store.put(key, o.gz, {
    contentType: "application/json",
    contentLength: o.gz.length,
    metadata: { ...objectMetadata(o), "content-encoding": "gzip" },
  });
  await deps.index.markStored(o.dedupeKey, now());
  return "stored";
}

export interface DrainResult {
  uploaded: number;
  duplicates: number;
  /** Left in the spool: the first failure stops the drain so order is kept. */
  remaining: number;
  failed: boolean;
}

/** Upload spooled objects oldest first; stop at the first failure (Spaces down). */
export async function drainSpool(deps: { store: ObjectStore; index: ArchiveIndex; dir?: string; limit?: number }): Promise<DrainResult> {
  const names = await listSpool(deps.dir);
  const limit = deps.limit ?? 500;
  let uploaded = 0;
  let duplicates = 0;
  let failed = false;
  for (const name of names.slice(0, limit)) {
    let obj: PreparedObject;
    try {
      obj = await readSpool(name, deps.dir);
    } catch {
      // A file that cannot be parsed stays for a human; it is never deleted unread.
      continue;
    }
    try {
      const out = await storeObject(obj, { store: deps.store, index: deps.index });
      if (out === "stored") uploaded++;
      else duplicates++;
      await removeSpool(name, deps.dir);
    } catch {
      failed = true;
      break;
    }
  }
  const remaining = (await listSpool(deps.dir)).length;
  return { uploaded, duplicates, remaining, failed };
}

export interface SpoolAlertDeps {
  dir?: string;
  /** More spool directories counted into the same thresholds (the page spool). */
  extraDirs?: string[];
  /** SET NX for today's alert; true when this call claimed it. */
  claimToday: (day: string) => Promise<boolean>;
  post: (line: string) => Promise<boolean>;
  now?: () => Date;
}

/** At most one alert per UTC day, only past 1,000 files or 1 GB. */
export async function checkSpoolAlert(deps: SpoolAlertDeps): Promise<{ alerted: boolean; files: number; bytes: number }> {
  let { files, bytes } = await spoolStats(deps.dir);
  for (const d of deps.extraDirs ?? []) {
    const s = await spoolStats(d);
    files += s.files;
    bytes += s.bytes;
  }
  if (files <= SPOOL_ALERT_FILES && bytes <= SPOOL_ALERT_BYTES) return { alerted: false, files, bytes };
  const day = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
  if (!(await deps.claimToday(day))) return { alerted: false, files, bytes };
  const gb = (bytes / 1024 ** 3).toFixed(2);
  await deps.post(`Echorank archive: the spool holds ${files} objects (${gb} GB) waiting for Spaces. Check PURCHASE_ARCHIVE_* / SPACES_ARCHIVE_* and the buckets.`);
  return { alerted: true, files, bytes };
}

/** Write v1/echorank/_manifests/<day>.ndjson.gz from the index rows of that UTC day. */
export async function writeManifest(day: Date, deps: { store: ObjectStore; index: ArchiveIndex }): Promise<{ key: string; lines: number }> {
  const from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const to = new Date(from.getTime() + 86_400_000);
  const rows = await deps.index.rowsBetween(from, to);
  const body = rows.map(manifestLine).join("\n") + (rows.length ? "\n" : "");
  const gz = await gzipAsync(Buffer.from(body, "utf8"));
  const key = manifestKey(ARCHIVE_APP, from);
  await deps.store.put(key, gz, { contentType: "application/x-ndjson", contentLength: gz.length, metadata: { app: ARCHIVE_APP, lines: String(rows.length), "content-encoding": "gzip" } });
  return { key, lines: rows.length };
}
