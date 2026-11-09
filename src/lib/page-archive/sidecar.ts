// src/lib/page-archive/sidecar.ts — the pages the av-service sidecar read for
// an AI Lens analysis or an AI readiness audit.
//
// The app sends `archive: true` (sidecarArchiveBody) when page snapshots are
// on; the sidecar answers with an `archive` object (av-service page_archive.py:
// raw and rendered HTML, gzip+base64, capped at 5 MB). takeSidecarArchive()
// REMOVES it from the response before anything else sees it: the audit rows
// store the response as JSON and the routes return it to the browser, and
// neither may carry page HTML. archiveSidecarPages() then stores the pages in
// the background — never awaited by the request, never thrown.

import "server-only";

import { archiveStore, type PageSource } from "@/lib/spaces/client";
import { logger } from "@/infrastructure/observability/logger";
import { pageArchiveConcurrency, pageArchiveEnabled } from "./config";
import { PageRunWriter, type PageBody, type PageCapture } from "./writer";

interface PackedBody {
  gz_b64: string;
  bytes: number;
  sha256?: string;
}

interface SidecarPage {
  url?: string;
  final_url?: string | null;
  status?: number | null;
  content_type?: string | null;
  headers?: Record<string, string>;
  fetched_at?: string;
  raw?: PackedBody | null;
  rendered?: PackedBody | null;
  rendered_status?: number | null;
  skipped?: string | null;
}

export interface SidecarArchive {
  v?: number;
  pages?: SidecarPage[];
}

/** The extra body field for a sidecar call: archive only when snapshots are on. */
export function sidecarArchiveBody(env: NodeJS.ProcessEnv = process.env): { archive?: true } {
  return pageArchiveEnabled(env) ? { archive: true } : {};
}

/** Remove and return the response's `archive` (mutates). Always call it on a sidecar response. */
export function takeSidecarArchive(data: unknown): SidecarArchive | null {
  if (!data || typeof data !== "object" || !("archive" in data)) return null;
  const rec = data as { archive?: unknown };
  const out = rec.archive;
  delete rec.archive;
  return out && typeof out === "object" ? (out as SidecarArchive) : null;
}

function body(p: PackedBody | null | undefined): PageBody {
  if (!p || typeof p.gz_b64 !== "string") return null;
  return { gz: Buffer.from(p.gz_b64, "base64"), bytes: Number(p.bytes) || 0, sha256: p.sha256 };
}

export function toCaptures(archive: SidecarArchive): PageCapture[] {
  const out: PageCapture[] = [];
  for (const p of archive.pages ?? []) {
    if (!p?.url || typeof p.url !== "string") continue;
    out.push({
      url: p.url,
      finalUrl: p.final_url ?? null,
      status: typeof p.status === "number" ? p.status : null,
      contentType: p.content_type ?? null,
      headers: p.headers && typeof p.headers === "object" ? p.headers : {},
      fetchedAt: p.fetched_at ?? new Date().toISOString(),
      raw: body(p.raw),
      rendered: body(p.rendered),
      renderedStatus: p.rendered_status ?? null,
      skipped: p.skipped ?? null,
    });
  }
  return out;
}

/**
 * Store one run's sidecar pages under tenants/<tenantId>/pages/<source>/<runId>/.
 * Returns at once; the work runs in the background. `tenantId` is the
 * session's or the job's, never input.
 */
export function archiveSidecarPages(p: { tenantId: string; source: PageSource; runId: string; archive: SidecarArchive | null }): void {
  if (!p.archive || !pageArchiveEnabled()) return;
  const store = archiveStore();
  if (!store) return;
  const archive = p.archive;
  setImmediate(() => {
    void (async () => {
      const writer = new PageRunWriter({ store, tenantId: p.tenantId, source: p.source, runId: p.runId, concurrency: pageArchiveConcurrency() });
      for (const c of toCaptures(archive)) writer.add(c);
      await writer.finish();
    })().catch((err) => logger.warn({ err: (err as Error)?.message, source: p.source }, "page-archive: sidecar pages not stored"));
  });
}
