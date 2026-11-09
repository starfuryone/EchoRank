// src/lib/page-archive/stored-copy.ts — "View stored copy" in the crawler's
// page detail (ECHORANK-DATA-ARCHIVE.md Phase 4): the customer's OWN crawled
// page, raw or rendered, as the crawl fetched it.
//
//   - Keys are derived from the session's tenant, the crawl (looked up by id
//     AND tenant) and the page's own URL — never from input.
//   - Served only as a short-lived presigned GET (STORED_COPY_URL_TTL_SECONDS)
//     with Content-Disposition: attachment, against the bucket's own host, so
//     the page is never rendered inline on our domain.
//   - Crawl pages only (tenants/<t>/pages/crawl/<crawlId>/). Purchased
//     provider data lives in another bucket on another key and nothing here
//     can reach it.

import "server-only";

import { gunzipSync } from "node:zlib";
import type { Readable } from "node:stream";
import { pagesPrefix, type ObjectStore } from "@/lib/spaces/client";
import { urlHash } from "./writer";

export const STORED_COPY_URL_TTL_SECONDS = 5 * 60;
const META_TIMEOUT_MS = 2_000;

export type StoredKind = "raw" | "rendered";

export function storedCopyKeys(tenantId: string, crawlId: string, url: string): { meta: string; raw: string; rendered: string } {
  const base = `${pagesPrefix(tenantId, "crawl", crawlId)}${urlHash(url)}`;
  return { meta: `${base}.meta.json`, raw: `${base}.html.gz`, rendered: `${base}.rendered.html.gz` };
}

async function readAll(s: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of s) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

/** What is stored for this page, from its meta object; null when nothing is (or on any error). */
export async function storedCopyInfo(store: ObjectStore, tenantId: string, crawlId: string, url: string): Promise<{ raw: boolean; rendered: boolean; fetchedAt: string } | null> {
  try {
    const keys = storedCopyKeys(tenantId, crawlId, url);
    const read = (async () => {
      const buf = await readAll(await store.get(keys.meta));
      // The meta object is plain JSON; tolerate a gzipped one too.
      const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
      return JSON.parse(text) as { bytes?: number | null; renderedBytes?: number | null; fetchedAt?: string; skipped?: string | null };
    })();
    const meta = await Promise.race([read, new Promise<null>((r) => setTimeout(() => r(null), META_TIMEOUT_MS))]);
    if (!meta) return null;
    const raw = typeof meta.bytes === "number" && meta.skipped !== "login_crawl";
    const rendered = typeof meta.renderedBytes === "number" && meta.skipped !== "login_crawl";
    if (!raw && !rendered) return null;
    return { raw, rendered, fetchedAt: meta.fetchedAt ?? "" };
  } catch {
    return null;
  }
}

/** A presigned attachment download of one stored document, or null when it does not exist. */
export async function presignStoredCopy(
  store: ObjectStore,
  p: { tenantId: string; crawlId: string; url: string; kind: StoredKind; date: string },
): Promise<string | null> {
  const keys = storedCopyKeys(p.tenantId, p.crawlId, p.url);
  const key = p.kind === "rendered" ? keys.rendered : keys.raw;
  if (!(await store.head(key))) return null;
  let host = "page";
  try {
    host = new URL(p.url).hostname.replace(/[^a-z0-9.-]/gi, "_") || "page";
  } catch {
    // keep "page"
  }
  const filename = `${host}-${p.date || "stored"}${p.kind === "rendered" ? "-rendered" : ""}.html`;
  // The object is gzip; Content-Encoding makes the browser save the HTML itself.
  return store.presignGet(key, { filename, expiresIn: STORED_COPY_URL_TTL_SECONDS, contentType: "text/html; charset=utf-8", contentEncoding: "gzip" });
}
