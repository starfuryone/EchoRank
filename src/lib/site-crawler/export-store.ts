// src/lib/site-crawler/export-store.ts
//
// Exports via Spaces (CRAWL-ARCHIVE.md Phase 5). With EXPORTS_VIA_SPACES=true
// and the archive bucket configured, a crawl's CSV, PDF report and sitemap zip
// are generated ONCE, streamed straight into a multipart upload at
//
//   tenants/<tenantId>/exports/<crawlId>/<type>-<hash>.<ext>
//
// and every download is a presigned GET (EXPORT_URL_TTL_SECONDS, the current
// filename as Content-Disposition) — a 302 for links, JSON {url} for the PDF
// (fetched with a POST; a cross-origin redirect there would need CORS on the
// bucket, which stays closed).
//
// THE HASH covers the export type, the normalized filters (every query
// parameter but `format`, keys sorted, repeated keys kept in order, plus any
// path parameter the caller adds) and the crawl's finishedAt. A completed
// crawl's rows do not change, so the same request is the same object and is
// served again rather than regenerated. Only a crawl that is COMPLETED, has a
// finishedAt, is HOT and has no metrics job still writing is cached; anything
// else — and everything when the flag is off or Spaces is not configured —
// takes the old streaming path, unchanged (its 50,000-row cap included).
// This path has NO row cap.
//
// Tenant isolation: tenantId comes from the session (the caller's
// requirePaidPlan), the crawl was looked up by id AND tenant before this runs,
// and the key is built from those two — never from input. The presigned URL is
// only minted after the route's own auth and plan checks. The daily sweep
// deletes export objects older than EXPORT_TTL_DAYS (archive/sweep.ts).

import "server-only";

import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { archiveStore, attachmentDisposition, crawlExportPrefix, type ObjectStore } from "@/lib/spaces/client";
import { csvByteStream, csvStreamResponse, type CsvStreamSource } from "@/lib/csv-stream";
import { EXPORT_URL_TTL_SECONDS, exportsViaSpacesFlag } from "./archive/constants";
import { crawlDataState } from "./data-state";
import { copyExportToReports } from "@/lib/report-archive";
import { metricsPending } from "./metrics-runner";

export type ExportFilters = Record<string, string | string[] | number | boolean | null | undefined>;

/** The store to export through, or null for the streaming fallback. */
export function exportsStore(): ObjectStore | null {
  return exportsViaSpacesFlag() ? archiveStore() : null;
}

/** Keys sorted, empty values dropped; arrays keep their order (it can matter). */
export function normalizeFilters(filters: ExportFilters): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const k of Object.keys(filters).sort()) {
    const v = filters[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      const vals = v.filter((x) => x !== "");
      if (vals.length) out[k] = vals.map(String);
    } else out[k] = String(v);
  }
  return out;
}

/** A request's filters: its query string without `format`. */
export function filtersFromUrl(url: URL, drop: readonly string[] = ["format"]): ExportFilters {
  const out: Record<string, string[]> = {};
  for (const [k, v] of url.searchParams) {
    if (drop.includes(k)) continue;
    (out[k] ??= []).push(v);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length === 1 ? v[0]! : v]));
}

