// src/lib/report-archive.ts — a copy of every report and export generated for
// a user (ECHORANK-DATA-ARCHIVE.md Phase 4), in the crawl archive's private
// bucket (SPACES_ARCHIVE_*):
//
//   tenants/<tenantId>/reports/<type>/<YYYY>/<MM>/<id>.<ext>
//
// Written when the report is created, in the background: saveReportCopy()
// returns at once and never throws, so a slow or missing bucket never touches
// the download. Users keep downloading exactly as before — the response, or
// the exports-via-Spaces presigned URL; nothing here serves these objects.
// `tenantId` is always the session's (or the job's), never input. Deleted with
// the workspace (everything under tenants/<tenantId>/).
//
// Crawl exports already have a Spaces path (site-crawler/export-store.ts,
// EXPORTS_VIA_SPACES): when it generates an object, that object is copied
// server-side into reports/ (copyExportToReports) rather than uploaded twice.
// With the flag off they stream, and are not copied.
//
// On when SPACES_ARCHIVE_* is set, unless REPORT_ARCHIVE_ENABLED=false.

import "server-only";

import { randomBytes } from "node:crypto";
import { archiveConfig, archiveStore, tenantPrefix, type ObjectStore } from "@/lib/spaces/client";
import { logger } from "@/infrastructure/observability/logger";

const TYPE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const EXT = /^[a-z0-9]{1,8}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function reportArchiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if ((env.REPORT_ARCHIVE_ENABLED ?? "").trim().toLowerCase() === "false") return false;
  return archiveConfig(env) !== null;
}

export function newReportId(now = new Date()): string {
  return `${now.getTime().toString(36)}-${randomBytes(6).toString("hex")}`;
}

/** tenants/<tenantId>/reports/<type>/<YYYY>/<MM>/<id>.<ext>; throws on a malformed part. */
export function reportKey(p: { tenantId: string; type: string; id: string; ext: string; at: Date }): string {
  if (!TYPE.test(p.type) || !EXT.test(p.ext) || !ID.test(p.id)) throw new Error("Invalid report key part.");
  const y = String(p.at.getUTCFullYear());
  const m = String(p.at.getUTCMonth() + 1).padStart(2, "0");
  return `${tenantPrefix(p.tenantId)}reports/${p.type}/${y}/${m}/${p.id}.${p.ext}`;
}

export interface ReportCopy {
  tenantId: string;
  /** "ai-visibility", "monitoring", "intelligence", "explain", "crawl", "agency-scan", "authority-checker", … */
  type: string;
  ext: "pdf" | "csv" | "zip" | "json";
  contentType: string;
  body: Uint8Array | Buffer | string;
  id?: string;
  at?: Date;
}

/** Store a copy of a generated report. Returns at once; never throws. */
export function saveReportCopy(r: ReportCopy, deps: { store?: () => ObjectStore | null; enabled?: () => boolean } = {}): Promise<string | null> {
  let key: string;
  let store: ObjectStore | null;
  try {
    if (!(deps.enabled ?? reportArchiveEnabled)()) return Promise.resolve(null);
    store = (deps.store ?? archiveStore)();
    if (!store) return Promise.resolve(null);
    key = reportKey({ tenantId: r.tenantId, type: r.type, id: r.id ?? newReportId(), ext: r.ext, at: r.at ?? new Date() });
  } catch (err) {
    logger.debug({ err: (err as Error)?.message }, "report-archive: not saved");
    return Promise.resolve(null);
  }
  const body = typeof r.body === "string" ? Buffer.from(r.body, "utf8") : Buffer.from(r.body);
  const s = store;
  return new Promise((resolve) => {
    setImmediate(() => {
      s.put(key, body, { contentType: r.contentType, contentLength: body.length }).then(
        () => resolve(key),
        (err) => {
          logger.warn({ err: (err as Error)?.message, type: r.type }, "report-archive: copy failed");
          resolve(null);
        },
      );
    });
  });
}

/** Crawl exports via Spaces: copy the generated export object into reports/ (server-side). */
export function copyExportToReports(
  p: { store: ObjectStore; tenantId: string; type: string; ext: string; sourceKey: string; id: string },
  enabled: () => boolean = reportArchiveEnabled,
): void {
  try {
    if (!enabled() || !p.store.copy) return;
    const key = reportKey({ tenantId: p.tenantId, type: p.type, id: p.id, ext: p.ext, at: new Date() });
    void p.store.copy(p.sourceKey, key).catch((err) => logger.warn({ err: (err as Error)?.message }, "report-archive: export copy failed"));
  } catch (err) {
    logger.debug({ err: (err as Error)?.message }, "report-archive: export not copied");
  }
}
