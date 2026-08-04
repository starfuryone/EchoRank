// src/lib/historical/wayback.ts
//
// Internet Archive backfill. Best-effort by design and never load-bearing: the
// Historical page must render, and manual capture must work, whether or not
// web.archive.org is up. Measured from this box, a 3-row CDX query took ~14
// seconds — slow enough that blocking a page render on it would be a bug.
//
// The value here is that a tenant arriving with zero history is not stuck
// waiting weeks to accumulate it. Coverage is uneven and that is stated in the
// UI rather than implied away.
//
// capturedAt IS THE ARCHIVE'S TIMESTAMP. Stamping these `now()` would file 2019
// content under today and make every diff wrong — it would also silently defeat
// the dedupe, since the same archived page imported twice would look like two
// distinct captures.

import { getRedisConnection } from "@/infrastructure/redis/connection";
import { CDX_CACHE_TTL_SECONDS, MAX_WAYBACK_IMPORT } from "./options";

const CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx";
/**
 * The Archive's CDX API is genuinely slow. Measured from this box against
 * example.com: ~14s for a 40-row query. The timeout has to clear that with room
 * to spare, or every lookup aborts and the feature silently reports "no
 * captures" for pages that are in fact well archived — which is exactly what an
 * earlier 25s ceiling did.
 */
const CDX_TIMEOUT_MS = 45_000;
const FETCH_TIMEOUT_MS = 20_000;

export interface WaybackCapture {
  /** 14-digit archive stamp, e.g. 20190412031545. */
  timestamp: string;
  /** Parsed from the stamp — the value stored as capturedAt. */
  capturedAt: Date;
  originalUrl: string;
  statusCode: string;
  digest: string;
}

/** `20190412031545` -> Date. Wayback stamps are UTC. */
export function parseWaybackTimestamp(stamp: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The replay URL for a capture. `id_` returns the original bytes, without the
 *  Archive's injected toolbar and without its URL rewriting. */
export function waybackReplayUrl(timestamp: string, originalUrl: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
}

function cdxCacheKey(url: string): string {
  return `echorank:historical:cdx:${url}`;
}

/**
 * Outcome of a CDX lookup.
 *
 * "The Archive did not answer" and "this page was never archived" are
 * different facts and the user can act on only one of them. Collapsing both to
 * an empty list — which this function used to do on four separate paths — told
 * someone their page has no history when the truth was that a third party was
 * having a bad minute. `unreachable` exists so the UI can tell them to try
 * again instead.
 */
export type WaybackLookup =
  | { status: "ok"; captures: WaybackCapture[] }
  | { status: "empty"; captures: [] }
  | { status: "unreachable"; captures: []; reason: "timeout" | "http" | "malformed" | "network" };

/**
 * Available captures for a URL, newest first. Cached 24h in Redis.
 *
 * Only a genuine answer is cached. Caching an outage would serve "no coverage"
 * for 24 hours after a single slow minute.
 */
export async function listWaybackCaptures(url: string, limit = 50): Promise<WaybackLookup> {
  const key = cdxCacheKey(url);
  try {
    const cached = await getRedisConnection().get(key);
    if (cached) {
      const captures = reviveCaptures(JSON.parse(cached));
      return captures.length
        ? { status: "ok", captures }
        : { status: "empty", captures: [] };
    }
  } catch {
    // Cache miss and broken cache are the same to the caller.
  }

  const params = new URLSearchParams({
    url,
    output: "json",
    fl: "timestamp,original,statuscode,digest",
    filter: "statuscode:200",
    // NOT collapse=digest. It deduplicates consecutive identical captures
    // server-side, which sounds useful and costs ~25 extra seconds (39s vs 14s
    // measured on example.com) — and it is redundant here, because storeSnapshot
    // already dedupes by content hash. A duplicate that survives to import
    // simply writes no row and is reported as a duplicate, at no upload cost.
    limit: String(limit),
  });

  let rows: string[][];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CDX_TIMEOUT_MS);
    try {
      const res = await fetch(`${CDX_ENDPOINT}?${params}`, {
        signal: controller.signal,
        headers: { "user-agent": "Echorank360/1.0 (+https://echorank360.com)" },
      });
      if (!res.ok) {
        return { status: "unreachable", captures: [], reason: "http" };
      }
      rows = (await res.json()) as string[][];
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // An abort is our own 45s ceiling firing, which is worth distinguishing:
    // the Archive is up but slow, and retrying often works.
    const timedOut = err instanceof Error && err.name === "AbortError";
    return { status: "unreachable", captures: [], reason: timedOut ? "timeout" : "network" };
  }

  // A well-formed empty answer is exactly one row: the header. Anything that is
  // not an array at all is CDX returning something we do not understand, which
  // is an outage symptom rather than a statement about coverage.
  if (!Array.isArray(rows)) {
    return { status: "unreachable", captures: [], reason: "malformed" };
  }
  if (rows.length < 2) return { status: "empty", captures: [] };

  // Row 0 is the header.
  const captures: WaybackCapture[] = [];
  for (const row of rows.slice(1)) {
    const [timestamp, originalUrl, statusCode, digest] = row;
    const capturedAt = parseWaybackTimestamp(timestamp ?? "");
    if (!capturedAt) continue;
    captures.push({ timestamp, capturedAt, originalUrl, statusCode: statusCode ?? "", digest: digest ?? "" });
  }
  captures.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  try {
    await getRedisConnection().set(
      key,
      JSON.stringify(captures.map((c) => ({ ...c, capturedAt: c.capturedAt.toISOString() }))),
      "EX",
      CDX_CACHE_TTL_SECONDS,
    );
  } catch {
    // Best-effort.
  }

  return captures.length ? { status: "ok", captures } : { status: "empty", captures: [] };
}