export function exportHash(type: string, filters: ExportFilters, finishedAt: Date): string {
  const canonical = JSON.stringify({ v: 1, type, filters: normalizeFilters(filters), finishedAt: finishedAt.toISOString() });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

const TYPE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const EXT = /^[a-z0-9]{1,8}$/;

/** tenants/<t>/exports/<c>/<type>-<hash>.<ext> — every part checked. */
export function exportKey(tenantId: string, crawlId: string, type: string, hash: string, ext: string): string {
  if (!TYPE.test(type) || !EXT.test(ext) || !/^[0-9a-f]{32}$/.test(hash)) throw new Error("Invalid export key part");
  return `${crawlExportPrefix(tenantId, crawlId)}${type}-${hash}.${ext}`;
}

/** finishedAt when this crawl's exports may be cached; null → stream as before. */
async function cacheableFinishedAt(tenantId: string, crawlId: string): Promise<Date | null> {
  const c = await prisma.crawlJob.findFirst({
    where: { id: crawlId, tenantId },
    select: { status: true, finishedAt: true, config: true, summary: true, storageState: true, dataPurgedAt: true },
  });
  if (!c || c.status !== "COMPLETED" || !c.finishedAt || crawlDataState(c) !== "hot") return null;
  if (metricsPending(c.config, c.summary)) return null;
  return c.finishedAt;
}

export interface SpacesExport {
  tenantId: string;
  crawlId: string;
  /** e.g. "pages", "issues", "rule-content-thin", "report", "sitemaps". */
  type: string;
  filters: ExportFilters;
  ext: string;
  contentType: string;
  /** The download's name (Content-Disposition on the presigned GET). */
  filename: string;
  /** Other inputs the content depends on (a comparison's baseline finishedAt). */
  alsoDependsOn?: Date | null;
}

export interface Generated {
  body: Readable;
  /** A filename known only once generated (the sidecar's PDF name); kept on the object. */
  filename?: string;
}

/**
 * Serve one export through Spaces: reuse the object, or generate it into a
 * streaming upload; then presign. Returns null when this export takes the
 * fallback (flag off, Spaces not configured, crawl not cacheable).
 */
export async function serveViaSpaces(
  target: SpacesExport,
  generate: () => Promise<Generated | Response> | Generated,
  respond: "redirect" | "json" = "redirect",
): Promise<Response | null> {
  const store = exportsStore();
  if (!store) return null;
  const finishedAt = await cacheableFinishedAt(target.tenantId, target.crawlId);
  if (!finishedAt) return null;
  const filters = target.alsoDependsOn ? { ...target.filters, __dependsOn: target.alsoDependsOn.toISOString() } : target.filters;
  const hash = exportHash(target.type, filters, finishedAt);
  const key = exportKey(target.tenantId, target.crawlId, target.type, hash, target.ext);

  let filename = target.filename;
  const head = await store.head(key);
  if (head) {
    if (head.metadata.filename) filename = safeDecode(head.metadata.filename) ?? filename;
  } else {
    const made = await generate();
    // A Response here is the generator's own refusal (an upstream error): pass it through.
    if (made instanceof Response) return made;
    if (made.filename) filename = made.filename;
    await store.put(key, made.body, {
      contentType: target.contentType,
      contentDisposition: attachmentDisposition(filename),
      metadata: { filename: encodeURIComponent(filename) },
    });
    // The report archive (ECHORANK-DATA-ARCHIVE.md Phase 4): a server-side copy
    // into tenants/<t>/reports/, once, when the export is created. Background.
    copyExportToReports({ store, tenantId: target.tenantId, type: `crawl-${target.type}`, ext: target.ext, sourceKey: key, id: `${target.crawlId}-${hash}`.slice(0, 64) });
  }
  const url = await store.presignGet(key, { filename, expiresIn: EXPORT_URL_TTL_SECONDS, contentType: target.contentType });
  if (respond === "json") return NextResponse.json({ url, expiresIn: EXPORT_URL_TTL_SECONDS }, { headers: { "cache-control": "no-store" } });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
}

function safeDecode(v: string): string | null {
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

/** A web ReadableStream as a Node Readable, for the upload. */
export function nodeReadable(stream: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(stream as unknown as NodeWebStream<Uint8Array>);
}

/**
 * The CSV routes' one call: through Spaces when on (no row cap), else the
 * streamed response exactly as before.
 */
export async function crawlCsvResponse<Row>(
  source: CsvStreamSource<Row>,
  target: { tenantId: string; crawlId: string; type: string; request: Request; extra?: ExportFilters; alsoDependsOn?: Date | null },
): Promise<Response> {
  const via = await serveViaSpaces(
    {
      tenantId: target.tenantId,
      crawlId: target.crawlId,
      type: target.type,
      filters: { ...filtersFromUrl(new URL(target.request.url)), ...(target.extra ?? {}) },
      ext: "csv",
      contentType: "text/csv; charset=utf-8",
      filename: source.filename,
      alsoDependsOn: target.alsoDependsOn,
    },
    () => ({ body: nodeReadable(csvByteStream({ ...source, cap: Number.POSITIVE_INFINITY })) }),
  );
  return via ?? csvStreamResponse(source);
}
