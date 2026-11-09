// src/lib/page-archive/writer.ts — one run's page snapshots (a crawl, an AI
// Lens analysis, an audit), streamed to the bucket while the run goes on.
//
// ── NEVER IN THE CRAWL'S WAY ───────────────────────────────────────────────
// add() is synchronous and never awaits the network: it queues the page and
// returns. Uploads run in the background, PAGE_ARCHIVE_CONCURRENCY at a time
// (default 8). When MAX_PENDING pages are already waiting, a new page is
// gzipped straight to the local spool instead, so a slow or unreachable bucket
// bounds memory and costs the crawl nothing. A failed upload spools too.
//
// ── THE MANIFEST IS LAST ───────────────────────────────────────────────────
// finish() waits for every page, then writes manifest.json (count, bytes, and
// key + bytes + sha256 per object). If any object of the run went to the
// spool, the manifest is spooled after it, and the drain uploads in order — so
// a run with a manifest in the bucket has every object it lists.
//
// Keys are derived from the tenant and run ids the job holds (pagesPrefix
// checks both), never from a URL or a request.

import "server-only";

import { createHash } from "node:crypto";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { pagesPrefix, type ObjectStore, type PageSource, type PutOptions } from "@/lib/spaces/client";
import { logger } from "@/infrastructure/observability/logger";
import { MAX_PAGE_BYTES, MAX_PENDING } from "./config";
import { spoolPageObject } from "./spool";

const gzipAsync = promisify(gzip);

/** A body as fetched (a string), or already gzipped (the sidecar's). */
export type PageBody = { html: string } | { gz: Buffer; bytes: number; sha256?: string } | null;

export interface PageCapture {
  url: string;
  finalUrl: string | null;
  status: number | null;
  contentType: string | null;
  headers: Record<string, string>;
  fetchedAt: string;
  raw: PageBody;
  rendered?: PageBody;
  renderedStatus?: number | null;
  /** Why no body is stored: login_crawl, not_html, too_large, archive_cap, challenge… */
  skipped?: string | null;
}

export interface ManifestObject {
  key: string;
  bytes: number;
  sha256: string;
}

export interface RunManifest {
  v: 1;
  tenantId: string;
  source: PageSource;
  runId: string;
  createdAt: string;
  count: number;
  bytes: number;
  objects: ManifestObject[];
}

export function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export type SpoolFn = (key: string, body: Buffer, opts: PutOptions) => Promise<unknown>;

export interface PageRunWriterOptions {
  store: ObjectStore;
  tenantId: string;
  source: PageSource;
  runId: string;
  concurrency: number;
  maxPending?: number;
  spool?: SpoolFn;
  now?: () => Date;
}

interface BuiltObject {
  key: string;
  body: Buffer;
  opts: PutOptions;
}

async function bodyBuffer(b: PageBody): Promise<{ gz: Buffer; bytes: number } | null> {
  if (!b) return null;
  if ("gz" in b) return b.bytes > MAX_PAGE_BYTES ? null : { gz: b.gz, bytes: b.bytes };
  const raw = Buffer.from(b.html, "utf8");
  if (raw.length > MAX_PAGE_BYTES) return null;
  return { gz: await gzipAsync(raw), bytes: raw.length };
}

export class PageRunWriter {
  readonly prefix: string;
  private readonly queue: PageCapture[] = [];
  private active = 0;
  private readonly objects = new Map<string, ManifestObject>();
  private spooledAny = false;
  private closed = false;
  private waiters: Array<() => void> = [];
  private readonly maxPending: number;
  private readonly spool: SpoolFn;
  pages = 0;
  uploaded = 0;
  spooled = 0;
  dropped = 0;

  constructor(private readonly o: PageRunWriterOptions) {
    // Throws InvalidKeySegmentError on a malformed id: the caller does not archive.
    this.prefix = pagesPrefix(o.tenantId, o.source, o.runId);
    this.maxPending = o.maxPending ?? MAX_PENDING;
    this.spool = o.spool ?? ((k, b, p) => spoolPageObject(k, b, p));
  }

  /** Queue one page. Synchronous; never throws; never waits for the network. */
  add(page: PageCapture): void {
    if (this.closed) return;
    this.pages++;
    if (this.queue.length >= this.maxPending) {
      // Backlog full: straight to the spool, off the upload path.
      this.active++;
      void this.writePage(page, true).finally(() => this.done());
      return;
    }
    this.queue.push(page);
    this.pump();
  }

