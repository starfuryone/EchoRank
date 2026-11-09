// src/lib/archive-retrieval.ts — the admin retrieval commands
// (ECHORANK-DATA-ARCHIVE.md Phase 4), behind scripts/archive-cli.ts:
//
//   archive:list        --tenant T [--source crawl|ai-lens|audit] [--from D] [--to D]
//   archive:get         --tenant T --url U --date D     (the nearest page snapshot)
//   archive:get         --provider P --endpoint E --hash H [--date D]   (a purchased response)
//   archive:restore-run --tenant T --run R [--source crawl]  (a run's pages and tables)
//
// READ-ONLY: nothing in either bucket or in Postgres is changed. Output goes
// to a local folder (mode 700, files 600), never to a URL. Staff tooling: it
// runs as echorank on the box, and no route calls it.

import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { Readable } from "node:stream";
import { PAGE_SOURCES, pagesPrefix, tenantPrefix, type ObjectStore, type PageSource } from "@/lib/spaces/client";
import { endpointSlug } from "@/lib/purchase-archive/core";
import { urlHash } from "@/lib/page-archive/writer";

async function readAll(s: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of s) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

async function getJson<T>(store: ObjectStore, key: string): Promise<T | null> {
  try {
    const buf = await readAll(await store.get(key));
    const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface RunListing {
  source: PageSource;
  runId: string;
  createdAt: string | null;
  count: number | null;
  bytes: number | null;
  /** A run without a manifest is incomplete. */
  complete: boolean;
}

function inRange(at: string | null, from?: Date, to?: Date): boolean {
  if (!from && !to) return true;
  if (!at) return false;
  const t = new Date(at).getTime();
  return (!from || t >= from.getTime()) && (!to || t < to.getTime() + 86_400_000);
}

export async function listRuns(store: ObjectStore, q: { tenantId: string; source?: PageSource; from?: Date; to?: Date }): Promise<RunListing[]> {
  const out: RunListing[] = [];
  for (const source of q.source ? [q.source] : PAGE_SOURCES) {
    const base = `${tenantPrefix(q.tenantId)}pages/${source}/`;
    for (const p of await store.listPrefixes(base)) {
      const runId = p.slice(base.length).replace(/\/$/, "");
      const m = await getJson<{ createdAt?: string; count?: number; bytes?: number }>(store, `${p}manifest.json`);
      const row: RunListing = { source, runId, createdAt: m?.createdAt ?? null, count: m?.count ?? null, bytes: m?.bytes ?? null, complete: Boolean(m) };
      if (inRange(row.createdAt, q.from, q.to)) out.push(row);
    }
  }
  return out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

async function writeOut(outDir: string, rel: string, body: Buffer): Promise<string> {
  const path = join(outDir, rel);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, body, { mode: 0o600 });
  return path;
}

/** The snapshot of `url` fetched nearest to `date`, across every run of the tenant; files written to outDir. */
export async function getNearestPage(
  store: ObjectStore,
  q: { tenantId: string; url: string; date: Date; outDir: string },
): Promise<{ source: PageSource; runId: string; fetchedAt: string; files: string[] } | null> {
  const h = urlHash(q.url);
  let best: { source: PageSource; runId: string; fetchedAt: string; prefix: string; distance: number } | null = null;
  for (const source of PAGE_SOURCES) {
    const base = `${tenantPrefix(q.tenantId)}pages/${source}/`;
    for (const p of await store.listPrefixes(base)) {
      const meta = await getJson<{ fetchedAt?: string }>(store, `${p}${h}.meta.json`);
      if (!meta?.fetchedAt) continue;
      const distance = Math.abs(new Date(meta.fetchedAt).getTime() - q.date.getTime());
      if (!best || distance < best.distance) best = { source, runId: p.slice(base.length).replace(/\/$/, ""), fetchedAt: meta.fetchedAt, prefix: p, distance };
    }
  }
  if (!best) return null;
  const files: string[] = [];
  for (const suffix of [".meta.json", ".html.gz", ".rendered.html.gz"]) {
    try {
      const buf = await readAll(await store.get(`${best.prefix}${h}${suffix}`));
      // Pages are written out as plain HTML, ready to open locally.
      const plain = suffix.endsWith(".gz") ? gunzipSync(buf) : buf;
      files.push(await writeOut(q.outDir, `${best.source}-${best.runId}-${h.slice(0, 12)}${suffix.replace(/\.gz$/, "")}`, plain));
    } catch {
      // that document was not stored (no render, meta-only)
    }
  }
  return { source: best.source, runId: best.runId, fetchedAt: best.fetchedAt, files };
}

export interface PurchaseLookup {
  find(q: { provider: string; endpoint: string; requestHash: string; near?: Date }): Promise<{ s3Key: string; createdAt: Date } | null>;
}

/** One purchased response (the archive body, decompressed) written to outDir. */
export async function getPurchase(
  store: ObjectStore,
  lookup: PurchaseLookup,
  q: { provider: string; endpoint: string; hash: string; date?: Date; outDir: string },
): Promise<{ s3Key: string; file: string } | null> {
  const row = await lookup.find({ provider: q.provider, endpoint: endpointSlug(q.endpoint), requestHash: q.hash, near: q.date });
  if (!row) return null;
  const buf = gunzipSync(await readAll(await store.get(row.s3Key)));
  const file = await writeOut(q.outDir, `${q.provider}-${endpointSlug(q.endpoint)}-${q.hash.slice(0, 12)}-${row.createdAt.getTime()}.json`, buf);
  return { s3Key: row.s3Key, file };
}

/** Every object of one run (pages, meta, manifest, crawl tables), as stored, into outDir. */
export async function restoreRun(
  store: ObjectStore,
  q: { tenantId: string; source: PageSource; runId: string; outDir: string },
): Promise<{ files: number; bytes: number; complete: boolean }> {
  const prefix = pagesPrefix(q.tenantId, q.source, q.runId);
  let files = 0;
  let bytes = 0;
  let complete = false;
  for await (const o of store.list(prefix)) {
    const buf = await readAll(await store.get(o.key));
    await writeOut(q.outDir, o.key.slice(prefix.length), buf);
    files++;
    bytes += buf.length;
    if (o.key === `${prefix}manifest.json`) complete = true;
  }
  return { files, bytes, complete };
}
