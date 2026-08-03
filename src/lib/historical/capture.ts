// src/lib/historical/capture.ts
//
// The two ways markdown arrives, and what happens to it afterwards.
//
//   manual  — "Capture now" fetches the live page through the sidecar's AI Lens
//             endpoint and keeps the RENDERED markdown. Rendered, not raw: a
//             snapshot should record what the page actually says, and on a
//             client-rendered site the raw fetch says almost nothing.
//   wayback — bytes already in hand from the Archive, converted by the SAME
//             sidecar pipeline so an archived capture and a live one are
//             comparable rather than differing by tokenizer.
//
// Capture path A (persisting AI Lens's own run) is wired inside
// src/lib/ai-lens/service.ts, where the markdown already exists and would
// otherwise be discarded.

import { sidecarPost } from "@/lib/av-sidecar";
import { storeSnapshot, type StoreSnapshotResult } from "./snapshots";
import {
  fetchWaybackCapture,
  limitImportSelection,
  listWaybackCaptures,
  type WaybackCapture,
} from "./wayback";

export class CaptureFailedError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
    this.name = "CaptureFailedError";
  }
}

/** Rendered markdown for a live URL, via the sidecar. */
export async function fetchLiveMarkdown(url: string): Promise<string> {
  const { status, data } = await sidecarPost<{
    rendered_markdown?: string;
    raw_markdown?: string;
    error?: string;
  }>("/internal/ai-lens", { url }, { timeoutMs: 60_000 });

  if (status !== 200 || !data) {
    throw new CaptureFailedError(
      data?.error ?? "Could not fetch that page right now.",
      status === 429 ? 429 : 502,
    );
  }
  const markdown = (data.rendered_markdown ?? data.raw_markdown ?? "").trim();
  if (!markdown) {
    throw new CaptureFailedError("That page returned no readable text.", 422);
  }
  return markdown;
}

/** HTML -> markdown through the sidecar's AI Lens converter. */
export async function convertHtmlToMarkdown(html: string): Promise<string> {
  const { status, data } = await sidecarPost<{ markdown?: string; error?: string }>(
    "/internal/html-to-markdown",
    { html },
    { timeoutMs: 30_000 },
  );
  if (status !== 200 || typeof data?.markdown !== "string") {
    throw new CaptureFailedError(data?.error ?? "Could not convert that page.", 502);
  }
  return data.markdown.trim();
}

export interface CaptureNowResult extends StoreSnapshotResult {
  url: string;
}

/** "Capture now": fetch the live page and store it. */
export async function captureNow(
  tenantId: string,
  url: string,
  now = new Date(),
): Promise<CaptureNowResult> {
  const markdown = await fetchLiveMarkdown(url);
  const stored = await storeSnapshot({
    tenantId,
    url,
    markdown,
    source: "manual",
    capturedAt: now,
  });
  return { ...stored, url };
}

export interface ImportOutcome {
  timestamp: string;
  capturedAt: string;
  ok: boolean;
  /** True when the fetch worked but the content matched the latest snapshot. */
  duplicate?: boolean;
  snapshotId?: string | null;
  error?: string;
}

export interface ImportResult {
  url: string;
  requested: number;
  imported: number;
  duplicates: number;
  failed: number;
  outcomes: ImportOutcome[];
}

/**
 * Import selected Wayback captures.
 *
 * Per-snapshot failures are NON-FATAL by design: the Archive routinely has a
 * capture listed in CDX that 404s on replay, and losing nine good snapshots
 * because the tenth is missing would be the wrong trade. Every outcome is
 * reported so the UI can say what did not come through.
 *
 * Captures are stored OLDEST FIRST. Dedupe compares against the latest snapshot
 * of the url, so importing newest-first would compare a 2019 page against a
 * 2024 one and store both; oldest-first walks the history in order and collapses
 * genuinely unchanged runs.
 */
export async function importWaybackCaptures(
  tenantId: string,
  url: string,
  timestamps: string[],
): Promise<ImportResult> {
  const wanted = limitImportSelection(timestamps);
  const available = await listWaybackCaptures(url);
  const byStamp = new Map(available.map((c) => [c.timestamp, c]));

  const selected: WaybackCapture[] = wanted
    .map((t) => byStamp.get(t))
    .filter((c): c is WaybackCapture => Boolean(c))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const outcomes: ImportOutcome[] = [];

  for (const capture of selected) {
    const base = { timestamp: capture.timestamp, capturedAt: capture.capturedAt.toISOString() };
    const fetched = await fetchWaybackCapture(capture);
    if (!fetched.ok || !fetched.html) {
      outcomes.push({ ...base, ok: false, error: fetched.error ?? "Could not fetch" });
      continue;
    }
    try {
      const markdown = await convertHtmlToMarkdown(fetched.html);
      if (!markdown) {
        outcomes.push({ ...base, ok: false, error: "Archived page had no readable text" });
        continue;
      }
      const stored = await storeSnapshot({
        tenantId,
        url,
        markdown,
        source: "wayback",
        // The archive's own timestamp. Never now().
        capturedAt: capture.capturedAt,
      });
      outcomes.push({
        ...base,
        ok: true,
        duplicate: !stored.created,
        snapshotId: stored.snapshotId,
      });
    } catch (err) {
      outcomes.push({
        ...base,
        ok: false,
        error: err instanceof Error ? err.message : "Could not store",
      });
    }
  }

  return {
    url,
    requested: wanted.length,
    imported: outcomes.filter((o) => o.ok && !o.duplicate).length,
    duplicates: outcomes.filter((o) => o.ok && o.duplicate).length,
    failed: outcomes.filter((o) => !o.ok).length,
    outcomes,
  };
}