  private pump(): void {
    while (this.active < this.o.concurrency && this.queue.length) {
      const page = this.queue.shift()!;
      this.active++;
      void this.writePage(page, false).finally(() => this.done());
    }
  }

  private done(): void {
    this.active--;
    this.pump();
    if (this.active === 0 && this.queue.length === 0) {
      const w = this.waiters;
      this.waiters = [];
      for (const fn of w) fn();
    }
  }

  private async build(page: PageCapture): Promise<BuiltObject[]> {
    const h = urlHash(page.url);
    const out: BuiltObject[] = [];
    const raw = page.skipped === "login_crawl" ? null : await bodyBuffer(page.raw);
    const rendered = page.skipped === "login_crawl" ? null : await bodyBuffer(page.rendered ?? null);
    if (raw) out.push({ key: `${this.prefix}${h}.html.gz`, body: raw.gz, opts: { contentType: "application/gzip", contentLength: raw.gz.length } });
    if (rendered) out.push({ key: `${this.prefix}${h}.rendered.html.gz`, body: rendered.gz, opts: { contentType: "application/gzip", contentLength: rendered.gz.length } });
    const tooLarge = (page.raw && !raw && page.skipped !== "login_crawl") || (page.rendered && !rendered && page.skipped !== "login_crawl");
    const meta = {
      url: page.url,
      finalUrl: page.finalUrl ?? page.url,
      status: page.status,
      headers: page.headers,
      fetchedAt: page.fetchedAt,
      bytes: raw?.bytes ?? null,
      renderedBytes: rendered?.bytes ?? null,
      renderedStatus: page.renderedStatus ?? null,
      contentType: page.contentType,
      skipped: page.skipped ?? (tooLarge ? "too_large" : null),
    };
    const metaBody = Buffer.from(JSON.stringify(meta), "utf8");
    out.push({ key: `${this.prefix}${h}.meta.json`, body: metaBody, opts: { contentType: "application/json", contentLength: metaBody.length } });
    return out;
  }

  private record(o: BuiltObject): void {
    this.objects.set(o.key, { key: o.key, bytes: o.body.length, sha256: createHash("sha256").update(o.body).digest("hex") });
  }

  private async writePage(page: PageCapture, spoolOnly: boolean): Promise<void> {
    let built: BuiltObject[];
    try {
      built = await this.build(page);
    } catch (err) {
      this.dropped++;
      logger.warn({ err: (err as Error)?.message }, "page-archive: could not prepare a page; skipped");
      return;
    }
    for (const obj of built) {
      this.record(obj);
      if (!spoolOnly) {
        try {
          await this.o.store.put(obj.key, obj.body, obj.opts);
          this.uploaded++;
          continue;
        } catch {
          // fall through to the spool
        }
      }
      try {
        await this.spool(obj.key, obj.body, obj.opts);
        this.spooled++;
        this.spooledAny = true;
      } catch (err) {
        this.objects.delete(obj.key);
        this.dropped++;
        logger.error({ err: (err as Error)?.message }, "page-archive: spool unwritable; object dropped");
      }
    }
  }

  private idle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Wait for every page, then write the manifest last. Never throws. */
  async finish(): Promise<RunManifest | null> {
    this.closed = true;
    await this.idle();
    const objects = [...this.objects.values()].sort((a, b) => a.key.localeCompare(b.key));
    const manifest: RunManifest = {
      v: 1,
      tenantId: this.o.tenantId,
      source: this.o.source,
      runId: this.o.runId,
      createdAt: (this.o.now?.() ?? new Date()).toISOString(),
      count: this.pages,
      bytes: objects.reduce((n, x) => n + x.bytes, 0),
      objects,
    };
    const body = Buffer.from(JSON.stringify(manifest), "utf8");
    const opts: PutOptions = { contentType: "application/json", contentLength: body.length };
    const key = `${this.prefix}manifest.json`;
    try {
      if (this.spooledAny) throw new Error("objects in the spool: the manifest follows them");
      await this.o.store.put(key, body, opts);
    } catch {
      try {
        await this.spool(key, body, opts);
      } catch (err) {
        logger.error({ err: (err as Error)?.message, prefix: this.prefix }, "page-archive: manifest could not be written; the run stays incomplete");
        return null;
      }
    }
    return manifest;
  }
}