function reviveCaptures(raw: unknown): WaybackCapture[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: Record<string, unknown>) => ({
      timestamp: String(c.timestamp ?? ""),
      capturedAt: new Date(String(c.capturedAt ?? "")),
      originalUrl: String(c.originalUrl ?? ""),
      statusCode: String(c.statusCode ?? ""),
      digest: String(c.digest ?? ""),
    }))
    .filter((c) => c.timestamp && !Number.isNaN(c.capturedAt.getTime()));
}

/**
 * Strip the Archive's additions from replayed HTML.
 *
 * `id_` already suppresses most of it, but not all captures honour it, so the
 * belt-and-braces removal stays: the injected toolbar block, the rewrite
 * comments, and the `/web/<stamp>/` prefixes the Archive splices into every
 * absolute URL. Without the last one, every link and image src in the stored
 * markdown points at web.archive.org instead of the site.
 */
export function stripWaybackChrome(html: string): string {
  return html
    .replace(/<!--\s*BEGIN WAYBACK TOOLBAR INSERT\s*-->[\s\S]*?<!--\s*END WAYBACK TOOLBAR INSERT\s*-->/gi, "")
    .replace(/<script[^>]*archive\.org[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*web-static\.archive\.org[^>]*>/gi, "")
    .replace(/https?:\/\/web\.archive\.org\/web\/\d{14}(?:id_|im_|cs_|js_)?\//gi, "")
    .replace(/\/web\/\d{14}(?:id_|im_|cs_|js_)?\//gi, "/")
    .replace(/<!--\s*playback timings[\s\S]*?-->/gi, "");
}

export interface WaybackFetchResult {
  timestamp: string;
  capturedAt: Date;
  ok: boolean;
  html?: string;
  /** Present when ok is false — surfaced per-snapshot, never fatal. */
  error?: string;
}

/** Fetch one archived capture. Failures are returned, not thrown. */
export async function fetchWaybackCapture(capture: WaybackCapture): Promise<WaybackFetchResult> {
  const base = { timestamp: capture.timestamp, capturedAt: capture.capturedAt };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(waybackReplayUrl(capture.timestamp, capture.originalUrl), {
      signal: controller.signal,
      headers: { "user-agent": "Echorank360/1.0 (+https://echorank360.com)" },
    });
    if (!res.ok) return { ...base, ok: false, error: `Archive returned ${res.status}` };
    const html = await res.text();
    return { ...base, ok: true, html: stripWaybackChrome(html) };
  } catch (err) {
    return {
      ...base,
      ok: false,
      error: err instanceof Error && err.name === "AbortError" ? "Timed out" : "Could not fetch",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Cap what one import may pull, whatever the caller asked for. */
export function limitImportSelection(timestamps: string[]): string[] {
  return [...new Set(timestamps)].slice(0, MAX_WAYBACK_IMPORT);
}
